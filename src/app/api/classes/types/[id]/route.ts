import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/auth/session";
import { AppError } from "@/lib/auth/validation";
import { failure, json, readBody } from "@/lib/auth/http";
import { classId, classTypeInput } from "@/lib/classes/validation";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const body = await readBody(request);
    await requireStaff();
    const id = classId((await params).id);
    let update;
    if (body.action === "update") update = classTypeInput(body);
    else if (body.action === "active" && typeof body.is_active === "boolean")
      update = { is_active: body.is_active };
    else throw new AppError("잘못된 변경 요청입니다.");
    const { data, error } = await createAdminClient()
      .from("class_types")
      .update(update)
      .eq("id", id)
      .select("id")
      .maybeSingle();
    if (error?.code === "23505")
      throw new AppError("같은 이름의 수업 종류가 이미 사용 중입니다.", 409);
    if (error) throw new AppError("수업 종류를 변경하지 못했습니다.", 503);
    if (!data) throw new AppError("수업 종류를 찾을 수 없습니다.", 404);
    return json({ message: "수업 종류를 변경했습니다." });
  } catch (error) {
    return failure(error);
  }
}
