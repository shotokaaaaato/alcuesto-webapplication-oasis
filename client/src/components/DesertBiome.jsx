import { useRef, useState, useMemo, useEffect, useCallback } from "react";
import { useFrame } from "@react-three/fiber";
import { Html, MeshReflectorMaterial, useGLTF } from "@react-three/drei";
import * as THREE from "three";

/* ── GLB モデルパス ── */
const CAR_URL = "/assets/models/キャンピングカー.glb";
const PALM_URL = "/assets/models/ヤシの木.glb";
const STUMP_URL = "/assets/models/切り株.glb";
const FISH_URL = "/assets/models/小魚.glb";

/* ── バウンディングボックスからスケールを算出 ── */
function fitToSize(object, targetMaxDim) {
  const box = new THREE.Box3().setFromObject(object);
  const size = new THREE.Vector3();
  box.getSize(size);
  const maxDim = Math.max(size.x, size.y, size.z);
  if (maxDim === 0) return 1;
  return targetMaxDim / maxDim;
}

/* ── モデルを地面に接地させるY補正値を算出 ── */
function getGroundOffset(object, scale) {
  const box = new THREE.Box3().setFromObject(object);
  return -box.min.y * scale;
}

/* ── ワールド座標 (wx, wz) での砂丘の高さを返す ── */
function getSandHeight(wx, wz) {
  const dist = Math.sqrt(wx * wx + wz * wz);
  let h = fbm(wx * 0.06, wz * 0.06) * 3;
  h += fbm(wx * 0.15 + 5, wz * 0.15 + 5) * 1.0;
  const poolFade = Math.min(1, Math.max(0, (dist - 3.2) / 2));
  h = h * poolFade - 0.15 * (1 - poolFade);
  return h;
}

/**
 * 砂漠のオアシス — GLBモデル + 砂丘 + 泉 + 切り株メニュー + 空中タイトル
 */
export default function DesertBiome({ onMenuClick, stumpMenus }) {
  return (
    <>
      <DesertLighting />
      <SandDunes />
      <OasisPool />
      <CampingCar />
      <PalmTreeGroup />
      <StumpMenus onMenuClick={onMenuClick} menus={stumpMenus} />
    </>
  );
}

/* ── ゴールデンアワーのライティング ── */
function DesertLighting() {
  const mainLight = useRef();

  useFrame(({ clock }) => {
    if (mainLight.current) {
      const t = clock.elapsedTime;
      mainLight.current.intensity = 1.8 + Math.sin(t * 0.2) * 0.15;
    }
  });

  return (
    <>
      <ambientLight intensity={0.4} color="#FFE4B5" />
      <directionalLight
        ref={mainLight}
        position={[10, 5, -8]}
        intensity={1.8}
        color="#FF9933"
        castShadow
      />
      <directionalLight position={[-5, 8, 5]} intensity={0.4} color="#FFD700" />
      <pointLight position={[0, 2, 0]} intensity={0.3} color="#87CEEB" distance={8} />
      <hemisphereLight args={["#FFA040", "#8B6914", 0.3]} />
      {/* キャンピングカー付近のゴールド反射光 */}
      <pointLight position={[0, 3, -5]} intensity={0.6} color="#FFD700" distance={12} />
      <pointLight position={[0, 4, -3]} intensity={0.3} color="#FFA500" distance={10} />
    </>
  );
}

/* ── 2D ノイズ関数 ── */
function hash21(x, y) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

