import styles from "./role-badge.module.css";

export function RoleBadge({ role }: { role: "admin" | "sub_admin" }) {
  return <span className={`${styles.badge} ${role === "admin" ? styles.admin : styles.sub}`}>{role === "admin" ? "관리자" : "서브관리자"}</span>;
}
