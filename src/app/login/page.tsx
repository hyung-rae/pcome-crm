import { redirect } from "next/navigation";
import { getStaff } from "@/lib/auth/session";
import { LoginForm } from "@/components/auth/auth-forms";
import styles from "@/components/auth/auth.module.css";
export const dynamic = "force-dynamic";
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const session = await getStaff();
  if (session) redirect(session.staff.must_change_password ? "/password" : "/");
  return (
    <main className={styles.login}>
      <section className={styles.card}>
        <p className={styles.brand}>PCOME CRM</p>
        <h1>직원 로그인</h1>
        <p className={styles.description}>
          회원 관리의 시작, PCOME CRM에 로그인하세요.
        </p>
        <LoginForm accessDenied={(await searchParams).reason === "access"} />
      </section>
    </main>
  );
}
