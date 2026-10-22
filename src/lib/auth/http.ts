import "server-only";
import { AppError } from "./validation";
export function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}
export function failure(error: unknown) {
  if (error instanceof AppError)
    return json({ ...error.data, error: error.message }, error.status);
  // Do not serialize provider errors, request bodies or credentials.
  return json(
    {
      error:
        "요청을 처리하지 못했습니다. 연결 상태를 확인한 뒤 다시 시도해주세요.",
    },
    503,
  );
}
export async function readBody(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin)
    throw new AppError("허용되지 않은 요청입니다.", 403);
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new AppError("잘못된 요청입니다.", 415);
  const raw = await request.text();
  if (raw.length > 8192) throw new AppError("요청이 너무 큽니다.", 413);
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    throw new AppError("잘못된 요청입니다.");
  }
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw new AppError("잘못된 요청입니다.");
  return body as Record<string, unknown>;
}
