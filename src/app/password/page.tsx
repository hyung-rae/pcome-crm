import Link from "next/link";
import { requirePage } from "@/lib/auth/session";
import { LogoutButton, PasswordForm } from "@/components/auth/auth-forms";
import styles from "@/components/auth/auth.module.css";
export const dynamic = "force-dynamic";
export default async function PasswordPage() {
  const { staff } = await requirePage(false, true);
  return (
    <main className={styles.login}>
      <section className={`${styles.card} ${styles.password}`}>
        <p className={styles.brand}>PCOME CRM</p>
        <h1>비밀번호 변경</h1>
        <p className={styles.description}>
          {staff.must_change_password
            ? "초기·임시 비밀번호를 변경한 뒤 서비스를 이용해주세요."
            : "안전한 새 비밀번호로 변경해주세요."}
        </p>
        <PasswordForm />
        <div className={styles.account} style={{ marginTop: 24 }}>
          {!staff.must_change_password && <Link href="/">대시보드로</Link>}
          <LogoutButton />
        </div>
      </section>
    </main>
  );
}
