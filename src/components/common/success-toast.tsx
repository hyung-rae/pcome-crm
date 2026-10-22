"use client";
import { useEffect, useState } from "react";
import { Portal } from "@mantine/core";
import styles from "./success-toast.module.css";

export function SuccessToast({ message, onClose }: { message: string; onClose: () => void }) {
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return;
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose, paused]);

  return (
    <Portal>
      <div className={styles.toast} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
        <svg className={styles.icon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>
        <span role="status" aria-live="polite" className={styles.message}>{message}</span>
      </div>
    </Portal>
  );
}
