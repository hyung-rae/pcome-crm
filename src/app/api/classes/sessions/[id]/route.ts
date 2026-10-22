import { requireStaff } from "@/lib/auth/session";
import { AppError } from "@/lib/auth/validation";
import { failure, json, readBody } from "@/lib/auth/http";
import { classRpc } from "@/lib/classes/rpc";
import { classId, scopeField, sessionUpdateInput } from "@/lib/classes/validation";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const body = await readBody(request);
    const { staff } = await requireStaff();
    const id = classId((await params).id);
    if (body.action === "cancel" || body.action === "restore") {
      await classRpc("class_set_status", {
        p_actor: staff.id,
        p_session_id: id,
        p_scope: scopeField(body.scope),
        p_status: body.action === "cancel" ? "cancelled" : "scheduled",
      });
      return json({
        message: body.action === "cancel" ? "휴강 처리했습니다." : "휴강을 취소했습니다.",
      });
    }
    if (body.action !== "update") throw new AppError("잘못된 변경 요청입니다.");
    const input = sessionUpdateInput(body);
    await classRpc("class_update", {
      p_actor: staff.id,
      p_session_id: id,
      p_scope: input.scope,
      p_class_type_id: input.class_type_id,
      p_instructor_id: input.instructor_id,
      p_capacity: input.capacity,
      p_duration_minutes: input.duration_minutes,
      p_start_time: input.start_time,
      p_date: input.date,
      p_weekdays: input.weekdays,
      p_end_date: input.end_date,
    });
    return json({ message: "수업을 수정했습니다." });
  } catch (error) {
    return failure(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const body = await readBody(request);
    const { staff } = await requireStaff();
    const id = classId((await params).id);
    await classRpc("class_delete", {
      p_actor: staff.id,
      p_session_id: id,
      p_scope: scopeField(body.scope),
    });
    return json({ message: "수업을 삭제했습니다." });
  } catch (error) {
    return failure(error);
  }
}
