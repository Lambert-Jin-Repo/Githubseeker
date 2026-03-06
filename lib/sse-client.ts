/**
 * Shared SSE client helper — eliminates EventSource boilerplate
 * across `useScoutStream` and `useGlobalSearchStream`.
 */

export interface SSEClientOptions {
  /** URL to connect to */
  url: string;
  /** Map of event names to handlers. Data is auto-parsed from JSON. */
  handlers: Record<string, (data: unknown) => void>;
  /** Called when the connection opens */
  onOpen?: () => void;
  /** Called when all reconnection attempts are exhausted */
  onConnectionLost?: () => void;
  /** Called when the stream completes (phase1_complete event) */
  onComplete?: () => void;
  /**
   * Called when the server sends a custom "error" SSE event.
   * Return `true` to close the stream, `false` to keep listening.
   */
  onServerError?: (data: { message?: string; recoverable?: boolean }) => boolean;
  /** Max reconnection attempts (default: 3) */
  maxReconnects?: number;
}

export interface SSEClientHandle {
  close: () => void;
}

/**
 * Creates a managed EventSource connection with:
 * - Safe JSON.parse on all event data
 * - Automatic reconnection with linear backoff
 * - Server error detection to prevent pointless reconnects
 */
export function createSSEClient(options: SSEClientOptions): SSEClientHandle {
  const {
    url,
    handlers,
    onOpen,
    onConnectionLost,
    onComplete,
    onServerError,
    maxReconnects = 3,
  } = options;

  let es: EventSource | null = null;
  let reconnectAttempts = 0;
  let serverErrorReceived = false;
  let closed = false;

  function connect() {
    if (closed) return;

    es = new EventSource(url);

    es.onopen = () => {
      reconnectAttempts = 0;
      onOpen?.();
    };

    // Register all user-provided handlers with safe JSON parsing
    for (const [event, handler] of Object.entries(handlers)) {
      es.addEventListener(event, (e) => {
        try {
          handler(JSON.parse(e.data));
        } catch {
          /* malformed SSE payload — skip */
        }
      });
    }

    // Handle custom "error" SSE events from the server
    es.addEventListener("error", (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data);
        serverErrorReceived = true;
        const shouldClose = onServerError?.(data) ?? true;
        if (shouldClose) {
          es?.close();
        }
      } catch {
        // Not a JSON payload — native EventSource error, handled by onerror
      }
    });

    // Handle the phase1_complete terminal event
    es.addEventListener("phase1_complete", () => {
      onComplete?.();
      es?.close();
    });

    // Native EventSource error (network drop, etc.)
    es.onerror = () => {
      if (serverErrorReceived) {
        es?.close();
        return;
      }
      if (reconnectAttempts < maxReconnects) {
        reconnectAttempts += 1;
        es?.close();
        setTimeout(connect, 1000 * reconnectAttempts);
      } else {
        es?.close();
        onConnectionLost?.();
      }
    };
  }

  connect();

  return {
    close() {
      closed = true;
      es?.close();
    },
  };
}
