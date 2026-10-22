import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { addDays, scheduleHorizon, seoulDateTime, seoulToday } from "../src/lib/classes/dates";
import { call, ClassFixture, futureMonday } from "./class-helpers";

test.use({ trace: "off" });

let fx: ClassFixture;
test.beforeEach(() => {
  fx = new ClassFixture();
});
test.afterEach(async () => {
  await fx.cleanup();
});

const body = (type: string, instructor: string, extra: Record<string, unknown> = {}) => ({
  class_type_id: type,
  instructor_id: instructor,
  capacity: 20,
  duration_minutes: 50,
  start_time: "19:00",
  ...extra,
});

test("수업 종류 등록·이름 중복·수정·사용 중지·재사용 충돌", async ({ request, baseURL }) => {
  const name = `필라테스 ${fx.tag}`;
  const create = (data: Record<string, unknown>) => call(request, baseURL, "POST", "/api/classes/types", data);
  const valid = { name, default_capacity: 12, default_duration_minutes: 55, color: "violet" };
  expect((await create(valid)).status).toBe(201);
  const list = (await call(request, baseURL, "GET", "/api/classes/types")).body.types;
  const created = list.find((type: { name: string }) => type.name === name);
  fx.track(created.id);
  expect(created).toMatchObject({ default_capacity: 12, default_duration_minutes: 55, color: "violet", is_active: true });
  expect((await create({ ...valid, name: ` ${name.toUpperCase()} ` })).status).toBe(409);
  for (const invalid of [{ default_capacity: 0 }, { default_duration_minutes: 52 }, { color: "black" }, { name: "" }])
    expect((await create({ ...valid, ...invalid })).status).toBe(400);
  const patch = (data: Record<string, unknown>) => call(request, baseURL, "PATCH", `/api/classes/types/${created.id}`, data);
  expect((await patch({ ...valid, action: "update", default_capacity: 15 })).status).toBe(200);
  expect((await patch({ action: "active", is_active: false })).status).toBe(200);
  // A new active type may reuse the name; the old one then cannot be reactivated.
  expect((await create(valid)).status).toBe(201);
  const again = (await call(request, baseURL, "GET", "/api/classes/types")).body.types;
  again.filter((type: { name: string; id: string }) => type.name === name).forEach((type: { id: string }) => fx.track(type.id));
  expect((await patch({ action: "active", is_active: true })).status).toBe(409);
  expect((await call(request, baseURL, "PATCH", "/api/classes/types/not-a-uuid", { action: "active", is_active: true })).status).toBe(400);
});

test("비로그인·초기 비밀번호 계정·서브관리자 권한과 DB 직접 접근 차단", async ({ playwright, baseURL }) => {
  const type = await fx.type();
  const guest = await playwright.request.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
  for (const path of ["/api/classes/types", "/api/classes/instructors", `/api/classes/sessions?from=2026-10-19&to=2026-10-25`])
    expect((await guest.get(path)).status()).toBe(401);
  expect((await call(guest, baseURL, "POST", "/api/classes/sessions", {})).status).toBe(401);
  // Dedicated accounts: shared E2E accounts are changed concurrently by other specs.
  const initial = await fx.instructor({ instructor: false, mustChangePassword: true });
  const sub = await fx.instructor({ instructor: false });
  for (const [kind, account, status] of [["initial", initial, 403], ["sub", sub, 200]] as const) {
    const context = await playwright.request.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
    expect((await call(context, baseURL, "POST", "/api/auth/login", { email: account.email, password: account.password })).status).toBe(200);
    expect((await context.get("/api/classes/types")).status()).toBe(status);
    if (kind === "sub") {
      // Sub-admins manage the schedule but cannot change instructor flags.
      expect((await call(context, baseURL, "PATCH", `/api/staff/${account.id}`, { action: "instructor", is_instructor: true })).status).toBe(403);
      const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      await client.auth.signInWithPassword({ email: account.email, password: account.password });
      const read = await client.from("class_types").select("id").eq("id", type.id);
      expect(read.data).toHaveLength(1);
      expect((await client.from("class_types").update({ name: "변경" }).eq("id", type.id).select()).data ?? []).toHaveLength(0);
      expect((await client.rpc("class_extend_series")).error).not.toBeNull();
      expect((await client.rpc("class_delete", { p_actor: account.id, p_session_id: type.id, p_scope: "one" })).error).not.toBeNull();
    }
    await context.dispose();
  }
  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  expect((await anon.from("class_sessions").select("id")).data ?? []).toHaveLength(0);
  expect((await anon.rpc("class_upcoming_counts")).error).not.toBeNull();
  await guest.dispose();
});

