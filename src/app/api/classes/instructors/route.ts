import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/auth/session";
import { AppError } from "@/lib/auth/validation";
import { failure, json } from "@/lib/auth/http";

// Only names of assignable instructors are exposed; other staff data stays admin-only.
export async function GET() {
  try {
    await requireStaff();
    const { data, error } = await createAdminClient()
      .from("staff")
      .select("id,name")
      .eq("is_active", true)
      .eq("is_instructor", true)
      .order("name");
    if (error) throw new AppError("강사 목록을 불러오지 못했습니다.", 503);
    return json({ instructors: data });
  } catch (error) {
    return failure(error);
  }
}
