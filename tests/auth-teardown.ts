import { createClient } from "@supabase/supabase-js";
import { readFileSync, rmSync } from "node:fs";
export default async function teardown() {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  try {
    const accounts = JSON.parse(
      readFileSync(`${process.env.PLAYWRIGHT_AUTH_DIR || "tests/.auth"}/accounts.json`, "utf8"),
    ) as Record<string, { id: string }>;
    for (const account of Object.values(accounts)) {
      const { error } = await admin.auth.admin.deleteUser(account.id);
      if (error && error.status !== 404)
        throw new Error("테스트 계정 정리 실패");
    }
    rmSync(process.env.PLAYWRIGHT_AUTH_DIR || "tests/.auth", { recursive: true, force: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}
