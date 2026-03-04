"use client";

import { forwardRef, useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface SidebarItem {
  id: string;
  label: string;
  type: "section" | "repo";
}

interface DeepDiveSidebarProps {
  items: SidebarItem[];
  /** Index of item highlighted via keyboard (j/k/[/]) — -1 = none */
  keyboardActiveIndex?: number;
}

export function DeepDiveSidebar({ items, keyboardActiveIndex = -1 }: DeepDiveSidebarProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const tabBarRef = useRef<HTMLDivElement | null>(null);
  const pillRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  useEffect(() => {
    // Clean up previous observer
    observerRef.current?.disconnect();

    const observer = new IntersectionObserver(
      (entries) => {
        // Find the first intersecting entry
        const intersecting = entries.filter((e) => e.isIntersecting);
        if (intersecting.length > 0) {
          // Pick the one closest to the top of the viewport
          const sorted = intersecting.sort(
            (a, b) => a.boundingClientRect.top - b.boundingClientRect.top
          );
          setActiveId(sorted[0].target.id);
        }
      },
      {
        rootMargin: "-100px 0px -60% 0px",
        threshold: 0,
      }
    );

    observerRef.current = observer;

    // Observe all section elements
    for (const item of items) {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [items]);

  // Scroll the active pill into view in the mobile tab bar
  useEffect(() => {
    if (!activeId || !tabBarRef.current) return;
    const pill = pillRefs.current.get(activeId);
    if (!pill) return;

    const container = tabBarRef.current;
    const pillLeft = pill.offsetLeft;
    const pillWidth = pill.offsetWidth;
    const containerWidth = container.offsetWidth;
    const scrollLeft = container.scrollLeft;

    // Scroll so the active pill is roughly centered
    const targetScroll = pillLeft - containerWidth / 2 + pillWidth / 2;
    // Only scroll if the pill is not already well within view
    if (
      pillLeft < scrollLeft + 16 ||
      pillLeft + pillWidth > scrollLeft + containerWidth - 16
    ) {
      container.scrollTo({ left: targetScroll, behavior: "smooth" });
    }
  }, [activeId]);

  const handleClick = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, []);

  const setPillRef = useCallback(
    (id: string) => (el: HTMLButtonElement | null) => {
      if (el) {
        pillRefs.current.set(id, el);
      } else {
        pillRefs.current.delete(id);
      }
    },
    []
  );

  // Group items with their original indices for keyboard highlight tracking
  const preItems = items
    .map((item, i) => ({ item, originalIndex: i }))
    .filter(({ item }) => item.type === "section" && item.id !== "gaps");
  const repoItems = items
    .map((item, i) => ({ item, originalIndex: i }))
    .filter(({ item }) => item.type === "repo");
  const postItems = items
    .map((item, i) => ({ item, originalIndex: i }))
    .filter(({ item }) => item.type === "section" && item.id === "gaps");

  return (
    <>
      {/* ── Mobile: horizontal scrollable tab bar ── */}
      <div
        className="md:hidden sticky top-16 z-30 -mx-4 sm:-mx-6 border-b border-border/50 bg-background/95 backdrop-blur-sm"
        aria-label="Report navigation"
        role="navigation"
      >
        <div
          ref={tabBarRef}
          className="deep-dive-tab-scroll flex gap-2 overflow-x-auto px-4 py-2.5 sm:px-6"
          style={{
            WebkitOverflowScrolling: "touch",
            scrollbarWidth: "none",
            msOverflowStyle: "none",
          } as React.CSSProperties}
        >
          {items.map((item, i) => (
            <MobileTabPill
              key={item.id}
              ref={setPillRef(item.id)}
              item={item}
              isActive={activeId === item.id}
              isKeyboardActive={i === keyboardActiveIndex}
              onClick={handleClick}
            />
          ))}
        </div>
      </div>

      {/* ── Tablet & Desktop: vertical sticky sidebar ── */}
      <aside
        className="hidden md:block"
        aria-label="Report navigation"
      >
        <nav className="sticky top-16 space-y-1">
          {preItems.map(({ item, originalIndex }) => (
            <SidebarButton
              key={item.id}
              item={item}
              isActive={activeId === item.id}
              isKeyboardActive={originalIndex === keyboardActiveIndex}
              onClick={handleClick}
            />
          ))}

          {repoItems.length > 0 && (
            <div
              className="my-2 h-px bg-border/50"
              role="separator"
              aria-hidden="true"
            />
          )}

          {repoItems.map(({ item, originalIndex }) => (
            <SidebarButton
              key={item.id}
              item={item}
              isActive={activeId === item.id}
              isKeyboardActive={originalIndex === keyboardActiveIndex}
              onClick={handleClick}
            />
          ))}

          {postItems.length > 0 && (
            <div
              className="my-2 h-px bg-border/50"
              role="separator"
              aria-hidden="true"
            />
          )}

          {postItems.map(({ item, originalIndex }) => (
            <SidebarButton
              key={item.id}
              item={item}
              isActive={activeId === item.id}
              isKeyboardActive={originalIndex === keyboardActiveIndex}
              onClick={handleClick}
            />
          ))}
        </nav>
      </aside>

      {/* Inline style for WebKit scrollbar hiding — scoped to the tab bar */}
      <style
        dangerouslySetInnerHTML={{
          __html: `.deep-dive-tab-scroll::-webkit-scrollbar{display:none}`,
        }}
      />
    </>
  );
}

/* ── Mobile tab pill ── */

const MobileTabPill = forwardRef<
  HTMLButtonElement,
  {
    item: SidebarItem;
    isActive: boolean;
    isKeyboardActive?: boolean;
    onClick: (id: string) => void;
  }
>(function MobileTabPill({ item, isActive, isKeyboardActive = false, onClick }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={() => onClick(item.id)}
      className={cn(
        "shrink-0 whitespace-nowrap rounded-full px-3.5 py-2 text-xs font-medium transition-colors min-h-[44px] min-w-[44px]",
        isActive
          ? "bg-teal text-teal-foreground shadow-sm"
          : "bg-muted text-muted-foreground hover:bg-muted/80",
        isKeyboardActive && "ring-2 ring-teal/40"
      )}
      aria-current={isActive ? "true" : undefined}
    >
      {item.label}
    </button>
  );
});

/* ── Desktop/Tablet sidebar button ── */

function SidebarButton({
  item,
  isActive,
  isKeyboardActive = false,
  onClick,
}: {
  item: SidebarItem;
  isActive: boolean;
  isKeyboardActive?: boolean;
  onClick: (id: string) => void;
}) {
  const baseClasses =
    "block w-full truncate rounded-md px-3 py-1.5 text-left transition-colors";
  const activeClasses = "bg-teal/10 font-medium text-teal";
  const inactiveClasses = "text-muted-foreground hover:bg-muted";
  const kbClasses = isKeyboardActive ? "ring-2 ring-teal/40" : "";
  const sizeClass = item.type === "repo" ? "text-xs" : "text-sm";

  return (
    <button
      type="button"
      onClick={() => onClick(item.id)}
      className={`${baseClasses} ${sizeClass} ${isActive ? activeClasses : inactiveClasses} ${kbClasses}`}
      aria-current={isActive ? "true" : undefined}
    >
      {item.label}
    </button>
  );
}
