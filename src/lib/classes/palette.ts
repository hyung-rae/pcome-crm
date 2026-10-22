// Fixed class colors. Text colors keep at least 4.5:1 contrast on their backgrounds.
export const CLASS_PALETTE = {
  orange: { label: "오렌지", background: "#FFF0EB", border: "#D63E20", text: "#8A2A15" },
  red: { label: "레드", background: "#FDECEC", border: "#C92A2A", text: "#8B1D1D" },
  pink: { label: "핑크", background: "#FCEBF3", border: "#C2255C", text: "#86193F" },
  violet: { label: "바이올렛", background: "#F1EDFC", border: "#6741D9", text: "#45288F" },
  blue: { label: "블루", background: "#E9F2FD", border: "#1C7ED6", text: "#174E86" },
  teal: { label: "틸", background: "#E6F6F4", border: "#0C8599", text: "#0B5560" },
  green: { label: "그린", background: "#EAF6EC", border: "#2F9E44", text: "#1D5E2A" },
  yellow: { label: "옐로", background: "#FFF6DB", border: "#E8A100", text: "#6E4C00" },
} as const;
export type ClassColor = keyof typeof CLASS_PALETTE;
export const CLASS_COLORS = Object.keys(CLASS_PALETTE) as ClassColor[];
