import { createClient } from "@supabase/supabase-js";
const c = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  { auth: { persistSession: false } },
);
const result = await c.from("staff").select("id");
if (!result.error || result.error.code !== "42501") {
  console.error("비로그인 staff 접근 차단을 확인하지 못했습니다.");
  process.exit(1);
}
const response = await fetch(
  process.env.NEXT_PUBLIC_SUPABASE_URL + "/auth/v1/settings",
  { headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY } },
);
if (!response.ok) {
  console.error("Auth 연결 실패");
  process.exit(1);
}
const settings = await response.json();
console.log({
  dataApiConnected: true,
  anonymousStaffAccessDenied: true,
  emailLoginEnabled: settings.external?.email,
  publicSignupDisabled: settings.disable_signup,
});

if (!settings.disable_signup) {
  console.error("공개 회원가입을 꺼주세요.");
  process.exit(1);
}
