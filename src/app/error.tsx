"use client";
import { Button } from "@mantine/core";
import styles from "@/components/auth/auth.module.css";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className={styles.login}>
      <section className={styles.card}>
        <p className={styles.brand}>PCOME CRM</p>
        <h1>연결을 확인해주세요</h1>
        <p className={styles.description}>
          화면을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.
        </p>
        <Button size="xs" onClick={reset}>
          다시 시도
        </Button>
      </section>
    </main>
  );
}