function noise2D(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash21(ix, iy), b = hash21(ix + 1, iy);
  const c = hash21(ix, iy + 1), d = hash21(ix + 1, iy + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

function fbm(x, y, oct = 4) {
  let v = 0, a = 0.5, f = 1;
  for (let i = 0; i < oct; i++) {
    v += noise2D(x * f, y * f) * a;
    a *= 0.5; f *= 2;
  }
  return v;
}

/* ── 砂の丘（PlaneGeometry + ノイズ変位） ── */
function SandDunes() {
  const geo = useRef(null);

  if (!geo.current) {
    const g = new THREE.PlaneGeometry(60, 60, 128, 128);
    const pos = g.attributes.position.array;
    for (let i = 0; i < pos.length; i += 3) {
      const x = pos[i], y = pos[i + 1];
      const dist = Math.sqrt(x * x + y * y);
      let h = fbm(x * 0.06, y * 0.06) * 3;
      h += fbm(x * 0.15 + 5, y * 0.15 + 5) * 1.0;
      const poolFade = Math.min(1, Math.max(0, (dist - 3.2) / 2));
      h = h * poolFade - 0.15 * (1 - poolFade);
      pos[i + 2] = h;
    }
    g.computeVertexNormals();
    g.rotateX(-Math.PI / 2);
    geo.current = g;
  }

  return (
    <mesh geometry={geo.current}>
      <meshStandardMaterial
        color="#D4A76A"
        roughness={0.92}
        metalness={0.0}
        emissive="#8B6914"
        emissiveIntensity={0.03}
      />
    </mesh>
  );
}

/* ── オアシスの泉（歪んだ有機的な形 + クリックで水しぶき + 小魚ジャンプ） ── */
function OasisPool() {
  const [splashActive, setSplashActive] = useState(false);
  const splashRef = useRef();
  const splashDataRef = useRef(null);

  /* 小魚モデル */
  const { scene: fishScene } = useGLTF(FISH_URL);
  const fishGroupRef = useRef();
  const fishDataRef = useRef(null);
  const [fishVisible, setFishVisible] = useState(false);

  const fishClone = useMemo(() => {
    const c = fishScene.clone(true);
    c.traverse((child) => {
      if (child.isMesh && child.material) {
        child.material = child.material.clone();
        child.material.envMapIntensity = 1.0;
      }
    });
    return c;
  }, [fishScene]);

  const fishScale = useMemo(() => fitToSize(fishScene, 0.5), [fishScene]);

  /* 歪んだ泉の形状を生成 */
  const poolGeo = useMemo(() => {
    const shape = new THREE.Shape();
    const segments = 48;
    const baseRadius = 2.8;
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const noise1 = Math.sin(angle * 3) * 0.3;
      const noise2 = Math.cos(angle * 5 + 1.3) * 0.15;
      const noise3 = Math.sin(angle * 7 + 2.7) * 0.1;
      const r = baseRadius + noise1 + noise2 + noise3;
      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * r;
      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }
    const geo = new THREE.ShapeGeometry(shape, 48);
    return geo;
  }, []);

  /* 水しぶきパーティクル（2〜3粒だけ弾ける） */
  const SPLASH_COUNT = 3;
  const splashGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(SPLASH_COUNT * 3);
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return geo;
  }, []);

  const handleSplash = useCallback((e) => {
    e.stopPropagation();
    const point = e.point;

    /* 水しぶきパーティクルの初期化 */
    const velocities = [];
    const positions = splashGeo.attributes.position.array;
    for (let i = 0; i < SPLASH_COUNT; i++) {
      const i3 = i * 3;
      positions[i3] = point.x + (Math.random() - 0.5) * 0.3;
      positions[i3 + 1] = point.y + 0.1;
      positions[i3 + 2] = point.z + (Math.random() - 0.5) * 0.3;
      velocities.push({
        vx: (Math.random() - 0.5) * 1.2,
        vy: 1.5 + Math.random() * 2,
        vz: (Math.random() - 0.5) * 1.2,
      });
    }
    splashGeo.attributes.position.needsUpdate = true;
    splashDataRef.current = { velocities, life: 1.0 };
    setSplashActive(true);

    /* 小魚ジャンプの初期化 */
    fishDataRef.current = {
      x: point.x,
      y: point.y + 0.1,
      z: point.z,
      vx: (Math.random() - 0.5) * 0.8,
      vy: 3.0 + Math.random() * 1.5,
      vz: (Math.random() - 0.5) * 0.8,
      rotSpeed: (Math.random() - 0.5) * 8,
      rot: 0,
      life: 1.0,
    };
    setFishVisible(true);
  }, [splashGeo]);

  useFrame((_, delta) => {
    /* 水しぶきアニメーション */
    if (splashDataRef.current) {
      const data = splashDataRef.current;
      data.life -= delta * 1.2;
      if (data.life <= 0) {
        splashDataRef.current = null;
        setSplashActive(false);
      } else {
        const positions = splashGeo.attributes.position.array;
        for (let i = 0; i < SPLASH_COUNT; i++) {
          const i3 = i * 3;
          const v = data.velocities[i];
          v.vy -= 9.8 * delta;
          positions[i3] += v.vx * delta;
          positions[i3 + 1] += v.vy * delta;
          positions[i3 + 2] += v.vz * delta;
          if (positions[i3 + 1] < 0.05) {
            positions[i3 + 1] = 0.05;
            v.vy *= -0.15;
          }
        }
        splashGeo.attributes.position.needsUpdate = true;
      }
    }

    /* 小魚ジャンプアニメーション */
    if (fishDataRef.current && fishGroupRef.current) {
      const f = fishDataRef.current;
      f.vy -= 9.8 * delta;
      f.x += f.vx * delta;
      f.y += f.vy * delta;
      f.z += f.vz * delta;
      f.rot += f.rotSpeed * delta;
      f.life -= delta * 0.7;

      fishGroupRef.current.position.set(f.x, f.y, f.z);
      /* 進行方向に向けて回転 + 跳ねる回転 */
      fishGroupRef.current.rotation.set(f.rot, Math.atan2(f.vx, f.vz), 0);

      /* 水面以下に落ちたら非表示 */
      if (f.y < -0.1 || f.life <= 0) {
        fishDataRef.current = null;
        setFishVisible(false);
      }
    }
  });

  return (
    <group>
      {/* 泉の水面 */}
      <mesh
        geometry={poolGeo}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.05, 0]}
        onClick={handleSplash}
      >
        <meshPhysicalMaterial
          color="#3aafc9"
          roughness={0.05}
          metalness={0.1}
          transmission={0.4}
          thickness={2}
          ior={1.33}
          clearcoat={1}
          clearcoatRoughness={0.1}
          transparent
          opacity={0.85}
        />
      </mesh>

      {/* 泉の水面にタイトルを表示（水面に張り付く） */}
      <group position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <Html center transform distanceFactor={4.5} style={{ pointerEvents: "none" }}>
          <div style={{ textAlign: "center", userSelect: "none", pointerEvents: "none" }}>
            <h1
              style={{
                fontFamily: "'Noto Serif JP', serif",
                fontSize: "32px",
                fontWeight: 700,
                color: "rgba(255, 248, 231, 0.75)",
                letterSpacing: "0.3em",
                textShadow: "0 0 30px rgba(135, 206, 235, 0.5), 0 0 60px rgba(26, 122, 138, 0.3)",
                margin: 0,
              }}
            >
              OASIS <span style={{ fontSize: "20px", fontWeight: 400 }}>-オアシス-</span>
            </h1>
            <p
              style={{
                fontFamily: "'Noto Serif JP', serif",
                fontSize: "11px",
                fontWeight: 400,
                color: "rgba(196, 218, 230, 0.65)",
                letterSpacing: "0.12em",
                marginTop: "8px",
                textShadow: "0 0 15px rgba(135, 206, 235, 0.4)",
              }}
            >
              誰もがこの場所を求めていた。砂漠で潤いを求めるように。
            </p>
          </div>
        </Html>
      </group>

      {/* 水しぶきパーティクル */}
      {splashActive && (
        <points ref={splashRef} geometry={splashGeo}>
          <pointsMaterial
            color="#a0dff0"
            size={0.15}
            transparent
            opacity={splashDataRef.current ? splashDataRef.current.life * 0.8 : 0}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            sizeAttenuation
          />
        </points>
      )}

      {/* 小魚ジャンプモデル */}
      {fishVisible && (
        <group ref={fishGroupRef}>
          <primitive
            object={fishClone}
            scale={[fishScale, fishScale, fishScale]}
          />
        </group>
      )}
    </group>
  );
}

