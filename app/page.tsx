"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/shared/Header";
import { Footer } from "@/components/shared/Footer";
import { SearchInput } from "@/components/search/SearchInput";
import { ModeIndicator } from "@/components/search/ModeIndicator";
import { ExampleQueries } from "@/components/search/ExampleQueries";
import { detectMode } from "@/lib/mode-detection";
import type { ScoutMode } from "@/lib/types";

export default function HomePage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [detectedMode, setDetectedMode] = useState<ScoutMode | null>(null);
  const [isLoading, setIsLoading] = useState(false);

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
        const mode = detectedMode || "SCOUT";
        const res = await fetch("/api/scout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: searchQuery, mode }),
        });
        const data = await res.json();
        if (data.id) {
          router.push(`/scout/${data.id}`);
        }
      } catch {
        setIsLoading(false);
      }
    },
    [detectedMode, router]
  );

  const handleExample = useCallback((exampleQuery: string) => {
    setQuery(exampleQuery);
    const result = detectMode(exampleQuery);
    setDetectedMode(result.mode);
  }, []);

  return (
    <>
      <Header />
      <main id="main-content" className="flex flex-1 flex-col items-center justify-center px-4 sm:px-6">
        <div className="flex w-full max-w-2xl flex-col items-center gap-8 py-12 sm:py-24">
          {/* Hero heading */}
          <div className="text-center space-y-3 animate-slide-up">
            <h1 className="font-serif text-3xl sm:text-5xl md:text-6xl tracking-tight text-foreground">
              Discover what&rsquo;s been built
            </h1>
            <p className="text-lg text-muted-foreground font-sans max-w-md mx-auto leading-relaxed">
              AI-powered intelligence for open-source repositories.
              Search, verify, analyze.
            </p>
          </div>

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

          {/* Example queries */}
          <div className="w-full pt-4 animate-slide-up delay-4">
            <p className="text-center text-xs font-medium text-muted-foreground/60 mb-3 uppercase tracking-wider">
              Try an example
            </p>
            <ExampleQueries onSelect={handleExample} />
          </div>

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
