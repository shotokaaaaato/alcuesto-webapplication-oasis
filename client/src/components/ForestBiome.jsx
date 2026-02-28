import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * 森バイオーム — 幻想的な和のテラリウム
 * 木漏れ日（ゴッドレイ）、胞子パーティクル、苔むす地面
 */
export default function ForestBiome() {
  return (
    <>
      <ForestLighting />
      <GodRays />
      <ForestGround />
      <LeafParticles count={120} />
      <SporeParticles count={80} />
    </>
  );
}

/* ── 木漏れ日ライティング ── */
function ForestLighting() {
  const light1 = useRef();
  const light2 = useRef();
  const light3 = useRef();

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (light1.current) {
      light1.current.position.x = 3 + Math.sin(t * 0.3) * 2;
      light1.current.position.z = Math.cos(t * 0.2) * 2;
      light1.current.intensity = 2.0 + Math.sin(t * 0.8) * 0.5;
    }
    if (light2.current) {
      light2.current.position.x = -2 + Math.cos(t * 0.25) * 1.5;
      light2.current.position.z = 1 + Math.sin(t * 0.35) * 1.5;
      light2.current.intensity = 1.5 + Math.cos(t * 0.6) * 0.3;
    }
    if (light3.current) {
      light3.current.intensity = 0.8 + Math.sin(t * 0.4) * 0.2;
    }
  });

  return (
    <>
      <spotLight ref={light1} position={[3, 14, 0]} angle={0.2} penumbra={0.9} intensity={2.0} color="#8ece5a" distance={35} decay={1.5} castShadow />
      <spotLight ref={light2} position={[-2, 12, 1]} angle={0.25} penumbra={0.85} intensity={1.5} color="#c4e87c" distance={28} decay={1.5} />
      <spotLight ref={light3} position={[0, 16, -3]} angle={0.35} penumbra={1.0} intensity={0.8} color="#a0d860" distance={30} decay={2} />
      <ambientLight intensity={0.08} color="#1a3a0e" />
      <hemisphereLight args={["#3a6a2e", "#0d0a05", 0.3]} />
    </>
  );
}

/* ── ゴッドレイ（光条）シミュレーション ── */
function GodRays() {
  const rays = useRef([]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    rays.current.forEach((ray, i) => {
      if (ray) {
        ray.material.opacity = 0.025 + Math.sin(t * 0.3 + i * 2.1) * 0.015;
      }
    });
  });

  const rayData = [
    { pos: [4, 7, 2], rot: [0.1, 0, -0.15] },
    { pos: [-3, 7, -1], rot: [-0.08, 0.2, 0.1] },
    { pos: [1, 7, -4], rot: [0.05, -0.1, 0.08] },
  ];

  return (
    <>
      {rayData.map((r, i) => (
        <mesh key={i} ref={el => { rays.current[i] = el; }} position={r.pos} rotation={r.rot}>
          <cylinderGeometry args={[0.05, 2.5, 14, 12, 1, true]} />
          <meshBasicMaterial color="#a0d860" transparent opacity={0.03} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} />
        </mesh>
      ))}
    </>
  );
}

/* ── 苔むす地面 ── */
function ForestGround() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
      <circleGeometry args={[20, 64]} />
      <meshStandardMaterial color="#0e2a08" roughness={0.98} emissive="#061a03" emissiveIntensity={0.08} />
    </mesh>
  );
}

/* ── 舞い落ちる木の葉パーティクル ── */
function LeafParticles({ count }) {
  const ref = useRef();
  const seeds = useRef(null);
  const geo = useRef(null);

  if (!geo.current) {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const s = [];
    // 和の色彩 — 苔色・若葉色・萌黄色・朽葉色
    const palette = [
      [0.18, 0.42, 0.10],
      [0.30, 0.55, 0.15],
      [0.50, 0.72, 0.20],
      [0.65, 0.78, 0.28],
      [0.70, 0.55, 0.18],
    ];

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      positions[i3] = (Math.random() - 0.5) * 24;
      positions[i3 + 1] = Math.random() * 10;
      positions[i3 + 2] = (Math.random() - 0.5) * 24;
      const c = palette[Math.floor(Math.random() * palette.length)];
      colors[i3] = c[0]; colors[i3 + 1] = c[1]; colors[i3 + 2] = c[2];
      s.push({
        bx: positions[i3], bz: positions[i3 + 2],
        fall: Math.random() * 0.06 + 0.02,
        amp: Math.random() * 0.8 + 0.4,
        freq: Math.random() * 0.3 + 0.1,
        ph: Math.random() * Math.PI * 2,
        sy: positions[i3 + 1],
      });
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geo.current = g;
    seeds.current = s;
  }

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime;
    const pos = ref.current.geometry.attributes.position.array;
    for (let i = 0; i < count; i++) {
      const s = seeds.current[i];
      const i3 = i * 3;
      pos[i3 + 1] = ((s.sy - s.fall * t) % 10 + 10) % 10;
      pos[i3] = s.bx + Math.sin(t * s.freq + s.ph) * s.amp;
      pos[i3 + 2] = s.bz + Math.cos(t * s.freq * 0.7 + s.ph) * s.amp * 0.6;
    }
    ref.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={ref} geometry={geo.current}>
      <pointsMaterial vertexColors size={0.22} sizeAttenuation transparent opacity={0.9} depthWrite={false} />
    </points>
  );
}

/* ── 蛍のように光る胞子パーティクル ── */
function SporeParticles({ count }) {
  const ref = useRef();
  const seeds = useRef(null);
  const geo = useRef(null);

  if (!geo.current) {
    const positions = new Float32Array(count * 3);
    const s = [];
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      positions[i3] = (Math.random() - 0.5) * 18;
      positions[i3 + 1] = Math.random() * 6 + 0.3;
      positions[i3 + 2] = (Math.random() - 0.5) * 18;
      s.push({
        bx: positions[i3], by: positions[i3 + 1], bz: positions[i3 + 2],
        spd: Math.random() * 0.4 + 0.15,
        off: Math.random() * Math.PI * 2,
        r: Math.random() * 0.5 + 0.15,
      });
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.current = g;
    seeds.current = s;
  }

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime;
    const pos = ref.current.geometry.attributes.position.array;
    for (let i = 0; i < count; i++) {
      const s = seeds.current[i];
      const i3 = i * 3;
      pos[i3] = s.bx + Math.sin(t * s.spd + s.off) * s.r;
      pos[i3 + 1] = s.by + Math.sin(t * s.spd * 0.5 + s.off) * 0.3;
      pos[i3 + 2] = s.bz + Math.cos(t * s.spd + s.off) * s.r;
    }
    ref.current.geometry.attributes.position.needsUpdate = true;
    if (ref.current.material) {
      ref.current.material.opacity = 0.5 + Math.sin(t * 0.8) * 0.2;
    }
  });

  return (
    <points ref={ref} geometry={geo.current}>
      <pointsMaterial size={0.08} color="#b0ff70" transparent opacity={0.6} sizeAttenuation blending={THREE.AdditiveBlending} depthWrite={false} />
    </points>
  );
}
