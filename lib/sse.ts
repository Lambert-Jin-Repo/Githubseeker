export function sseEncode(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
} as const;

export function createSSEStream() {
  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController | null = null;
  let closed = false;

  const stream = new ReadableStream({
    start(c) {
      controller = c;
    },
  });

  return {
    stream,
    send(event: string, data: unknown) {
      try {
        controller?.enqueue(encoder.encode(sseEncode(event, data)));
      } catch {
        // Stream may have been closed
      }
    },
    safeClose() {
      if (!closed) {
        closed = true;
        try {
          controller?.close();
        } catch {
          /* already closed */
        }
      }
    },
    get closed() {
      return closed;
    },
  };
}
