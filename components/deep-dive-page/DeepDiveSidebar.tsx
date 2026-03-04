"use client";

import { useEffect, useRef, useState } from "react";

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

  const handleClick = (id: string) => {
    document.getElementById(id)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

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
    <aside className="hidden lg:block" aria-label="Report navigation">
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
  );
}

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
