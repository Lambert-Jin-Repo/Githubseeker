/**
 * Parses an SSE text chunk into individual events.
 * Handles the `event: xxx\ndata: {...}\n\n` format,
 * including partial chunks from streamed responses.
 */
export function parseSSEEvents(text: string): { event: string; data: string }[] {
  const events: { event: string; data: string }[] = [];
  const blocks = text.split("\n\n");

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    let eventName = "message";
    let dataLine = "";

    const lines = trimmed.split("\n");
    for (const line of lines) {
      if (line.startsWith("event: ")) {
        eventName = line.slice(7).trim();
      } else if (line.startsWith("data: ")) {
        dataLine = line.slice(6);
      }
    }

    if (dataLine) {
      events.push({ event: eventName, data: dataLine });
    }
  }

  return events;
}
