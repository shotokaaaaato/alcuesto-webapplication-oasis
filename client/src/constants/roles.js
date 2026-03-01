export const ROLES = [
  { value: "header", label: "ヘッダー", color: "#3b82f6" },
  { value: "fv", label: "ファーストビュー", color: "#f59e0b" },
  { value: "section", label: "セクション", color: "#7c3aed" },
  { value: "footer", label: "フッター", color: "#6b7280" },
  { value: "nav", label: "ナビゲーション", color: "#14b8a6" },
  { value: "cta", label: "CTA", color: "#ef4444" },
  { value: "card", label: "カード", color: "#f97316" },
  { value: "other", label: "その他", color: "#8b5cf6" },
];

export function getRoleColor(role) {
  return ROLES.find((r) => r.value === role)?.color || "#7c3aed";
}

export function getRoleLabel(role) {
  return ROLES.find((r) => r.value === role)?.label || role;
}
