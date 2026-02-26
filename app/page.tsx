"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Header } from "@/components/shared/Header";
import { Footer } from "@/components/shared/Footer";
import { SearchInput } from "@/components/search/SearchInput";
import { ModeIndicator } from "@/components/search/ModeIndicator";
import { ExampleQueries } from "@/components/search/ExampleQueries";
import { SearchProgressNotification } from "@/components/search/SearchProgressNotification";
import { detectMode } from "@/lib/mode-detection";
import { getOrCreateSessionId } from "@/lib/session";
import { useSearchNotificationStore } from "@/stores/search-notification-store";
import { useScoutStore } from "@/stores/scout-store";
import type { ScoutMode } from "@/lib/types";

export default function HomePage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [detectedMode, setDetectedMode] = useState<ScoutMode | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const notifStatus = useSearchNotificationStore((s) => s.status);
  const startSearch = useSearchNotificationStore((s) => s.startSearch);

  // Debounced mode detection
  useEffect(() => {
    if (query.trim().length < 3) {
      setDetectedMode(null);
      return;
    }
    const timer = setTimeout(() => {
      const result = detectMode(query);
      setDetectedMode(result.mode);
    }, 500);
    return () => clearTimeout(timer);
  }, [query]);

  const handleSubmit = useCallback(
    async (searchQuery: string) => {
      setIsLoading(true);
      try {
        // Ensure session cookie exists before making the request
        getOrCreateSessionId();
        const mode = detectedMode || "SCOUT";
        const res = await fetch("/api/scout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: searchQuery, mode }),
        });
        const data = await res.json();
        if (data.id) {
          if (data.cached) {
            // Cached results — navigate immediately
            router.push(`/scout/${data.id}?cached=true`);
          } else {
            // Fresh search — start global notification + SSE stream
            // Reset the scout store for fresh data
            useScoutStore.getState().reset();
            startSearch(data.id, searchQuery, mode);
          }
        }
      } catch {
        // Error handled silently
      } finally {
        setIsLoading(false);
      }
    },
    [detectedMode, router, startSearch]
  );

  const handleExample = useCallback((exampleQuery: string) => {
    setQuery(exampleQuery);
    const result = detectMode(exampleQuery);
    setDetectedMode(result.mode);
  }, []);

  const isSearchActive = notifStatus !== "idle";

  return (
    <>
      <Header />
      <main id="main-content" className="flex flex-1 flex-col items-center justify-center px-4 sm:px-6">
        <div className="flex w-full max-w-2xl flex-col items-center gap-8 py-12 sm:py-24">
          {/* Hero heading */}
          <motion.div
            className="text-center space-y-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <h1 className="font-serif font-bold text-4xl sm:text-6xl md:text-7xl tracking-tighter text-foreground">
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-teal to-blue-600">Discover</span> what&rsquo;s been built
            </h1>
            <p className="text-lg text-muted-foreground font-sans max-w-lg mx-auto leading-relaxed">
              AI-powered intelligence for open-source repositories.
              Search, verify, analyze.
            </p>
          </motion.div>

          {/* Search input */}
          <div className="animate-slide-up delay-2 w-full flex flex-col items-center gap-4">
            <SearchInput
              onSubmit={handleSubmit}
              isLoading={isLoading}
              defaultValue={query}
            />
            <ModeIndicator
              mode={detectedMode}
              onOverride={setDetectedMode}
            />
          </div>

          {/* Center notification — replaces auto-navigation */}
          {isSearchActive && <SearchProgressNotification />}

          {/* Example queries — hide when search is active */}
          {!isSearchActive && (
            <div className="w-full pt-4 animate-slide-up delay-4">
              <p className="text-center text-xs font-medium text-muted-foreground/60 mb-3 uppercase tracking-wider">
                Try an example
              </p>
              <ExampleQueries onSelect={handleExample} />
            </div>
          )}

          {/* How it works */}
          <section className="w-full pt-8 animate-slide-up delay-6" aria-labelledby="how-it-works-heading">
            <h2 id="how-it-works-heading" className="sr-only">How it works</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {[
                { step: "01", title: "Search", desc: "Describe what you're looking for in plain language" },
                { step: "02", title: "Discover", desc: "AI searches multiple strategies and verifies every result" },
                { step: "03", title: "Deep Dive", desc: "Get architecture analysis, AI patterns, and recommendations" },
              ].map((item) => (
                <div key={item.step} className="text-center space-y-2">
                  <span className="text-xs font-mono font-medium text-teal tracking-wider" aria-hidden="true">{item.step}</span>
                  <h3 className="font-serif text-lg text-foreground">{item.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}