test("관리자는 본인·서브관리자를 강사로 지정하고 강사 목록에 반영된다", async ({ playwright, baseURL }) => {
  // A dedicated admin keeps the shared E2E admin row untouched for other specs.
  const owner = await fx.instructor({ role: "admin", instructor: false });
  const request = await playwright.request.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
  expect((await call(request, baseURL, "POST", "/api/auth/login", { email: owner.email, password: owner.password })).status).toBe(200);
  const self = owner.id;
  const sub = await fx.instructor({ instructor: false });
  try {
    for (const id of [self, sub.id])
      expect((await call(request, baseURL, "PATCH", `/api/staff/${id}`, { action: "instructor", is_instructor: true })).status).toBe(200);
    const ids = (await call(request, baseURL, "GET", "/api/classes/instructors")).body.instructors.map((item: { id: string }) => item.id);
    expect(ids).toEqual(expect.arrayContaining([self, sub.id]));
    expect((await call(request, baseURL, "PATCH", `/api/staff/${sub.id}`, { action: "instructor", is_instructor: "yes" })).status).toBe(400);
    await fx.admin.from("staff").update({ is_active: false }).eq("id", sub.id);
    const after = (await call(request, baseURL, "GET", "/api/classes/instructors")).body.instructors.map((item: { id: string }) => item.id);
    expect(after).not.toContain(sub.id);
  } finally {
    await request.dispose();
  }
});

test("단발·무기한·종료일 반복, 1년 범위, 겹침과 맞닿음", async ({ request, baseURL }) => {
  const type = await fx.type();
  const teacher = await fx.instructor();
  const monday = futureMonday();
  const today = seoulToday();
  const horizon = scheduleHorizon(today);
  const post = (extra: Record<string, unknown>) => call(request, baseURL, "POST", "/api/classes/sessions", body(type.id, teacher.id, extra));

  const repeat = await post({ date: monday, repeat: true, weekdays: [1, 3] });
  expect(repeat.status).toBe(201);
  const rows = await fx.sessions({ series: repeat.body.id });
  const dates = rows.map((row) => row.occurrence_date!);
  expect(dates[0]).toBe(monday);
  expect(dates).toContain(addDays(monday, 2));
  expect(dates.at(-1)! <= horizon && dates.at(-1)! > addDays(horizon, -7)).toBe(true);
  expect(seoulDateTime(rows[0].starts_at).time).toBe("19:00");

  const ended = await post({ date: monday, repeat: true, weekdays: [5], start_time: "07:00", end_date: addDays(monday, 18) });
  expect(ended.status).toBe(201);
  expect((await fx.sessions({ series: ended.body.id })).map((row) => row.occurrence_date)).toEqual([addDays(monday, 4), addDays(monday, 11), addDays(monday, 18)]);
  expect((await post({ date: monday, repeat: true, weekdays: [5], end_date: addDays(monday, -1) })).status).toBe(400);

  expect((await post({ date: addDays(monday, 1), start_time: "18:10" })).status).toBe(201);
  expect((await post({ date: horizon, start_time: "06:00" })).status).toBe(201);
  expect((await post({ date: addDays(horizon, 1) })).status).toBe(400);
  expect((await post({ date: addDays(today, -1) })).status).toBe(400);

  // Touching edges are allowed; overlaps are rejected with the conflicting sessions listed.
  expect((await post({ date: monday, start_time: "18:10", duration_minutes: 50 })).status).toBe(201);
  const overlap = await post({ date: monday, start_time: "19:30", duration_minutes: 30 });
  expect(overlap.status).toBe(409);
  expect(overlap.body.conflicts).toHaveLength(1);
  expect(overlap.body.conflicts[0].class_name).toBe(type.name);

  // One overlapping date blocks the whole series and stores nothing.
  const before = (await fx.sessions({ type: type.id })).length;
  const partial = await post({ date: monday, repeat: true, weekdays: [2], start_time: "18:30", duration_minutes: 30, end_date: addDays(monday, 29) });
  expect(partial.status).toBe(409);
  expect(partial.body.conflicts.map((item: { starts_at: string }) => seoulDateTime(item.starts_at).date)).toEqual([addDays(monday, 1)]);
  expect((await fx.sessions({ type: type.id })).length).toBe(before);
});

