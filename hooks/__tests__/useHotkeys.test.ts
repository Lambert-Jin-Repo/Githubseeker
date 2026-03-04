import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useHotkeys } from "../useHotkeys";

function fireKeydown(
  key: string,
  options: Partial<KeyboardEventInit> = {},
  target?: HTMLElement
) {
  const event = new KeyboardEvent("keydown", {
    key,
    bubbles: true,
    cancelable: true,
    ...options,
  });

  if (target) {
    // Append the target to the document so events bubble up to document listener
    document.body.appendChild(target);
    target.dispatchEvent(event);
    document.body.removeChild(target);
  } else {
    document.dispatchEvent(event);
  }

  return event;
}

describe("useHotkeys", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should trigger callback for a simple key press", () => {
    const handler = vi.fn();
    renderHook(() => useHotkeys({ j: handler }));

    fireKeydown("j");
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("should trigger callback for the ? key", () => {
    const handler = vi.fn();
    renderHook(() => useHotkeys({ "?": handler }));

    fireKeydown("?", { shiftKey: true });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("should trigger callback for the / key", () => {
    const handler = vi.fn();
    renderHook(() => useHotkeys({ "/": handler }));

    fireKeydown("/");
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("should trigger callback for the Escape key", () => {
    const handler = vi.fn();
    renderHook(() => useHotkeys({ Escape: handler }));

    fireKeydown("Escape");
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("should trigger callback for bracket keys", () => {
    const leftHandler = vi.fn();
    const rightHandler = vi.fn();
    renderHook(() => useHotkeys({ "[": leftHandler, "]": rightHandler }));

    fireKeydown("[");
    fireKeydown("]");
    expect(leftHandler).toHaveBeenCalledTimes(1);
    expect(rightHandler).toHaveBeenCalledTimes(1);
  });

  it("should trigger callback for modifier combos like ctrl+k", () => {
    const handler = vi.fn();
    renderHook(() => useHotkeys({ "ctrl+k": handler }));

    fireKeydown("k", { ctrlKey: true });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("should NOT trigger for ctrl+k when pressing k without ctrl", () => {
    const handler = vi.fn();
    renderHook(() => useHotkeys({ "ctrl+k": handler }));

    fireKeydown("k");
    expect(handler).not.toHaveBeenCalled();
  });

  it("should ignore keydown events when target is an INPUT element", () => {
    const handler = vi.fn();
    renderHook(() => useHotkeys({ j: handler }));

    const input = document.createElement("input");
    fireKeydown("j", {}, input);
    expect(handler).not.toHaveBeenCalled();
  });

  it("should ignore keydown events when target is a TEXTAREA element", () => {
    const handler = vi.fn();
    renderHook(() => useHotkeys({ j: handler }));

    const textarea = document.createElement("textarea");
    fireKeydown("j", {}, textarea);
    expect(handler).not.toHaveBeenCalled();
  });

  it("should ignore keydown events when target is contenteditable", () => {
    const handler = vi.fn();
    renderHook(() => useHotkeys({ j: handler }));

    const div = document.createElement("div");
    div.contentEditable = "true";
    fireKeydown("j", {}, div);
    expect(handler).not.toHaveBeenCalled();
  });

  it("should not trigger for unmapped keys", () => {
    const handler = vi.fn();
    renderHook(() => useHotkeys({ j: handler }));

    fireKeydown("x");
    expect(handler).not.toHaveBeenCalled();
  });

  it("should clean up listener on unmount", () => {
    const handler = vi.fn();
    const { unmount } = renderHook(() => useHotkeys({ j: handler }));

    unmount();
    fireKeydown("j");
    expect(handler).not.toHaveBeenCalled();
  });

  it("should handle multiple keys in the same keymap", () => {
    const jHandler = vi.fn();
    const kHandler = vi.fn();
    renderHook(() => useHotkeys({ j: jHandler, k: kHandler }));

    fireKeydown("j");
    fireKeydown("k");
    expect(jHandler).toHaveBeenCalledTimes(1);
    expect(kHandler).toHaveBeenCalledTimes(1);
  });

  it("should re-bind when deps change", () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    const { rerender } = renderHook(
      ({ handler }) => useHotkeys({ j: handler }, [handler]),
      { initialProps: { handler: handler1 } }
    );

    fireKeydown("j");
    expect(handler1).toHaveBeenCalledTimes(1);

    rerender({ handler: handler2 });

    fireKeydown("j");
    expect(handler2).toHaveBeenCalledTimes(1);
    // handler1 should not be called again after rerender
    expect(handler1).toHaveBeenCalledTimes(1);
  });

  it("should pass the KeyboardEvent to the handler", () => {
    const handler = vi.fn();
    renderHook(() => useHotkeys({ j: handler }));

    fireKeydown("j");
    expect(handler).toHaveBeenCalledWith(expect.any(KeyboardEvent));
    expect(handler.mock.calls[0][0].key).toBe("j");
  });

  it("should trigger callback for Enter key", () => {
    const handler = vi.fn();
    renderHook(() => useHotkeys({ Enter: handler }));

    fireKeydown("Enter");
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
