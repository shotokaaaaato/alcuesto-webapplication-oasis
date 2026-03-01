import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Text, Float, Environment, MeshTransmissionMaterial } from "@react-three/drei";
import * as THREE from "three";

const API = import.meta.env.VITE_API_URL || "http://localhost:4000";

/* ═══════════════════════════════════════════
   3D コンポーネント群
   ═══════════════════════════════════════════ */

/** 3D 棒グラフ 1本 */
function Bar({ position, height, color, label, value, maxH }) {
  const meshRef = useRef();
  const [hovered, setHovered] = useState(false);
  const targetH = (height / maxH) * 4 + 0.2;

  useFrame(() => {
    if (!meshRef.current) return;
    meshRef.current.scale.y = THREE.MathUtils.lerp(meshRef.current.scale.y, targetH, 0.06);
  });

  return (
    <group position={position}>
      <mesh
        ref={meshRef}
        scale={[1, 0.01, 1]}
        position={[0, 0, 0]}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <boxGeometry args={[0.5, 1, 0.5]} />
        <meshStandardMaterial
          color={hovered ? "#FFD700" : color}
          metalness={0.3}
          roughness={0.4}
          emissive={hovered ? "#FFD700" : color}
          emissiveIntensity={hovered ? 0.4 : 0.1}
        />
      </mesh>
      <Text
        position={[0, -0.4, 0]}
        fontSize={0.2}
        color="#C49A6C"
        anchorY="top"
        rotation={[-Math.PI / 4, 0, 0]}
      >
        {label}
      </Text>
      {hovered && (
        <Text position={[0, targetH + 0.3, 0]} fontSize={0.22} color="#FFD700" anchorY="bottom">
          {`${value}`}
        </Text>
      )}
    </group>
  );
}

/** デザイン・スタッツ・エリア — フォントサイズ 3D 棒グラフ */
function DesignStatsArea({ fontSizes, colors }) {
  const maxCount = Math.max(...fontSizes.map((f) => f.count), 1);

  return (
    <group position={[-6, 0, 0]}>
      {/* エリアタイトル */}
      <Text position={[0, 5.5, 0]} fontSize={0.4} color="#8B6914" fontWeight="bold">
        Design Stats
      </Text>
      <Text position={[0, 5, 0]} fontSize={0.2} color="#C49A6C">
        Font Size Distribution
      </Text>

      {/* フォントサイズ棒グラフ */}
      {fontSizes.map((f, i) => (
        <Bar
          key={f.size}
          position={[i * 0.7 - (fontSizes.length * 0.7) / 2, 0, 0]}
          height={f.count}
          maxH={maxCount}
          color={`hsl(${35 + i * 8}, 70%, ${55 + i * 2}%)`}
          label={`${f.size}px`}
          value={f.count}
        />
      ))}

      {/* カラーパレットの球体 */}
      {colors.slice(0, 10).map((c, i) => (
        <ColorSphere
          key={i}
          position={[
            Math.cos((i / 10) * Math.PI * 2) * 2.5,
            3.5,
            Math.sin((i / 10) * Math.PI * 2) * 2.5,
          ]}
          color={c.color}
          count={c.count}
          totalMax={Math.max(...colors.map((x) => x.count), 1)}
        />
      ))}
    </group>
  );
}

/** カラー球 */
function ColorSphere({ position, color, count, totalMax }) {
  const ref = useRef();
  const [hovered, setHovered] = useState(false);
  const radius = 0.15 + (count / totalMax) * 0.4;

  // CSS rgb() をパースして Three.js で使える形に変換
  const threeColor = useMemo(() => {
    try {
      return new THREE.Color(color);
    } catch {
      return new THREE.Color("#888888");
    }
  }, [color]);

  useFrame((_, delta) => {
    if (ref.current) {
      ref.current.rotation.y += delta * 0.3;
    }
  });

  return (
    <Float speed={2} floatIntensity={0.3}>
      <mesh
        ref={ref}
        position={position}
        scale={hovered ? 1.3 : 1}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <sphereGeometry args={[radius, 16, 16]} />
        <meshStandardMaterial
          color={threeColor}
          metalness={0.2}
          roughness={0.3}
          emissive={threeColor}
          emissiveIntensity={hovered ? 0.5 : 0.15}
        />
      </mesh>
      {hovered && (
        <Text position={[position[0], position[1] + radius + 0.3, position[2]]} fontSize={0.18} color="#FFD700">
          {`${color} (${count})`}
        </Text>
      )}
    </Float>
  );
}

