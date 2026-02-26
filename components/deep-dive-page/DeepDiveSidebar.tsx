"use client";

import { useEffect, useRef, useState } from "react";

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

  // Group items: pre-separator (overview, compare), repos, post-separator (gaps)
  const preItems = items.filter(
    (i) => i.type === "section" && i.id !== "gaps"
  );
  const repoItems = items.filter((i) => i.type === "repo");
  const postItems = items.filter(
    (i) => i.type === "section" && i.id === "gaps"
  );

  return (
    <aside className="hidden lg:block" aria-label="Report navigation">
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
  );
}

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