test("동시 등록은 하나만 저장된다", async ({ request, baseURL }) => {
  const type = await fx.type();
  const teacher = await fx.instructor();
  const date = addDays(futureMonday(), 2);
  const results = await Promise.all(
    [0, 1].map(() => call(request, baseURL, "POST", "/api/classes/sessions", body(type.id, teacher.id, { date }))),
  );
  expect(results.map((result) => result.status).sort()).toEqual([201, 409]);
  expect(await fx.sessions({ type: type.id })).toHaveLength(1);
});

test("이 회차만·이후 전체 수정, 휴강·삭제 유지, 휴강 취소 재검사, 이후 전체 삭제", async ({ request, baseURL }) => {
  const type = await fx.type();
  const teacher = await fx.instructor();
  const monday = futureMonday();
  const created = await call(request, baseURL, "POST", "/api/classes/sessions", body(type.id, teacher.id, { date: monday, repeat: true, weekdays: [1] }));
  const byDate = async (series: string, date: string) => (await fx.sessions({ series })).find((row) => row.occurrence_date === date)!;
  const patch = (id: string, data: Record<string, unknown>) => call(request, baseURL, "PATCH", `/api/classes/sessions/${id}`, data);
  const [w1, w2, w3, w4] = [7, 14, 21, 28].map((days) => addDays(monday, days));

  const modified = await byDate(created.body.id, w1);
  expect((await patch(modified.id, { action: "update", scope: "one", ...body(type.id, teacher.id, { date: w1, start_time: "20:00" }) })).status).toBe(200);
  expect((await byDate(created.body.id, w1)).is_modified).toBe(true);
  expect(seoulDateTime((await byDate(created.body.id, w2)).starts_at).time).toBe("19:00");

  expect((await patch((await byDate(created.body.id, w2)).id, { action: "cancel", scope: "one" })).status).toBe(200);
  expect((await call(request, baseURL, "DELETE", `/api/classes/sessions/${(await byDate(created.body.id, w3)).id}`, { scope: "one" })).status).toBe(200);
  const listed = await call(request, baseURL, "GET", `/api/classes/sessions?from=${w3}&to=${addDays(w3, 6)}`);
  expect(listed.body.sessions.filter((item: { class_type_id: string }) => item.class_type_id === type.id)).toHaveLength(0);

  const following = await patch(modified.id, {
    action: "update",
    scope: "following",
    ...body(type.id, teacher.id, { start_time: "06:30", duration_minutes: 40, weekdays: [1], end_date: null }),
  });
  expect(following.status).toBe(200);
  const all = await fx.sessions({ type: type.id });
  const newSeries = all.find((row) => row.occurrence_date === w1)!.series_id!;
  expect(newSeries).not.toBe(created.body.id);
  expect(seoulDateTime((await byDate(created.body.id, monday)).starts_at).time).toBe("19:00");
  const n1 = await byDate(newSeries, w1);
  expect([seoulDateTime(n1.starts_at).time, n1.is_modified, n1.status]).toEqual(["06:30", false, "scheduled"]);
  expect((await byDate(newSeries, w2)).status).toBe("cancelled");
  expect((await byDate(newSeries, w3)).status).toBe("deleted");
  expect((await byDate(newSeries, w4)).status).toBe("scheduled");

  // Restoring a cancelled class is rejected if the instructor got another class meanwhile.
  expect((await call(request, baseURL, "POST", "/api/classes/sessions", body(type.id, teacher.id, { date: w2, start_time: "06:40", duration_minutes: 30 }))).status).toBe(201);
  const restore = await patch((await byDate(newSeries, w2)).id, { action: "restore", scope: "one" });
  expect(restore.status).toBe(409);
  expect((await byDate(newSeries, w2)).status).toBe("cancelled");

  // Review regression: a "following" edit must still work while the cancelled slot is taken.
  const again = await patch((await byDate(newSeries, w1)).id, {
    action: "update",
    scope: "following",
    ...body(type.id, teacher.id, { start_time: "06:30", duration_minutes: 40, capacity: 25, weekdays: [1], end_date: null }),
  });
  expect(again.status).toBe(200);
  const latest = (await fx.sessions({ type: type.id })).find((row) => row.occurrence_date === w1 && row.status !== "deleted")!.series_id!;
  expect((await byDate(latest, w2)).status).toBe("cancelled");
  expect((await byDate(latest, w4)).capacity).toBe(25);
  // Single sessions are listed when a "following" edit overlaps them.
  const single = await call(request, baseURL, "POST", "/api/classes/sessions", body(type.id, teacher.id, { date: w4, start_time: "05:00", duration_minutes: 30 }));
  expect(single.status).toBe(201);
  const overlapSingle = await patch((await byDate(latest, w1)).id, {
    action: "update",
    scope: "following",
    ...body(type.id, teacher.id, { start_time: "05:10", duration_minutes: 30, weekdays: [1], end_date: null }),
  });
  expect(overlapSingle.status).toBe(409);
  expect(overlapSingle.body.conflicts.map((item: { id: string }) => item.id)).toContain(single.body.id);
  const newSeries2 = latest;

  expect((await call(request, baseURL, "DELETE", `/api/classes/sessions/${(await byDate(newSeries2, w4)).id}`, { scope: "following" })).status).toBe(200);
  const remaining = (await fx.sessions({ series: newSeries2 })).map((row) => row.occurrence_date!);
  expect(remaining.every((date) => date < w4)).toBe(true);
  await call(request, baseURL, "GET", `/api/classes/sessions?from=${w4}&to=${addDays(w4, 6)}`);
  expect((await fx.sessions({ series: newSeries2 })).every((row) => row.occurrence_date! < w4)).toBe(true);
});

