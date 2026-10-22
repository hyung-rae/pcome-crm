import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppError } from "./validation";
import type { Staff } from "./types";

export async function getStaff() {
  const client = await createClient();
  const {
    data: { user },
    error: authError,
  } = await client.auth.getUser();
  if (authError || !user) {
    if (authError && authError.status && authError.status >= 500)
      throw new AppError("인증 서버에 연결할 수 없습니다.", 503);
    return null;
  }
  const { data, error } = await client
    .from("staff")
    .select(
      "id,name,role,is_active,is_instructor,must_change_password,credentials_reset_at,created_at,updated_at",
    )
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw new AppError("직원 정보를 불러오지 못했습니다.", 503);
  return data ? { staff: data as Staff, email: user.email!, client } : null;
}
export async function requireStaff(
  options: { admin?: boolean; allowPasswordChange?: boolean } = {},
) {
  const session = await getStaff();
  if (!session)
    throw new AppError("로그인이 필요하거나 사용할 수 없는 계정입니다.", 401);
  if (session.staff.must_change_password && !options.allowPasswordChange)
    throw new AppError("비밀번호를 먼저 변경해주세요.", 403);
  if (options.admin && session.staff.role !== "admin")
    throw new AppError("관리자 권한이 필요합니다.", 403);
  return session;
}
export async function requirePage(admin = false, allowPasswordChange = false) {
  const session = await getStaff();
  if (!session) redirect("/login?reason=access");
  if (session.staff.must_change_password && !allowPasswordChange)
    redirect("/password");
  if (admin && session.staff.role !== "admin") redirect("/");
  return session;
}
