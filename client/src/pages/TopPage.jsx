import { useNavigate } from "react-router-dom";
import Canvas3D from "../components/Canvas3D";

/**
 * TOPページ — 砂漠のオアシス3Dシーン
 * 切り株メニュー: ログイン / 新規登録 / オアシスについて
 */
export default function TopPage() {
  const navigate = useNavigate();

  const menus = [
    { key: "login", label: "ログイン" },
    { key: "register", label: "新規登録" },
    { key: "about", label: "オアシスについて" },
  ];

  function handleMenuClick(key) {
    if (key === "login") {
      navigate("/login");
    } else if (key === "register") {
      navigate("/login?mode=register");
    } else if (key === "about") {
      navigate("/about");
    }
  }

  return (
    <div
      className="h-screen w-screen bg-[#F0C878]"
      style={{ fontFamily: "'Noto Sans JP', 'Hiragino Sans', sans-serif" }}
    >
      <Canvas3D
        dnaData={[]}
        biome="standard"
        selectedId={null}
        onSelectDna={() => {}}
        activePanel={null}
        onMenuClick={handleMenuClick}
        stumpMenus={menus}
      />
    </div>
  );
}