/** コーディング・プロファイル・エリア — レイアウト傾向をデータノードで表示 */
function CodingProfileArea({ layoutStats, widthDistribution, gapDistribution }) {
  const total = layoutStats.total || 1;

  const nodes = [
    { label: "flex", value: layoutStats.flex, color: "#3aafc9", ratio: layoutStats.flex / total },
    { label: "grid", value: layoutStats.grid, color: "#a259ff", ratio: layoutStats.grid / total },
    { label: "block", value: layoutStats.block, color: "#ef4444", ratio: layoutStats.block / total },
    { label: "inline", value: layoutStats.inline, color: "#f59e0b", ratio: layoutStats.inline / total },
  ];

  return (
    <group position={[0, 0, -4]}>
      <Text position={[0, 5.5, 0]} fontSize={0.4} color="#8B6914" fontWeight="bold">
        Coding Profile
      </Text>
      <Text position={[0, 5, 0]} fontSize={0.2} color="#C49A6C">
        Layout Usage
      </Text>

      {/* レイアウトモード — トーラスでリング表示 */}
      {nodes.map((n, i) => (
        <LayoutNode
          key={n.label}
          position={[Math.cos((i / 4) * Math.PI * 2) * 2, 2.5, Math.sin((i / 4) * Math.PI * 2) * 2]}
          label={n.label}
          value={n.value}
          ratio={n.ratio}
          color={n.color}
        />
      ))}

      {/* 中央のコアノード */}
      <Float speed={1.5} floatIntensity={0.5}>
        <mesh position={[0, 2.5, 0]}>
          <icosahedronGeometry args={[0.6, 1]} />
          <meshStandardMaterial
            color="#D4A76A"
            metalness={0.5}
            roughness={0.2}
            wireframe
            emissive="#D4A76A"
            emissiveIntensity={0.3}
          />
        </mesh>
      </Float>

      {/* 幅の分布 — 地面に並べた平たいブロック */}
      {widthDistribution.slice(0, 6).map((w, i) => (
        <WidthBlock
          key={w.width}
          position={[i * 1.2 - 3, 0, 2]}
          width={w.width}
          count={w.count}
          maxCount={Math.max(...widthDistribution.map((x) => x.count), 1)}
        />
      ))}
    </group>
  );
}

/** レイアウトノード（トーラス＋ラベル） */
function LayoutNode({ position, label, value, ratio, color }) {
  const ref = useRef();
  const [hovered, setHovered] = useState(false);

  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.x += delta * 0.5;
  });

  const scale = 0.4 + ratio * 1.2;

  return (
    <group position={position}>
      <mesh
        ref={ref}
        scale={hovered ? scale * 1.2 : scale}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <torusGeometry args={[0.5, 0.15, 12, 24]} />
        <meshStandardMaterial
          color={color}
          metalness={0.4}
          roughness={0.3}
          emissive={color}
          emissiveIntensity={hovered ? 0.5 : 0.2}
        />
      </mesh>
      <Text position={[0, -0.8 * scale, 0]} fontSize={0.2} color={color}>
        {label}
      </Text>
      {hovered && (
        <Text position={[0, 0.9 * scale, 0]} fontSize={0.2} color="#FFD700">
          {`${value} (${(ratio * 100).toFixed(0)}%)`}
        </Text>
      )}
    </group>
  );
}

/** 幅分布ブロック */
function WidthBlock({ position, width, count, maxCount }) {
  const [hovered, setHovered] = useState(false);
  const h = 0.2 + (count / maxCount) * 1.5;

  return (
    <group position={position}>
      <mesh
        position={[0, h / 2, 0]}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <boxGeometry args={[0.8, h, 0.8]} />
        <meshStandardMaterial
          color={hovered ? "#FFD700" : "#5a9828"}
          metalness={0.2}
          roughness={0.5}
          emissive={hovered ? "#FFD700" : "#5a9828"}
          emissiveIntensity={0.1}
        />
      </mesh>
      <Text position={[0, -0.15, 0]} fontSize={0.14} color="#C49A6C" rotation={[-Math.PI / 4, 0, 0]}>
        {`${width}px`}
      </Text>
      {hovered && (
        <Text position={[0, h + 0.3, 0]} fontSize={0.18} color="#FFD700">
          {`${count}`}
        </Text>
      )}
    </group>
  );
}

