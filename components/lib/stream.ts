// Client-side helpers for consuming the streaming API responses.
// Kept tiny and pure so components stay focused.

/**
 * Reads an NDJSON (newline-delimited JSON) HTTP body. Calls `onLine` for each
 * parsed JSON object as it arrives. Tolerates partial lines across chunks and
 * a final line with no trailing newline. Non-JSON lines are skipped.
 */
export async function readNdjson(
  body: ReadableStream<Uint8Array>,
  onLine: (obj: unknown) => void,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let newlineIndex: number;
    while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);
      if (line) safeEmit(line, onLine);
    }
  }

  const tail = buffer.trim();
  if (tail) safeEmit(tail, onLine);
}

function safeEmit(line: string, onLine: (obj: unknown) => void): void {
  try {
    onLine(JSON.parse(line));
  } catch {
    // Ignore non-JSON noise so a malformed line never kills the stream.
  }
}

/**
 * Reads a streaming response that may be either NDJSON ({token}/{type}) OR a
 * plain-text token stream. For chat: yields incremental text. If a full JSON
 * object is seen it is returned via `onJson` (used to catch crisis payloads).
 */
export async function readTextOrNdjson(
  body: ReadableStream<Uint8Array>,
  onText: (chunk: string) => void,
  onJson: (obj: Record<string, unknown>) => void,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let newlineIndex: number;
    while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, newlineIndex);
      buffer = buffer.slice(newlineIndex + 1);
      emitChatLine(line, onText, onJson);
    }
  }
  if (buffer) emitChatLine(buffer, onText, onJson);
}

function emitChatLine(
  raw: string,
  onText: (chunk: string) => void,
  onJson: (obj: Record<string, unknown>) => void,
): void {
  const line = raw.trimEnd();
  if (!line) return;
  if (line.startsWith("{")) {
    try {
      const obj = JSON.parse(line) as Record<string, unknown>;
      if (typeof obj.token === "string") {
        onText(obj.token);
        return;
      }
      onJson(obj);
      return;
    } catch {
      // fall through to plain text
    }
  }
  onText(raw);
}
