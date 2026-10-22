import styles from "./loading.module.css";

export function PageLoading() {
  return (
    <div className={styles.screen} role="status" aria-live="polite" aria-busy="true">
      <span className={styles.spinner} aria-hidden="true" />
      <span>화면을 불러오는 중입니다.</span>
    </div>
  );
}
