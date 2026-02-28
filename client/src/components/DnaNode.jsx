import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";

/**
 * 抽出されたDNAデータを3D空間上のノードとして表示
 */
export default function DnaNode({ dna, index, total }) {
  const meshRef = useRef();

  // 円形配置
  const angle = (index / Math.max(total, 1)) * Math.PI * 2;
  const radius = 3 + Math.floor(index / 8) * 2;
  const x = Math.cos(angle) * radius;
  const z = Math.sin(angle) * radius;
  const y = 1 + (index % 3) * 0.8;

  // ゆっくり浮遊アニメーション
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.position.y =
        y + Math.sin(state.clock.elapsedTime * 0.5 + index) * 0.15;
    }
  });

  // スタイルから色を推定
  const bgColor = dna.styles?.visual?.backgroundColor || "#22d3ee";
  const displayColor =
    bgColor === "rgba(0, 0, 0, 0)" || bgColor === "transparent"
      ? "#22d3ee"
      : bgColor;

  return (
    <group ref={meshRef} position={[x, y, z]}>
      <mesh>
        <boxGeometry args={[0.8, 0.8, 0.8]} />
        <meshStandardMaterial
          color={displayColor}
          emissive={displayColor}
          emissiveIntensity={0.15}
          transparent
          opacity={0.85}
        />
      </mesh>

      {/* ホバー時にタグ名を表示 */}
      <Html
        position={[0, 0.7, 0]}
        center
        style={{ pointerEvents: "none" }}
      >
        <div className="px-2 py-0.5 rounded text-[10px] bg-oasis-surface/90 text-oasis-accent border border-oasis-border whitespace-nowrap backdrop-blur">
          &lt;{dna.tagName}&gt;
        </div>
      </Html>
    </group>
  );
}
