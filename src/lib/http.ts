// src/lib/http.ts
export async function safeParams<T extends Record<string, unknown>>(
  params: Promise<T> | T
): Promise<T> {
  return await params; // normalizes both forms; future-proof
}

export function json<T>(data: T, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), {
    headers: { "content-type": "application/json" },
    ...init,
  });
}

export function badRequest(message: string, issues?: unknown) {
  return json({ error: message, issues }, { status: 400 });
}

export function notFound(msg = "Not found") {
  return json({ error: msg }, { status: 404 });
}