test("지난 회차는 변경할 수 없고 1년 범위는 자동으로 다시 채워진다", async ({ request, baseURL }) => {
  const type = await fx.type();
  const teacher = await fx.instructor();
  const past = await fx.admin
    .from("class_sessions")
    .insert({
      class_type_id: type.id,
      instructor_id: teacher.id,
      starts_at: new Date(Date.now() - 2 * 3600_000).toISOString(),
      ends_at: new Date(Date.now() - 3600_000).toISOString(),
      capacity: 10,
    })
    .select("id")
    .single();
  const path = `/api/classes/sessions/${past.data!.id}`;
  expect((await call(request, baseURL, "PATCH", path, { action: "cancel", scope: "one" })).status).toBe(409);
  expect((await call(request, baseURL, "DELETE", path, { scope: "one" })).status).toBe(409);
  expect((await call(request, baseURL, "PATCH", path, { action: "update", scope: "one", ...body(type.id, teacher.id, { date: futureMonday() }) })).status).toBe(409);
  const today = seoulDateTime(new Date(Date.now() - 2 * 3600_000).toISOString()).date;
  const listed = await call(request, baseURL, "GET", `/api/classes/sessions?from=${today}&to=${today}`);
  expect(listed.body.sessions.find((item: { id: string }) => item.id === past.data!.id)?.is_past).toBe(true);

  const created = await call(request, baseURL, "POST", "/api/classes/sessions", body(type.id, teacher.id, { date: futureMonday(), repeat: true, weekdays: [4] }));
  const full = (await fx.sessions({ series: created.body.id })).length;
  const cut = addDays(scheduleHorizon(seoulToday()), -30);
  // Other workers' schedule requests may refill concurrently, so check the removal itself.
  const removed = await fx.admin.from("class_sessions").delete({ count: "exact" }).eq("series_id", created.body.id).gt("occurrence_date", cut);
  expect(removed.count).toBeGreaterThan(0);
  await fx.admin.from("class_series").update({ generated_until: cut }).eq("id", created.body.id);
  await call(request, baseURL, "GET", `/api/classes/sessions?from=${today}&to=${today}`);
  expect((await fx.sessions({ series: created.body.id })).length).toBe(full);
});

