import { useRef } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { OrbitControls, Environment, ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import DnaNode from "./DnaNode";
import ForestBiome from "./ForestBiome";
import DesertBiome from "./DesertBiome";

const BIOME_CONFIG = {
  standard: { fogColor: "#E8C88C", fogNear: 15, fogFar: 50, envPreset: "sunset", bgColor: "#F0C878" },
  forest:   { fogColor: "#001a08", fogNear: 6,  fogFar: 24, envPreset: "park",   bgColor: "#001a08" },
};

/* カメラ目標位置 — メニューパネルごとに異なるアングル */
const CAMERA_GOALS = {
  default:  { cam: null,            look: [0, 0.5, 0] },
  extract:  { cam: [2, 2.5, 5],    look: [0, 0.3, 0] },
  settings: { cam: [-3, 3, 6],     look: [0, 0.5, 0] },
  export:   { cam: [3, 2, 4],      look: [0, 0.3, -1] },
};

export default function Canvas3D({ dnaData, biome = "standard", selectedId, onSelectDna, activePanel, onMenuClick, stumpMenus }) {
  const config = BIOME_CONFIG[biome] || BIOME_CONFIG.standard;
  const isForest = biome === "forest";

  // カメラフォーカス — ノード選択 or メニュー操作
  const selectedDna = dnaData.find(d => d.id === selectedId);
  const focusPos = selectedDna?._position || null;
  const goal = CAMERA_GOALS[activePanel] || CAMERA_GOALS.default;
  const lookTarget = focusPos || goal.look;
  const cameraGoal = goal.cam;

  return (
    <Canvas
      camera={{ position: [0, 5, 10], fov: 50 }}
      style={{ width: "100%", height: "100%" }}
      onPointerMissed={() => onSelectDna && onSelectDna(null)}
    >
      {/* シーン背景 */}
      <color attach="background" args={[config.bgColor]} />

      {/* Standard: 砂漠のオアシス */}
      {!isForest && <DesertBiome onMenuClick={onMenuClick} stumpMenus={stumpMenus} />}

      {/* Forest: 幻想の森 */}
      {isForest && <ForestBiome />}

      {/* 接地影 */}
      <ContactShadows
        position={[0, -0.01, 0]}
        opacity={isForest ? 0.4 : 0.2}
        scale={20}
        blur={isForest ? 1.5 : 3}
        far={4}
        color={isForest ? "#001a00" : "#8B6914"}
      />

      {/* DNA ノード */}
      {dnaData.map((dna, i) => (
        <DnaNode
          key={dna.id}
          dna={dna}
          index={i}
          total={dnaData.length}
          biome={biome}
          selected={selectedId === dna.id}
          onSelect={(d) => onSelectDna && onSelectDna(d)}
        />
      ))}

      {/* Forest: プレースホルダー */}
      {isForest && dnaData.length === 0 && <ForestPlaceholder />}

      {/* カメラアニメーター */}
      <CameraAnimator lookTarget={lookTarget} cameraGoal={cameraGoal} />

      <OrbitControls makeDefault enableDamping dampingFactor={0.05} minDistance={3} maxDistance={30} />
      <Environment preset={config.envPreset} />
      <fog attach="fog" args={[config.fogColor, config.fogNear, config.fogFar]} />
    </Canvas>
  );
}

/**
 * カメラアニメーター — 泉の奥へ吸い込まれるようなスムーズ移動
 */
function CameraAnimator({ lookTarget, cameraGoal }) {
  const { camera } = useThree();
  const controls = useThree(s => s.controls);
  const target = useRef(new THREE.Vector3(0, 0.5, 0));
  const camPos = useRef(null);

  useFrame(() => {
    if (!controls) return;

    if (lookTarget) {
      target.current.set(lookTarget[0], lookTarget[1], lookTarget[2]);
    } else {
      target.current.set(0, 0.5, 0);
    }
    controls.target.lerp(target.current, 0.03);

    if (cameraGoal) {
      if (!camPos.current) camPos.current = new THREE.Vector3();
      camPos.current.set(cameraGoal[0], cameraGoal[1], cameraGoal[2]);
      camera.position.lerp(camPos.current, 0.03);
    }

    controls.update();
  });

  return null;
}

/**
 * Forest プレースホルダー — 翡翠オーブ
 */
function ForestPlaceholder() {
  const ref = useRef();
  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.y = clock.elapsedTime * 0.15;
  });

  return (
    <mesh ref={ref} position={[0, 1.5, 0]}>
      <icosahedronGeometry args={[1, 3]} />
      <meshPhysicalMaterial
        color="#1a7a4a"
        emissive="#0a3a20"
        emissiveIntensity={0.3}
        transmission={0.6}
        thickness={1.5}
        ior={1.5}
        roughness={0.1}
        metalness={0}
        clearcoat={0.5}
        clearcoatRoughness={0.15}
      />
    </mesh>
  );
}