/** パーツ・インベントリ・エリア — カテゴリをオブジェクトの密度/大きさで表現 */
function PartsInventoryArea({ categories, tagDistribution }) {
  const maxCat = Math.max(...categories.map((c) => c.count), 1);

  return (
    <group position={[6, 0, 0]}>
      <Text position={[0, 5.5, 0]} fontSize={0.4} color="#8B6914" fontWeight="bold">
        Parts Inventory
      </Text>
      <Text position={[0, 5, 0]} fontSize={0.2} color="#C49A6C">
        Category & Tag Distribution
      </Text>

      {/* カテゴリー — 浮遊するジオメトリ */}
      {categories.map((cat, i) => {
        const angle = (i / Math.max(categories.length, 1)) * Math.PI * 2;
        const r = 2;
        const scale = 0.3 + (cat.count / maxCat) * 1.0;
        return (
          <CategoryObject
            key={cat.category}
            position={[Math.cos(angle) * r, 3, Math.sin(angle) * r]}
            category={cat.category}
            count={cat.count}
            scale={scale}
            index={i}
          />
        );
      })}

      {/* HTML タグ分布 — 地面のフラットタイル */}
      {tagDistribution.slice(0, 8).map((t, i) => {
        const col = i % 4;
        const row = Math.floor(i / 4);
        return (
          <TagTile
            key={t.tag}
            position={[col * 1.1 - 1.6, 0.05, row * 1.1]}
            tag={t.tag}
            count={t.count}
            maxCount={Math.max(...tagDistribution.map((x) => x.count), 1)}
          />
        );
      })}
    </group>
  );
}

const CATEGORY_COLORS = {
  FV: "#3aafc9",
  CTA: "#ef4444",
  header: "#7ab83e",
  footer: "#6B7280",
  generated: "#a259ff",
  other: "#f59e0b",
};

/** カテゴリオブジェクト（浮遊する多面体） */
function CategoryObject({ position, category, count, scale, index }) {
  const ref = useRef();
  const [hovered, setHovered] = useState(false);
  const color = CATEGORY_COLORS[category] || `hsl(${index * 50}, 60%, 50%)`;

  useFrame((_, delta) => {
    if (ref.current) {
      ref.current.rotation.y += delta * 0.4;
      ref.current.rotation.z += delta * 0.2;
    }
  });

  const geometries = [
    <dodecahedronGeometry args={[0.4, 0]} />,
    <octahedronGeometry args={[0.4, 0]} />,
    <icosahedronGeometry args={[0.4, 0]} />,
    <tetrahedronGeometry args={[0.5, 0]} />,
  ];

  return (
    <Float speed={2} floatIntensity={0.5}>
      <group position={position}>
        <mesh
          ref={ref}
          scale={hovered ? scale * 1.3 : scale}
          onPointerOver={() => setHovered(true)}
          onPointerOut={() => setHovered(false)}
        >
          {geometries[index % geometries.length]}
          <meshStandardMaterial
            color={color}
            metalness={0.4}
            roughness={0.3}
            emissive={color}
            emissiveIntensity={hovered ? 0.5 : 0.15}
          />
        </mesh>
        <Text position={[0, -0.6 * scale, 0]} fontSize={0.18} color={color}>
          {category}
        </Text>
        {hovered && (
          <Text position={[0, 0.7 * scale, 0]} fontSize={0.2} color="#FFD700">
            {`${count} items`}
          </Text>
        )}
      </group>
    </Float>
  );
}

/** タグタイル */
function TagTile({ position, tag, count, maxCount }) {
  const [hovered, setHovered] = useState(false);
  const intensity = 0.3 + (count / maxCount) * 0.7;

  return (
    <group position={position}>
      <mesh
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <boxGeometry args={[0.9, 0.08, 0.9]} />
        <meshStandardMaterial
          color={`hsl(35, 60%, ${40 + intensity * 30}%)`}
          metalness={0.1}
          roughness={0.6}
          emissive={hovered ? "#FFD700" : "#000000"}
          emissiveIntensity={hovered ? 0.3 : 0}
        />
      </mesh>
      <Text position={[0, 0.1, 0]} fontSize={0.15} color="#5A4E3A" rotation={[-Math.PI / 2, 0, 0]}>
        {`<${tag}>`}
      </Text>
      {hovered && (
        <Text position={[0, 0.5, 0]} fontSize={0.2} color="#FFD700">
          {`${count}`}
        </Text>
      )}
    </group>
  );
}

