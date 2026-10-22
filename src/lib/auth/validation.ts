export class AppError extends Error {
  constructor(
    message: string,
    public status = 400,
    public data?: Record<string, unknown>,
  ) {
    super(message);
  }
}
export function field(body: Record<string, unknown>, key: string, max = 200) {
  const value = body[key];
  if (typeof value !== "string" || !value.trim() || value.length > max)
    throw new AppError("입력 내용을 확인해주세요.");
  return value;
}
export function emailField(body: Record<string, unknown>) {
  const value = field(body, "email", 254).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
    throw new AppError("올바른 이메일을 입력해주세요.");
  return value;
}
export function passwordField(body: Record<string, unknown>, key = "password") {
  const value = field(body, key, 16);
  if (value.length < 8 || !/[A-Za-z]/.test(value) || !/[0-9]/.test(value))
    throw new AppError(
      "비밀번호는 영문·숫자를 포함해 8~16자로 입력해주세요.",
    );
  return value;
}
export function uuid(value: string) {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    )
  )
    throw new AppError("잘못된 직원 정보입니다.");
  return value;
}
