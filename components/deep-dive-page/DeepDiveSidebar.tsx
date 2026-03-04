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
}

export function DeepDiveSidebar({ items }: DeepDiveSidebarProps) {
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

  // Group items: pre-separator (overview, compare), repos, post-separator (gaps)
  const preItems = items.filter(
    (i) => i.type === "section" && i.id !== "gaps"
  );
  const repoItems = items.filter((i) => i.type === "repo");
  const postItems = items.filter(
    (i) => i.type === "section" && i.id === "gaps"
  );

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
          {items.map((item) => (
            <MobileTabPill
              key={item.id}
              ref={setPillRef(item.id)}
              item={item}
              isActive={activeId === item.id}
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
          {preItems.map((item) => (
            <SidebarButton
              key={item.id}
              item={item}
              isActive={activeId === item.id}
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

          {repoItems.map((item) => (
            <SidebarButton
              key={item.id}
              item={item}
              isActive={activeId === item.id}
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

          {postItems.map((item) => (
            <SidebarButton
              key={item.id}
              item={item}
              isActive={activeId === item.id}
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
    onClick: (id: string) => void;
  }
>(function MobileTabPill({ item, isActive, onClick }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={() => onClick(item.id)}
      className={cn(
        "shrink-0 whitespace-nowrap rounded-full px-3.5 py-2 text-xs font-medium transition-colors min-h-[44px] min-w-[44px]",
        isActive
          ? "bg-teal text-teal-foreground shadow-sm"
          : "bg-muted text-muted-foreground hover:bg-muted/80"
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
  onClick,
}: {
  item: SidebarItem;
  isActive: boolean;
  onClick: (id: string) => void;
}) {
  const baseClasses =
    "block w-full truncate rounded-md px-3 py-1.5 text-left transition-colors";
  const activeClasses = "bg-teal/10 font-medium text-teal";
  const inactiveClasses = "text-muted-foreground hover:bg-muted";
  const sizeClass = item.type === "repo" ? "text-xs" : "text-sm";

  return (
    <button
      type="button"
      onClick={() => onClick(item.id)}
      className={`${baseClasses} ${sizeClass} ${isActive ? activeClasses : inactiveClasses}`}
      aria-current={isActive ? "true" : undefined}
    >
      {item.label}
    </button>
  );
}
