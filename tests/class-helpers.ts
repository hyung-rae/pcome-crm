import { expect, type APIRequestContext } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { addDays, seoulToday, weekStart } from "../src/lib/classes/dates";

export function adminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
export function origin(baseURL: string | undefined) {
  return { origin: new URL(baseURL!).origin };
}
export async function call(
  request: APIRequestContext,
  baseURL: string | undefined,
  method: string,
  path: string,
  data?: unknown,
) {
  const response = await request.fetch(path, { method, headers: origin(baseURL), data });
  return { status: response.status(), body: await response.json() };
}
// A Monday several weeks ahead keeps test classes clear of "today" edge cases.
export function futureMonday(weeks = 3) {
  return weekStart(addDays(seoulToday(), weeks * 7));
}

// Each test owns its instructors and class types, so parallel tests never share time slots.
export class ClassFixture {
  readonly tag = randomBytes(4).toString("hex");
  private users: string[] = [];
  private types: string[] = [];
  readonly admin = adminClient();

  async instructor(options: { instructor?: boolean; mustChangePassword?: boolean; role?: "admin" | "sub_admin" } = {}) {
    const email = `pcome-e2e-class-${this.tag}-${this.users.length}@example.com`;
    const password = "E2e1!" + randomBytes(7).toString("base64url");
    const { data, error } = await this.admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) throw new Error("테스트 강사 생성 실패: " + error.code);
    this.users.push(data.user!.id);
    const profile = await this.admin.from("staff").insert({
      id: data.user!.id,
      name: `검증 강사 ${this.tag}-${this.users.length}`,
      role: options.role ?? "sub_admin",
      is_active: true,
      must_change_password: options.mustChangePassword ?? false,
      is_instructor: options.instructor ?? true,
    });
    if (profile.error) throw new Error("테스트 강사 프로필 생성 실패: " + profile.error.code);
    return { id: data.user!.id, email, password, name: `검증 강사 ${this.tag}-${this.users.length}` };
  }
  async type(name = "요가", extra: Record<string, unknown> = {}) {
    const { data, error } = await this.admin
      .from("class_types")
      .insert({
        name: `${name} ${this.tag}-${this.types.length}`,
        default_capacity: 20,
        default_duration_minutes: 50,
        color: "teal",
        ...extra,
      })
      .select("id,name")
      .single();
    if (error) throw new Error("테스트 수업 종류 생성 실패: " + error.code);
    this.types.push(data.id);
    return data as { id: string; name: string };
  }
  track(typeId: string) {
    this.types.push(typeId);
  }
  async sessions(filter: { series?: string; type?: string }) {
    let query = this.admin
      .from("class_sessions")
      .select("id,series_id,occurrence_date,instructor_id,starts_at,ends_at,status,is_modified,capacity")
      .order("starts_at");
    if (filter.series) query = query.eq("series_id", filter.series);
    if (filter.type) query = query.eq("class_type_id", filter.type);
    const { data, error } = await query;
    expect(error).toBeNull();
    return data!;
  }
  async cleanup() {
    await removeClassData(this.admin, this.tag, this.types);
    for (const id of this.users) {
      const { error } = await this.admin.auth.admin.deleteUser(id);
      if (error && error.status !== 404) throw new Error("테스트 강사 정리 실패");
    }
  }
}

type Admin = ReturnType<typeof adminClient>;
// Types created through the UI are found by the fixture tag in their name.
async function removeClassData(admin: Admin, tag: string, typeIds: string[] = []) {
  const named = await admin.from("class_types").select("id").like("name", `%${tag}%`);
  if (named.error) throw new Error("테스트 수업 종류 조회 실패");
  const ids = [...typeIds, ...named.data.map((row) => row.id)];
  if (!ids.length) return;
  for (const table of ["class_sessions", "class_series"] as const) {
    const { error } = await admin.from(table).delete().in("class_type_id", ids);
    if (error) throw new Error(`테스트 ${table} 정리 실패`);
  }
  const { error } = await admin.from("class_types").delete().in("id", ids);
  if (error) throw new Error("테스트 수업 종류 정리 실패");
}

// Removes class fixtures left by interrupted runs. Only data older than `minAgeMs` is touched
// so a concurrently running suite keeps its own fixtures.
export async function sweepClassFixtures(admin: Admin, minAgeMs = 30 * 60_000) {
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw new Error("테스트 계정 조회 실패");
  const stale = data.users.filter(
    (user) =>
      user.email?.startsWith("pcome-e2e-class-") &&
      Date.now() - new Date(user.created_at).getTime() > minAgeMs,
  );
  for (const tag of new Set(stale.map((user) => user.email!.split("-")[3])))
    await removeClassData(admin, tag);
  for (const user of stale) {
    const result = await admin.auth.admin.deleteUser(user.id);
    if (result.error && result.error.status !== 404) throw new Error("테스트 강사 정리 실패");
  }
}
