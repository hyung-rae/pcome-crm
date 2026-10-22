"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, PasswordInput, TextInput } from "@mantine/core";
import styles from "./auth.module.css";

export async function api(path: string, method: string, body?: unknown) {
  let response: Response;
  try {
    response = await fetch(path, {
      method,
      headers: { "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch {
    throw new Error("서버에 연결하지 못했습니다. 연결 상태를 확인해주세요.");
  }
  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error("서버 응답을 확인하지 못했습니다. 다시 시도해주세요.");
  }
  if (!response.ok)
    // Keep extra error details (e.g. schedule conflicts) for callers that show them.
    throw Object.assign(new Error(result.error || "요청을 처리하지 못했습니다."), { data: result });
  return result;
}
export function LoginForm({ accessDenied }: { accessDenied: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget,
      data = new FormData(form);
    setPending(true);
    setError("");
    try {
      const result = await api("/api/auth/login", "POST", {
        email: data.get("email"),
        password: data.get("password"),
      });
      form.reset();
      router.replace(result.redirect);
      router.refresh();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "연결 상태를 확인해주세요.",
      );
      setPending(false);
    }
  }
  return (
    <form onSubmit={submit} className={`${styles.form} ${styles.loginForm}`} aria-label="로그인">
      {accessDenied && (
        <p className={styles.message}>
          로그인이 필요하거나 사용할 수 없는 계정입니다. 관리자에게
          문의해주세요.
        </p>
      )}
      <TextInput
        label="이메일"
        size="sm"
        radius="md"
        classNames={{ input: styles.loginInput }}
        name="email"
        type="email"
        autoComplete="username"
        required
        maxLength={254}
        disabled={pending}
      />
      <PasswordInput
        label="비밀번호"
        size="sm"
        radius="md"
        classNames={{ input: styles.loginInput, visibilityToggle: styles.visibilityToggle }}
        name="password"
        autoComplete="current-password"
        required
        maxLength={128}
        disabled={pending}
        visibilityToggleButtonProps={{ "aria-label": "비밀번호 표시 전환" }}
      />
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      <Button type="submit" size="xs" fullWidth loading={pending}>
        로그인
      </Button>
      <p className={styles.message}>
        계정 발급·비밀번호 분실은 관리자에게 문의해주세요.
      </p>
    </form>
  );
}
export function LogoutButton({ className, errorClassName }: { className?: string; errorClassName?: string } = {}) {
  const router = useRouter();
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  return (
    <>
      <Button
        size="xs"
        variant="default"
        className={className}
        loading={pending}
        onClick={async () => {
          if (pending) return;
          setPending(true);
          setError("");
          try {
            await api("/api/auth/logout", "POST", {});
            router.replace("/login");
            router.refresh();
          } catch {
            setError("로그아웃을 다시 시도해주세요.");
            setPending(false);
          }
        }}
      >
        로그아웃
      </Button>
      {error && (
        <span role="alert" className={`${styles.error} ${errorClassName || ""}`}>
          {error}
        </span>
      )}
    </>
  );
}
export function PasswordForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget,
      data = new FormData(form);
    setPending(true);
    setError("");
    try {
      const result = await api(
        "/api/auth/password",
        "POST",
        Object.fromEntries(data),
      );
      form.reset();
      router.replace(result.redirect);
      router.refresh();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "연결 상태를 확인해주세요.",
      );
      setPending(false);
    }
  }
  return (
    <form onSubmit={submit} className={`${styles.form} ${styles.loginForm}`} aria-label="비밀번호 변경">
      <PasswordInput
        label="현재 비밀번호"
        size="sm"
        radius="md"
        classNames={{ input: styles.loginInput, visibilityToggle: styles.visibilityToggle }}
        name="currentPassword"
        autoComplete="current-password"
        required
        maxLength={128}
        disabled={pending}
      />
      <PasswordInput
        label="새 비밀번호"
        size="sm"
        radius="md"
        classNames={{ input: styles.loginInput, visibilityToggle: styles.visibilityToggle }}
        name="password"
        autoComplete="new-password"
        description="영문·숫자 포함 8~16자"
        minLength={8}
        maxLength={16}
        required
        disabled={pending}
      />
      <PasswordInput
        label="새 비밀번호 확인"
        size="sm"
        radius="md"
        classNames={{ input: styles.loginInput, visibilityToggle: styles.visibilityToggle }}
        name="confirmPassword"
        autoComplete="new-password"
        minLength={8}
        maxLength={16}
        required
        disabled={pending}
      />
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      <Button size="xs" type="submit" fullWidth loading={pending}>
        비밀번호 변경
      </Button>
    </form>
  );
}
