import { provisionStaff } from "@/lib/auth/provision";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/auth/session";
import {
  AppError,
  emailField,
  field,
  passwordField,
} from "@/lib/auth/validation";
import { failure, json, readBody } from "@/lib/auth/http";

export async function GET() {
  try {
    await requireStaff({ admin: true });
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("staff")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new AppError("직원 목록을 불러오지 못했습니다.", 503);
    // Future sessions per instructor, shown as a warning before removing an instructor.
    // If counting fails the staff list still loads and the count is reported as unknown (null).
    const counts = await admin.rpc("class_upcoming_counts");
    const upcoming = counts.error
      ? null
      : new Map(
          (counts.data as { instructor_id: string; sessions: number }[]).map(
            (row) => [row.instructor_id, Number(row.sessions)],
          ),
        );
    const rows = await Promise.all(
      data.map(async (staff) => {
        const { data: user, error } = await admin.auth.admin.getUserById(
          staff.id,
        );
        // An account deleted while the list was loading is simply left out.
        if (error?.status === 404) return null;
        if (error) throw new AppError("직원 정보를 불러오지 못했습니다.", 503);
        return {
          ...staff,
          email: user.user.email ?? "",
          upcoming_sessions: upcoming ? (upcoming.get(staff.id) ?? 0) : null,
        };
      }),
    );
    return json({ staff: rows.filter((row) => row !== null) });
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: Request) {
  try {
    const body = await readBody(request);
    await requireStaff({ admin: true });
    const email = emailField(body),
      password = passwordField(body),
      name = field(body, "name", 50).trim();
    const admin = createAdminClient();
    await provisionStaff({
      async create() {
        const { data, error } = await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        });
        if (error || !data.user)
          throw new AppError(
            error?.code === "email_exists"
              ? "이미 등록된 이메일입니다."
              : "계정을 생성하지 못했습니다. 이메일 중복과 연결 상태를 확인해주세요.",
            409,
          );
        return { id: data.user.id };
      },
      async insert(id) {
        const { error } = await admin
          .from("staff")
          .insert({
            id,
            name,
            role: "sub_admin",
            is_active: true,
            must_change_password: true,
          });
        if (error) throw error;
      },
      async remove(id) {
        const { error } = await admin.auth.admin.deleteUser(id);
        if (error) throw error;
      },
    });
    return json(
      {
        message:
          "서브관리자를 생성했습니다. 초기 비밀번호를 별도로 전달해주세요.",
      },
      201,
    );
  } catch (error) {
    return failure(error);
  }
}
