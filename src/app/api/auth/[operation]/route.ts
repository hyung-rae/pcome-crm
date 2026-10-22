import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { supabaseConfig } from "@/lib/supabase/config";
import { getStaff, requireStaff } from "@/lib/auth/session";
import {
  AppError,
  emailField,
  field,
  passwordField,
} from "@/lib/auth/validation";
import { failure, json, readBody } from "@/lib/auth/http";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ operation: string }> },
) {
  try {
    const body = await readBody(request);
    const { operation } = await params;
    const client = await createClient();
    if (operation === "login") {
      const email = emailField(body);
      const password = field(body, "password", 128);
      const { error } = await client.auth.signInWithPassword({
        email,
        password,
      });
      if (error)
        throw new AppError(
          error.status === 429
            ? "요청이 많습니다. 잠시 후 다시 시도해주세요."
            : "이메일 또는 비밀번호를 확인해주세요.",
          error.status === 429
            ? 429
            : error.status && error.status >= 500
              ? 503
              : 401,
        );
      const session = await getStaff();
      if (!session) {
        await client.auth.signOut({ scope: "local" });
        throw new AppError(
          "사용할 수 없는 직원 계정입니다. 관리자에게 문의해주세요.",
          403,
        );
      }
      return json({
        redirect: session.staff.must_change_password ? "/password" : "/",
      });
    }
    if (operation === "logout") {
      const { error } = await client.auth.signOut({ scope: "local" });
      if (error)
        throw new AppError("로그아웃하지 못했습니다. 다시 시도해주세요.", 503);
      return json({ redirect: "/login" });
    }
    if (operation === "password") {
      const session = await requireStaff({ allowPasswordChange: true });
      const currentPassword = field(body, "currentPassword", 128);
      const password = passwordField(body);
      if (password !== body.confirmPassword)
        throw new AppError("새 비밀번호 확인이 일치하지 않습니다.");
      if (password === currentPassword)
        throw new AppError("현재와 다른 새 비밀번호를 입력해주세요.");
      const { url, key } = supabaseConfig();
      const verifier = createSupabaseClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const verified = await verifier.auth.signInWithPassword({
        email: session.email,
        password: currentPassword,
      });
      if (verified.error || verified.data.user?.id !== session.staff.id)
        throw new AppError("현재 비밀번호를 확인해주세요.");
      await verifier.auth.signOut({ scope: "local" });
      // Recheck after verification, including revocation by a simultaneous administrator reset.
      await requireStaff({ allowPasswordChange: true });
      const { error } = await session.client.auth.updateUser({ password });
      if (error)
        throw new AppError(
          "비밀번호를 변경하지 못했습니다. 잠시 후 다시 시도해주세요.",
          503,
        );
      const admin = createAdminClient();
      const { data, error: profileError } = await admin
        .from("staff")
        .update({ must_change_password: false })
        .eq("id", session.staff.id)
        .eq("is_active", true)
        .eq("updated_at", session.staff.updated_at)
        .select("id")
        .maybeSingle();
      if (profileError || !data)
        throw new AppError(
          "비밀번호는 변경됐으나 계정 상태 확인이 필요합니다. 새 비밀번호로 다시 로그인해주세요.",
          409,
        );
      return json({ redirect: "/" });
    }
    throw new AppError("없는 요청입니다.", 404);
  } catch (error) {
    return failure(error);
  }
}
