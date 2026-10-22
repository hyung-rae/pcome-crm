"use client";
import { useLinkStatus } from "next/link";
import styles from "./loading.module.css";

export function LinkLoading() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <span className={styles.navigation} role="status" aria-live="polite">
      <span className={styles.spinner} aria-hidden="true" />
      화면을 불러오는 중입니다.
    </span>
  );
}