test("강사가 아닌 직원·비활성 직원·사용 중지 종류·잘못된 ID·Origin 불일치 거부", async ({ request, baseURL }) => {
  const type = await fx.type();
  const stopped = await fx.type("중지", { is_active: false });
  const teacher = await fx.instructor();
  const plain = await fx.instructor({ instructor: false });
  const inactive = await fx.instructor();
  await fx.admin.from("staff").update({ is_active: false }).eq("id", inactive.id);
  const date = futureMonday();
  const post = (data: Record<string, unknown>) => call(request, baseURL, "POST", "/api/classes/sessions", data);
  expect((await post(body(type.id, plain.id, { date }))).status).toBe(400);
  expect((await post(body(type.id, inactive.id, { date }))).status).toBe(400);
  expect((await post(body(stopped.id, teacher.id, { date }))).status).toBe(400);
  expect((await post(body(type.id, "11111111-1111-4111-8111-111111111111", { date }))).status).toBe(400);
  expect((await post(body("bad", teacher.id, { date }))).status).toBe(400);
  expect((await call(request, baseURL, "PATCH", "/api/classes/sessions/11111111-1111-4111-8111-111111111111", { action: "cancel", scope: "one" })).status).toBe(404);
  const forged = await request.post("/api/classes/sessions", { headers: { origin: "https://invalid.example" }, data: body(type.id, teacher.id, { date }) });
  expect(forged.status()).toBe(403);
  expect(await fx.sessions({ type: type.id })).toHaveLength(0);
});

test("강사 해제·비활성화·영구 삭제 시 앞으로의 회차는 강사 미정, 재지정 가능", async ({ request, baseURL }) => {
  const type = await fx.type();
  const [a, b, c, next] = [await fx.instructor(), await fx.instructor(), await fx.instructor(), await fx.instructor()];
  const monday = futureMonday();
  const pastOf = async (id: string, hours: number) =>
    (
      await fx.admin
        .from("class_sessions")
        .insert({
          class_type_id: type.id,
          instructor_id: id,
          starts_at: new Date(Date.now() - (hours + 1) * 3600_000).toISOString(),
          ends_at: new Date(Date.now() - hours * 3600_000).toISOString(),
          capacity: 10,
        })
        .select("id")
        .single()
    ).data!.id;
  const series: Record<string, string> = {};
  for (const [teacher, weekday] of [[a, 1], [b, 2], [c, 3]] as const) {
    series[teacher.id] = (await call(request, baseURL, "POST", "/api/classes/sessions", body(type.id, teacher.id, { date: monday, repeat: true, weekdays: [weekday], end_date: addDays(monday, 20) }))).body.id;
  }
  const pastA = await pastOf(a.id, 30);
  const pastC = await pastOf(c.id, 40);
  const staff = (await call(request, baseURL, "GET", "/api/staff")).body.staff;
  expect(staff.find((row: { id: string }) => row.id === a.id).upcoming_sessions).toBe(3);

  expect((await call(request, baseURL, "PATCH", `/api/staff/${a.id}`, { action: "instructor", is_instructor: false })).status).toBe(200);
  expect((await call(request, baseURL, "PATCH", `/api/staff/${b.id}`, { action: "status", is_active: false })).status).toBe(200);
  expect((await call(request, baseURL, "DELETE", `/api/staff/${c.id}`, {})).status).toBe(200);
  for (const teacher of [a, b, c])
    expect((await fx.sessions({ series: series[teacher.id] })).every((row) => row.instructor_id === null)).toBe(true);
  const past = await fx.admin.from("class_sessions").select("id,instructor_id").in("id", [pastA, pastC]);
  expect(Object.fromEntries(past.data!.map((row) => [row.id, row.instructor_id]))).toEqual({ [pastA]: a.id, [pastC]: null });

  const listed = await call(request, baseURL, "GET", `/api/classes/sessions?from=${monday}&to=${addDays(monday, 6)}`);
  const unassigned = listed.body.sessions.find((item: { series_id: string }) => item.series_id === series[a.id]);
  expect(unassigned.instructor_name).toBeNull();
  const reassigned = await call(request, baseURL, "PATCH", `/api/classes/sessions/${unassigned.id}`, {
    action: "update",
    scope: "one",
    ...body(type.id, next.id, { date: monday }),
  });
  expect(reassigned.status).toBe(200);
  expect((await fx.sessions({ series: series[a.id] }))[0].instructor_id).toBe(next.id);
});
