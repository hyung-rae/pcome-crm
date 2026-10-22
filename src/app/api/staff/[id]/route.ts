import { deleteSubAdmin } from "@/lib/auth/delete-staff";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/auth/session";
import { AppError, field, passwordField, uuid } from "@/lib/auth/validation";
import { failure, json, readBody } from "@/lib/auth/http";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const body = await readBody(request);
    await requireStaff({ admin: true });
    const id = uuid((await params).id);
    const admin = createAdminClient();
    // Updates always constrain role, including against direct/forged requests.
    if (body.action === "reset") {
      const password = passwordField(body);
      const { data, error } = await admin
        .from("staff")
        .update({
          must_change_password: true,
          credentials_reset_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("role", "sub_admin")
        .select("id")
        .maybeSingle();
      if (error) throw new AppError("계정 상태를 변경하지 못했습니다.", 503);
      if (!data) throw new AppError("변경할 수 없는 계정입니다.", 404);
      const result = await admin.auth.admin.updateUserById(id, { password });
      if (result.error)
        throw new AppError(
          "세션은 종료됐으나 비밀번호 재설정에 실패했습니다. 다시 재설정해주세요.",
          503,
        );
      return json({
        message: "임시 비밀번호를 설정하고 기존 세션을 종료했습니다.",
      });
    }
    let update;
    if (body.action === "rename")
      update = { name: field(body, "name", 50).trim() };
    else if (body.action === "status" && typeof body.is_active === "boolean")
      update = { is_active: body.is_active };
    else throw new AppError("잘못된 변경 요청입니다.");
    const { data, error } = await admin
      .from("staff")
      .update(update)
      .eq("id", id)
      .eq("role", "sub_admin")
      .select("id")
      .maybeSingle();
    if (error) throw new AppError("직원 정보를 변경하지 못했습니다.", 503);
    if (!data) throw new AppError("변경할 수 없는 계정입니다.", 404);
    return json({ message: "직원 정보를 변경했습니다." });
  } catch (error) {
    return failure(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await readBody(request);
    const session = await requireStaff({ admin: true });
    const id = uuid((await params).id);
    if (id === session.staff.id)
      throw new AppError("본인 계정은 삭제할 수 없습니다.", 403);
    const admin = createAdminClient();
    await deleteSubAdmin({
      async revoke() {
        const { data, error } = await admin
          .from("staff")
          .update({
            is_active: false,
            credentials_reset_at: new Date().toISOString(),
          })
          .eq("id", id)
          .eq("role", "sub_admin")
          .select("id")
          .maybeSingle();
        if (error) throw error;
        return !!data;
      },
      async remove() {
        const { error } = await admin.auth.admin.deleteUser(id, false);
        if (error) throw error;
      },
    });
    return json({
      message: "서브관리자 로그인 계정과 직원 정보를 삭제했습니다.",
    });
  } catch (error) {
    return failure(error);
  }
}
