import { AppError } from "./validation";

type Created = { id: string };
type Provisioner = {
  create: () => Promise<Created>;
  insert: (id: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
};
// Auth and Postgres writes are not one transaction. Compensate only our new account.
export async function provisionStaff(operations: Provisioner) {
  const account = await operations.create();
  try {
    await operations.insert(account.id);
  } catch {
    try {
      await operations.remove(account.id);
    } catch {
      throw new AppError(
        "계정 생성이 중단됐습니다. 관리자에게 계정 정리를 요청해주세요.",
        503,
      );
    }
    throw new AppError("직원 저장에 실패했습니다. 다시 시도해주세요.", 503);
  }
}
