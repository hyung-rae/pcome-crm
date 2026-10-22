import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";

// Run with node --env-file=.env.local scripts/bootstrap-admin.mjs <email> <name>
const [email, name] = process.argv.slice(2);
if (
  !email ||
  !name ||
  !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
  name.trim().length > 50
) {
  console.error("이메일과 이름을 지정해주세요.");
  process.exit(1);
}
if (existsSync(".env.admin-initial.local")) {
  console.error("기존 초기 로그인 정보 파일을 먼저 확인해주세요.");
  process.exit(1);
}
const key = process.env.SUPABASE_SECRET_KEY;
if (!key) {
  console.error("SUPABASE_SECRET_KEY 설정이 필요합니다.");
  process.exit(1);
}
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { count, error: countError } = await admin
  .from("staff")
  .select("id", { count: "exact", head: true })
  .eq("role", "admin");
if (countError || count !== 0) {
  console.error("관리자가 이미 있거나 DB를 확인할 수 없습니다. 중단합니다.");
  process.exit(1);
}
const password = "Pcome1!" + randomBytes(6).toString("base64url");
const result = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
});
if (result.error) {
  console.error("계정 생성 실패. 이메일 중복과 연결을 확인해주세요.");
  process.exit(1);
}
const { error } = await admin
  .from("staff")
  .insert({
    id: result.data.user.id,
    name: name.trim(),
    role: "admin",
    is_active: true,
    must_change_password: true,
  });
if (error) {
  const cleanup = await admin.auth.admin.deleteUser(result.data.user.id);
  console.error(
    cleanup.error
      ? "프로필 저장과 계정 정리에 실패했습니다. Supabase에서 확인해주세요."
      : "프로필 저장 실패. 생성 계정은 정리했습니다.",
  );
  process.exit(1);
}
try {
  writeFileSync(
    ".env.admin-initial.local",
    `# 최초 로그인 후 이 파일을 삭제하세요. Git 제외 파일입니다.\nPCOME_ADMIN_EMAIL=${email}\nPCOME_ADMIN_INITIAL_PASSWORD=${password}\n`,
    { mode: 0o600, flag: "wx" },
  );
  console.log(
    "첫 관리자 생성 완료. 초기 로그인 정보는 .env.admin-initial.local에서 확인하세요. 최초 로그인 시 비밀번호 변경이 필요합니다.",
  );
} catch {
  console.error(
    "관리자는 생성됐으나 로그인 정보 파일 저장에 실패했습니다. Supabase 소유자 복구 절차로 비밀번호를 재설정해주세요.",
  );
  process.exit(1);
}
