import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid, Environment } from "@react-three/drei";
import DnaNode from "./DnaNode";

export default function Canvas3D({ dnaData }) {
  return (
    <Canvas
      camera={{ position: [0, 5, 10], fov: 50 }}
      style={{ width: "100%", height: "100%" }}
    >
      {/* 環境光 */}
      <ambientLight intensity={0.3} />
      <directionalLight position={[5, 8, 5]} intensity={0.6} color="#22d3ee" />
      <pointLight position={[-5, 3, -5]} intensity={0.4} color="#34d399" />

      {/* グリッド (テラリウムの床) */}
      <Grid
        args={[20, 20]}
        position={[0, -0.01, 0]}
        cellSize={1}
        cellColor="#1e1e2e"
        sectionSize={5}
        sectionColor="#22d3ee"
        fadeDistance={25}
        infiniteGrid
      />

      {/* 抽出されたDNAノードを配置 */}
      {dnaData.map((dna, i) => (
        <DnaNode key={dna.id} dna={dna} index={i} total={dnaData.length} />
      ))}

      {/* プレースホルダー：データ未取得時の中央オブジェクト */}
      {dnaData.length === 0 && <PlaceholderOrb />}

      <OrbitControls
        enableDamping
        dampingFactor={0.05}
        minDistance={3}
        maxDistance={30}
      />

      {/* 暗めの環境マップ */}
      <Environment preset="night" />
      <fog attach="fog" args={["#0a0a0f", 15, 35]} />
    </Canvas>
  );
}

/** データ未取得時に表示する発光オーブ */
function PlaceholderOrb() {
  return (
    <mesh position={[0, 1.5, 0]}>
      <icosahedronGeometry args={[1, 3]} />
      <meshStandardMaterial
        color="#22d3ee"
        emissive="#22d3ee"
        emissiveIntensity={0.3}
        wireframe
        transparent
        opacity={0.6}
      />
    </mesh>
  );
}