/* ── キャンピングカー（泉の真後ろ、カメラに正面を向ける） ── */
const CAR_POS = [0, -5]; // [x, z] — 泉の真後ろ

function CampingCar() {
  const { scene } = useGLTF(CAR_URL);

  const { s, y } = useMemo(() => {
    const s = fitToSize(scene, 3.5);
    const groundOff = getGroundOffset(scene, s);
    const sandH = getSandHeight(CAR_POS[0], CAR_POS[1]);
    scene.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        if (child.material) {
          child.material.envMapIntensity = 1.5;
        }
      }
    });
    return { s, y: sandH + groundOff };
  }, [scene]);

  return (
    <primitive
      object={scene}
      position={[CAR_POS[0], y, CAR_POS[1]]}
      rotation={[0, Math.PI, 0]}
      scale={[s, s, s]}
    />
  );
}

/* ── ヤシの木（2本、キャンピングカーの左右） ── */
const PALM_POSITIONS = [[-3.5, -5.5], [3.5, -5.5]]; // [x, z]

function PalmTreeGroup() {
  const { scene } = useGLTF(PALM_URL);

  const baseScale = useMemo(() => fitToSize(scene, 3), [scene]);
  const groundOff = useMemo(() => getGroundOffset(scene, baseScale), [scene, baseScale]);

  const configs = useMemo(() => [
    { pos: [PALM_POSITIONS[0][0], getSandHeight(...PALM_POSITIONS[0]) + groundOff, PALM_POSITIONS[0][1]], rot: [0, 0.5, 0], sFactor: 1.0 },
    { pos: [PALM_POSITIONS[1][0], getSandHeight(...PALM_POSITIONS[1]) + groundOff, PALM_POSITIONS[1][1]], rot: [0, 2.5, 0], sFactor: 1.1 },
  ], [groundOff]);

  return (
    <>
      {configs.map((cfg, i) => (
        <PalmInstance key={i} scene={scene} baseScale={baseScale} {...cfg} />
      ))}
    </>
  );
}

