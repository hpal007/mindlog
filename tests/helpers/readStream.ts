// Helpers to drain a streaming Response body to text/lines in tests.

/** Drain a ReadableStream<Uint8Array> body to a single decoded string. */
export async function readStreamText(res: Response): Promise<string> {
  const body = res.body;
  if (!body) {
    // Non-streaming Response — fall back to text().
    return res.text();
  }
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let out = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) out += decoder.decode(value, { stream: true });
  }
  out += decoder.decode();
  return out;
}

/** Drain a streaming Response to non-empty NDJSON lines, each JSON-parsed. */
export async function readNdjson<T = unknown>(res: Response): Promise<T[]> {
  const text = await readStreamText(res);
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => JSON.parse(l) as T);
}

/** Build a Request for a Next.js route handler with a JSON body. */
export function jsonRequest(body: unknown, url = "http://test.local/api"): Request {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** Build a Request whose body is intentionally invalid JSON (for parse-failure tests). */
export function badJsonRequest(url = "http://test.local/api"): Request {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{ not json",
  });
}
