import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { AppError } from "@/lib/auth/validation";

const CODES: Record<string, [string, number]> = {
  type_unavailable: ["사용할 수 없는 수업 종류입니다.", 400],
  instructor_unavailable: ["강사로 지정할 수 없는 직원입니다.", 400],
  out_of_range: ["날짜를 확인해주세요. 오늘부터 1년 이내만 등록할 수 있습니다.", 400],
  no_dates: ["선택한 기간에 해당하는 수업 날짜가 없습니다.", 400],
  invalid: ["잘못된 요청입니다.", 400],
  start_in_past: ["시작 시각이 이미 지났습니다. 이후 시각을 선택해주세요.", 400],
  past: ["이미 시작했거나 지난 수업은 변경할 수 없습니다.", 409],
  not_found: ["수업을 찾을 수 없습니다. 목록을 새로고침해주세요.", 404],
  conflict: ["같은 강사의 다른 수업과 시간이 겹칩니다.", 409],
};

type RpcResult = { ok: boolean; id?: string; code?: string; conflicts?: unknown[] };

// Schedule writes run in one Postgres function each (lock, validation, conflicts, save).
export async function classRpc(name: string, args: Record<string, unknown> = {}) {
  const { data, error } = await createAdminClient().rpc(name, args);
  if (error) {
    // The exclusion constraint is the final guard against concurrent overlapping writes.
    if (error.code === "23P01")
      throw new AppError(CODES.conflict[0], 409, { conflicts: [] });
    throw new AppError("수업 정보를 저장하지 못했습니다. 다시 시도해주세요.", 503);
  }
  const result = data as RpcResult | null;
  if (result && result.ok === false) {
    const [message, status] = CODES[result.code ?? ""] ?? CODES.invalid;
    throw new AppError(message, status, result.conflicts ? { conflicts: result.conflicts } : undefined);
  }
  return result;
}
