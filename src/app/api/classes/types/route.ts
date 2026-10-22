import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/auth/session";
import { AppError } from "@/lib/auth/validation";
import { failure, json, readBody } from "@/lib/auth/http";
import { classTypeInput } from "@/lib/classes/validation";

const COLUMNS = "id,name,default_capacity,default_duration_minutes,color,is_active";

export async function GET() {
  try {
    await requireStaff();
    const { data, error } = await createAdminClient()
      .from("class_types")
      .select(COLUMNS)
      .order("is_active", { ascending: false })
      .order("name");
    if (error) throw new AppError("수업 종류를 불러오지 못했습니다.", 503);
    return json({ types: data });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await readBody(request);
    const { staff } = await requireStaff();
    const input = classTypeInput(body);
    const { error } = await createAdminClient()
      .from("class_types")
      .insert({ ...input, created_by: staff.id });
    if (error?.code === "23505")
      throw new AppError("이미 사용 중인 수업 이름입니다.", 409);
    if (error) throw new AppError("수업 종류를 등록하지 못했습니다.", 503);
    return json({ message: "수업 종류를 등록했습니다." }, 201);
  } catch (error) {
    return failure(error);
  }
}
