import { request, type FullConfig } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";

export default async function setup(config: FullConfig) {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const run = randomBytes(8).toString("hex");
  const password = "E2e1!" + randomBytes(7).toString("base64url");
  const accounts: Record<
    string,
    { id: string; email: string; password: string }
  > = {};
  mkdirSync(process.env.PLAYWRIGHT_AUTH_DIR || "tests/.auth", { recursive: true, mode: 0o700 });
  try {
    for (const [kind, role, change] of [
      ["admin", "admin", false],
      ["sub", "sub_admin", false],
      ["initial", "sub_admin", true],
      ["orphan", "", false],
    ] as const) {
      const email = `pcome-e2e-${run}-${kind}@example.com`;
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (error) throw new Error("테스트 Auth 생성 실패: " + error.code);
      accounts[kind] = { id: data.user!.id, email, password };
      writeFileSync(`${process.env.PLAYWRIGHT_AUTH_DIR || "tests/.auth"}/accounts.json`, JSON.stringify(accounts), {
        mode: 0o600,
      });
      if (role) {
        const { error } = await admin
          .from("staff")
          .insert({
            id: data.user!.id,
            name: `검증 ${kind}`,
            role,
            is_active: true,
            must_change_password: change,
          });
        if (error) throw new Error("테스트 프로필 생성 실패: " + error.code);
      }
    }
    const baseURL = config.projects[0].use.baseURL!;
    const api = await request.newContext({
      baseURL,
      extraHTTPHeaders: { origin: new URL(baseURL).origin },
    });
    const response = await api.post("/api/auth/login", {
      data: { email: accounts.admin.email, password },
    });
    if (!response.ok())
      throw new Error(
        "테스트 관리자 로그인 실패: " +
          response.status() +
          " " +
          (await response.text()),
      );
    await api.storageState({ path: `${process.env.PLAYWRIGHT_AUTH_DIR || "tests/.auth"}/admin.json` });
    await api.dispose();
  } catch (error) {
    for (const account of Object.values(accounts))
      await admin.auth.admin.deleteUser(account.id);
    throw error;
  }
}
