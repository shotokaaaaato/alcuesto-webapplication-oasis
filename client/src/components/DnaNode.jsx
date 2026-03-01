import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * インタラクティブデザインノード
 * - Standard: マットな陶器風、ホバーで浮上
 * - Forest: 翡翠（ひすい）風 MeshPhysicalMaterial、ホバーで波打ち
 */

const WARM_PALETTE = [
  "#F5F0E8", "#EDE4D4", "#F0E6D3", "#E8DCC8",
  "#FFF8F0", "#F2E8D8", "#FAF0E4", "#E8E0D4",
];

// 翡翠の色彩パレット — 深緑・若翠・碧玉・白翡翠
const JADE_PALETTE = [
  "#1a7a4a", "#2a8a5a", "#0d6a3a", "#3a9a6a",
  "#1a6a5a", "#2a7a6a", "#0d5a4a", "#4aaa7a",
];

export default function DnaNode({ dna, index, total, biome = "standard", selected, onSelect }) {
  const groupRef = useRef();
  const matRef = useRef();
  const [hovered, setHovered] = useState(false);
  const isForest = biome === "forest";

  const smooth = useRef({ scale: 1, emissive: isForest ? 0.25 : 0.02, yOffset: 0 });

  // 円形配置
  const angle = (index / Math.max(total, 1)) * Math.PI * 2;
  const radius = 3 + Math.floor(index / 8) * 2;
  const baseX = Math.cos(angle) * radius;
  const baseZ = Math.sin(angle) * radius;
  const baseY = isForest ? 1.5 + (index % 4) * 1.0 : 1 + (index % 3) * 0.8;

  // Standard: ウォームパレット / Forest: 翡翠パレット
  const nodeColor = isForest
    ? JADE_PALETTE[index % JADE_PALETTE.length]
    : WARM_PALETTE[index % WARM_PALETTE.length];
  const emissiveColor = isForest ? "#0a3a20" : "#D4C4A8";

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const s = smooth.current;
    const lerp = THREE.MathUtils.lerp;
    const lerpFactor = 1 - Math.pow(0.001, delta);

    // ターゲット値
    const targetScale = selected ? 1.15 : hovered ? 1.08 : 1.0;
    const targetEmissive = isForest
      ? (selected ? 0.6 : hovered ? 0.45 : 0.25)
      : (selected ? 0.2 : hovered ? 0.1 : 0.02);
    const targetYOffset = isForest ? 0 : (selected ? 0.3 : hovered ? 0.2 : 0);

    // スムーズ補間
    s.scale = lerp(s.scale, targetScale, lerpFactor);
    s.emissive = lerp(s.emissive, targetEmissive, lerpFactor);
    s.yOffset = lerp(s.yOffset, targetYOffset, lerpFactor);

    if (groupRef.current) {
      if (isForest) {
        // Forest: 浮遊 + ホバー時は生き物のように波打つ
        groupRef.current.position.y = baseY + Math.sin(t * 0.3 + index * 1.2) * 0.4;
        groupRef.current.position.x = baseX + Math.sin(t * 0.15 + index * 0.8) * 0.3;
        groupRef.current.position.z = baseZ + Math.cos(t * 0.2 + index * 0.6) * 0.2;
        groupRef.current.rotation.y = t * 0.1 + index;

        if (hovered || selected) {
          // 有機的な波打ちアニメーション
          const wave = Math.sin(t * 3 + index) * 0.04;
          groupRef.current.scale.set(
            s.scale + wave,
            s.scale - wave * 0.5,
            s.scale + wave * 0.7
          );
        } else {
          groupRef.current.scale.setScalar(s.scale);
        }
      } else {
        // Standard: ホバーで浮き上がり
        groupRef.current.position.y = baseY + s.yOffset + Math.sin(t * 0.5 + index) * 0.1;
        groupRef.current.scale.setScalar(s.scale);
      }
    }

    if (matRef.current) {
      matRef.current.emissiveIntensity = s.emissive;
    }
  });

  return (
    <group ref={groupRef} position={[baseX, baseY, baseZ]}>
      <mesh
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = "pointer"; }}
        onPointerOut={() => { setHovered(false); document.body.style.cursor = "auto"; }}
        onClick={(e) => {
          e.stopPropagation();
          // カメラフォーカス用に基本位置を付与
          onSelect({ ...dna, _position: [baseX, baseY, baseZ] });
        }}
      >
        {isForest
          ? <icosahedronGeometry args={[0.5, 2]} />
          : <boxGeometry args={[0.8, 0.8, 0.8]} />
        }

        {/* Forest: 翡翠風 MeshPhysicalMaterial */}
        {isForest ? (
          <meshPhysicalMaterial
            ref={matRef}
            color={nodeColor}
            emissive={emissiveColor}
            emissiveIntensity={0.25}
            transmission={0.4}
            thickness={1.2}
            ior={1.5}
            roughness={0.15}
            metalness={0}
            transparent
            opacity={0.9}
            clearcoat={0.3}
            clearcoatRoughness={0.2}
          />
        ) : (
          <meshStandardMaterial
            ref={matRef}
            color={nodeColor}
            emissive={emissiveColor}
            emissiveIntensity={0.02}
            transparent
            opacity={selected ? 0.95 : 0.95}
            roughness={0.85}
            metalness={0.0}
          />
        )}
      </mesh>

      {/* 選択リング */}
      {selected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]}>
          <ringGeometry args={[0.5, 0.65, 32]} />
          <meshBasicMaterial
            color={isForest ? "#7ab83e" : "#C49A6C"}
            transparent
            opacity={isForest ? 0.5 : 0.4}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      )}

      {/* Forest: 翡翠のオーラ */}
      {isForest && (
        <mesh scale={[1.3, 1.3, 1.3]}>
          <sphereGeometry args={[0.6, 16, 16]} />
          <meshBasicMaterial color="#4aaa7a" transparent opacity={hovered ? 0.12 : 0.04} depthWrite={false} blending={THREE.AdditiveBlending} />
        </mesh>
      )}
    </group>
  );
}
