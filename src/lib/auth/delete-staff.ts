import { AppError } from "./validation";

type DeleteOperations = {
  revoke: () => Promise<boolean>;
  remove: () => Promise<void>;
};
export async function deleteSubAdmin(operations: DeleteOperations) {
  let found: boolean;
  try {
    found = await operations.revoke();
  } catch {
    throw new AppError(
      "계정 접근을 차단하지 못해 삭제를 중단했습니다. 다시 시도해주세요.",
      503,
    );
  }
  if (!found)
    throw new AppError("삭제할 수 없거나 이미 삭제된 계정입니다.", 404);
  try {
    await operations.remove();
  } catch {
    throw new AppError(
      "계정 접근은 차단했으나 삭제 완료를 확인하지 못했습니다. 목록을 확인한 뒤 삭제를 재시도하거나 재활성화해주세요.",
      503,
    );
  }
}