/** 地面グリッド */
function Ground() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
      <planeGeometry args={[30, 20]} />
      <meshStandardMaterial color="#E8D5B0" metalness={0} roughness={0.9} />
    </mesh>
  );
}

/** エリア境界線 */
function AreaDividers() {
  const material = new THREE.LineBasicMaterial({ color: "#D4A76A", transparent: true, opacity: 0.3 });

  return (
    <group>
      {[-3, 3].map((x) => (
        <line key={x}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              array={new Float32Array([x, 0, -8, x, 0, 8])}
              count={2}
              itemSize={3}
            />
          </bufferGeometry>
          <lineBasicMaterial color="#D4A76A" transparent opacity={0.3} />
        </line>
      ))}
    </group>
  );
}

/* ═══════════════════════════════════════════
   メインページ
   ═══════════════════════════════════════════ */

export default function AnalyticsPage() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeArea, setActiveArea] = useState(null); // 'design' | 'coding' | 'parts' | null

  useEffect(() => {
    const token = localStorage.getItem("oasis_token");
    fetch(`${API}/api/analytics/stats`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setData(json.data);
        else setError(json.error || "データの取得に失敗しました");
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const areas = [
    { id: "design", label: "Design Stats", icon: "🎨", color: "from-[#D4A76A] to-[#B8944C]" },
    { id: "coding", label: "Coding Profile", icon: "⚡", color: "from-[#3aafc9] to-[#2a8fa9]" },
    { id: "parts", label: "Parts Inventory", icon: "🧩", color: "from-[#a259ff] to-[#7c3aed]" },
  ];

  return (
    <div
      className="h-screen w-screen bg-[#FAF3E6] flex flex-col"
      style={{ fontFamily: "'Noto Sans JP', 'Hiragino Sans', sans-serif", fontSize: 15 }}
    >
      {/* ヘッダー */}
      <header className="flex-shrink-0 bg-[#FAF3E6]/80 backdrop-blur-xl border-b border-[#E8D5B0]/50 z-50">
        <div className="max-w-full mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/dashboard")}
              className="px-3 py-1.5 text-xs rounded-full border border-[#D4A76A]/30 bg-[#FFF8E7]/80 text-[#8B6914] hover:bg-[#FFF8E7] transition-all"
            >
              ← ダッシュボード
            </button>
            <div>
              <h1
                className="text-lg font-bold text-[#8B6914] tracking-widest"
                style={{ fontFamily: "'Noto Serif JP', serif" }}
              >
                OASIS Analytics
              </h1>
              <p className="text-[12px] text-[#C49A6C] tracking-wide">
                Design Analyzer — 制作傾向の可視化
              </p>
            </div>
          </div>

          {/* サマリーバッジ */}
          {data?.summary && (
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 text-[12px] rounded-full bg-[#D4A76A]/10 text-[#8B6914] border border-[#D4A76A]/30">
                Designs: {data.summary.totalDnaRecords} records
              </span>
              <span className="px-3 py-1 text-[12px] rounded-full bg-[#D4A76A]/10 text-[#8B6914] border border-[#D4A76A]/30">
                Elements: {data.summary.totalElements}
              </span>
              <span className="px-3 py-1 text-[12px] rounded-full bg-[#D4A76A]/10 text-[#8B6914] border border-[#D4A76A]/30">
                Templates: {data.summary.registeredTemplates}
              </span>
            </div>
          )}
        </div>
      </header>

      {/* エリア切り替えタブ */}
      <div className="flex-shrink-0 px-6 py-2 flex gap-2 bg-[#FAF3E6]/60 border-b border-[#E8D5B0]/30">
        <button
          onClick={() => setActiveArea(null)}
          className={`px-4 py-1.5 text-xs rounded-full border transition-all ${
            activeArea === null
              ? "border-[#D4A76A] bg-[#D4A76A]/20 text-[#8B6914]"
              : "border-[#D4A76A]/30 text-[#C49A6C] hover:text-[#8B6914]"
          }`}
        >
          All Areas
        </button>
        {areas.map((a) => (
          <button
            key={a.id}
            onClick={() => setActiveArea(activeArea === a.id ? null : a.id)}
            className={`px-4 py-1.5 text-xs rounded-full border transition-all ${
              activeArea === a.id
                ? "border-[#D4A76A] bg-[#D4A76A]/20 text-[#8B6914]"
                : "border-[#D4A76A]/30 text-[#C49A6C] hover:text-[#8B6914]"
            }`}
          >
            {a.icon} {a.label}
          </button>
        ))}
      </div>

      {/* 3D キャンバス */}
      <div className="flex-1 relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center z-10 bg-[#FAF3E6]/80">
            <p className="text-[#8B6914] text-sm tracking-widest animate-pulse">Loading analytics...</p>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center z-10 bg-[#FAF3E6]/80">
            <div className="text-center">
              <p className="text-[#ef4444] text-sm mb-2">{error}</p>
              <p className="text-[#C49A6C] text-xs">
                ライブラリにデータがまだありません。Figma インポートからデータを追加してください。
              </p>
            </div>
          </div>
        )}

        {data && !loading && (
          <Canvas
            camera={{ position: [0, 8, 14], fov: 50 }}
            shadows
            dpr={[1, 1.5]}
            gl={{ antialias: true }}
          >
            <color attach="background" args={["#FAF3E6"]} />
            <fog attach="fog" args={["#FAF3E6", 20, 40]} />

            <ambientLight intensity={0.6} />
            <directionalLight position={[8, 12, 5]} intensity={1} castShadow />
            <pointLight position={[-6, 6, -3]} intensity={0.4} color="#D4A76A" />
            <pointLight position={[6, 6, 3]} intensity={0.4} color="#3aafc9" />

            <Ground />

            {(activeArea === null || activeArea === "design") && (
              <DesignStatsArea
                fontSizes={data.designStats.fontSizes}
                colors={data.designStats.colors}
              />
            )}

            {(activeArea === null || activeArea === "coding") && (
              <CodingProfileArea
                layoutStats={data.codingProfile.layoutStats}
                widthDistribution={data.codingProfile.widthDistribution}
                gapDistribution={data.codingProfile.gapDistribution}
              />
            )}

            {(activeArea === null || activeArea === "parts") && (
              <PartsInventoryArea
                categories={data.partsInventory.categories}
                tagDistribution={data.partsInventory.tagDistribution}
              />
            )}

            <OrbitControls
              enableDamping
              dampingFactor={0.08}
              minDistance={5}
              maxDistance={25}
              maxPolarAngle={Math.PI / 2.2}
              target={
                activeArea === "design"
                  ? [-6, 2, 0]
                  : activeArea === "coding"
                  ? [0, 2, -4]
                  : activeArea === "parts"
                  ? [6, 2, 0]
                  : [0, 2, 0]
              }
            />
          </Canvas>
        )}

        {/* 2D オーバーレイ — スタッツサマリーカード */}
        {data && !loading && (
          <div className="absolute bottom-4 left-4 right-4 flex gap-3 pointer-events-none">
            {/* デザインスタッツ */}
            {(activeArea === null || activeArea === "design") && (
              <div className="flex-1 bg-white/70 backdrop-blur-md rounded-xl border border-[#E8D5B0]/50 p-3 pointer-events-auto">
                <h4 className="text-[12px] font-bold text-[#8B6914] mb-1">Top Fonts</h4>
                <div className="flex flex-wrap gap-1">
                  {data.designStats.fontFamilies.slice(0, 4).map((f) => (
                    <span key={f.family} className="px-2 py-0.5 text-[12px] bg-[#D4A76A]/10 rounded-full text-[#5A4E3A]">
                      {f.family} ({f.count})
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* コーディングプロファイル */}
            {(activeArea === null || activeArea === "coding") && (
              <div className="flex-1 bg-white/70 backdrop-blur-md rounded-xl border border-[#E8D5B0]/50 p-3 pointer-events-auto">
                <h4 className="text-[12px] font-bold text-[#8B6914] mb-1">Layout Mix</h4>
                <div className="flex gap-2 text-[12px] text-[#5A4E3A]">
                  <span className="text-[#3aafc9]">flex {data.codingProfile.layoutStats.flex}</span>
                  <span className="text-[#a259ff]">grid {data.codingProfile.layoutStats.grid}</span>
                  <span className="text-[#ef4444]">block {data.codingProfile.layoutStats.block}</span>
                </div>
              </div>
            )}

            {/* パーツインベントリ */}
            {(activeArea === null || activeArea === "parts") && (
              <div className="flex-1 bg-white/70 backdrop-blur-md rounded-xl border border-[#E8D5B0]/50 p-3 pointer-events-auto">
                <h4 className="text-[12px] font-bold text-[#8B6914] mb-1">Templates</h4>
                <p className="text-[12px] text-[#5A4E3A]">
                  {data.summary.registeredTemplates} registered / {data.summary.totalTemplates} total
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
