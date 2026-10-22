import { expect, test } from "@playwright/test";
import { provisionStaff } from "../src/lib/auth/provision";

test("프로필 저장 실패 시 이번에 생성한 Auth 계정만 정리한다", async () => {
  const events: string[] = [];
  await expect(
    provisionStaff({
      create: async () => {
        events.push("create");
        return { id: "new-account" };
      },
      insert: async (id) => {
        events.push("insert:" + id);
        throw new Error("DB unavailable");
      },
      remove: async (id) => {
        events.push("remove:" + id);
      },
    }),
  ).rejects.toThrow("직원 저장에 실패");
  expect(events).toEqual([
    "create",
    "insert:new-account",
    "remove:new-account",
  ]);
});
test("Auth 생성 실패 시 기존 계정을 삭제하지 않는다", async () => {
  let removed = false;
  await expect(
    provisionStaff({
      create: async () => {
        throw new Error("duplicate");
      },
      insert: async () => {},
      remove: async () => {
        removed = true;
      },
    }),
  ).rejects.toThrow("duplicate");
  expect(removed).toBe(false);
});
test("보상 처리 실패를 성공으로 표시하지 않고 복구 안내를 반환한다", async () => {
  await expect(
    provisionStaff({
      create: async () => ({ id: "new-account" }),
      insert: async () => {
        throw new Error("DB");
      },
      remove: async () => {
        throw new Error("Auth");
      },
    }),
  ).rejects.toThrow("계정 정리를 요청");
});