function PalmInstance({ scene, baseScale, pos, rot, sFactor }) {
  const clone = useMemo(() => {
    const c = scene.clone(true);
    c.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        if (child.material) {
          child.material = child.material.clone();
          child.material.envMapIntensity = 1.2;
        }
      }
    });
    return c;
  }, [scene]);

  const s = baseScale * sFactor;

  return (
    <primitive
      object={clone}
      position={pos}
      rotation={rot}
      scale={[s, s, s]}
    />
  );
}

/* ── 切り株メニュー（泉とキャンピングカーの間に配置） ── */
const DEFAULT_STUMP_MENUS = [
  { key: "extract", label: "DNA採取" },
  { key: "settings", label: "環境設定" },
  { key: "export", label: "コード出力" },
];

const STUMP_XZ = [[-1.3, -3], [0, -3.5], [1.3, -3]];

function StumpMenus({ onMenuClick, menus }) {
  const items = menus || DEFAULT_STUMP_MENUS;
  const { scene } = useGLTF(STUMP_URL);
  const baseScale = useMemo(() => fitToSize(scene, 0.8), [scene]);
  const groundOff = useMemo(() => getGroundOffset(scene, baseScale), [scene, baseScale]);

  return (
    <>
      {items.map((m, i) => {
        const xz = STUMP_XZ[i] || [0, -3];
        const y = getSandHeight(xz[0], xz[1]) + groundOff;
        return (
          <StumpButton
            key={m.key}
            scene={scene}
            baseScale={baseScale}
            label={m.label}
            position={[xz[0], y, xz[1]]}
            rotY={i * 1.2}
            onClick={() => onMenuClick(m.key)}
          />
        );
      })}
    </>
  );
}

function StumpButton({ scene, baseScale, label, position, rotY, onClick }) {
  const groupRef = useRef();
  const ringRef = useRef();
  const [hovered, setHovered] = useState(false);

  const clone = useMemo(() => {
    const c = scene.clone(true);
    c.traverse((child) => {
      if (child.isMesh && child.material) {
        child.material = child.material.clone();
        child.material.emissive = new THREE.Color("#FFD700");
        child.material.emissiveIntensity = 0;
      }
    });
    return c;
  }, [scene]);

  useFrame(({ clock }, delta) => {
    const speed = 1 - Math.pow(0.001, delta);
    const t = clock.elapsedTime;

    /* エミッシブグロー */
    const emTarget = hovered ? 0.5 : 0.08;
    clone.traverse((child) => {
      if (child.isMesh && child.material) {
        child.material.emissiveIntensity = THREE.MathUtils.lerp(
          child.material.emissiveIntensity,
          emTarget,
          speed
        );
      }
    });

    /* ホバー浮遊 */
    if (groupRef.current) {
      const targetY = hovered ? position[1] + 0.15 : position[1];
      groupRef.current.position.y = THREE.MathUtils.lerp(
        groupRef.current.position.y,
        targetY,
        speed
      );
    }

    /* 足元リングの回転 + パルス */
    if (ringRef.current) {
      ringRef.current.rotation.z = t * 0.5;
      const pulse = hovered ? 1.3 : 1.0 + Math.sin(t * 2) * 0.08;
      ringRef.current.scale.set(pulse, pulse, 1);
    }
  });

  return (
    <group
      ref={groupRef}
      position={position}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = "pointer"; }}
      onPointerOut={() => { setHovered(false); document.body.style.cursor = "auto"; }}
    >
      <primitive object={clone} rotation={[0, rotY, 0]} scale={[baseScale, baseScale, baseScale]} />

      {/* 足元のゴールドリング — 常時光ってクリック可能を示す */}
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[0.4, 0.55, 32]} />
        <meshBasicMaterial
          color={hovered ? "#FFD700" : "#D4A76A"}
          transparent
          opacity={hovered ? 0.7 : 0.35}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* ホバー時にほんのり光る点光源 */}
      <pointLight
        position={[0, 0.5, 0]}
        color="#FFD700"
        intensity={hovered ? 1.5 : 0.3}
        distance={3}
      />

      {/* 木の看板風ラベル */}
      <Html center position={[0, 1.2, 0]} distanceFactor={7}>
        <div
          onClick={(e) => { e.stopPropagation(); onClick(); }}
          style={{
            padding: "8px 20px",
            background: hovered
              ? "linear-gradient(135deg, rgba(139, 105, 20, 0.9), rgba(180, 140, 50, 0.85))"
              : "linear-gradient(135deg, rgba(139, 105, 20, 0.75), rgba(160, 120, 40, 0.7))",
            border: `2px solid ${hovered ? "#FFD700" : "#C49A6C"}`,
            borderRadius: "6px",
            color: hovered ? "#FFF8E7" : "#F0E0C0",
            fontFamily: "'Noto Serif JP', serif",
            fontSize: "13px",
            fontWeight: 600,
            letterSpacing: "0.2em",
            whiteSpace: "nowrap",
            userSelect: "none",
            cursor: "pointer",
            transition: "all 0.3s ease",
            boxShadow: hovered
              ? "0 0 20px rgba(255, 215, 0, 0.4), 0 4px 12px rgba(0,0,0,0.3)"
              : "0 2px 8px rgba(0,0,0,0.25)",
            transform: hovered ? "scale(1.08)" : "scale(1)",
          }}
        >
          {label}
        </div>
      </Html>
    </group>
  );
}

/* ── モデルプリロード ── */
useGLTF.preload(CAR_URL);
useGLTF.preload(PALM_URL);
useGLTF.preload(STUMP_URL);
useGLTF.preload(FISH_URL);
