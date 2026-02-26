import { Header } from "@/components/shared/Header";
import { Footer } from "@/components/shared/Footer";
import { HistoryList } from "@/components/history/HistoryList";

export const metadata = {
  title: "Search History — Git Scout",
  description: "Review your past repository searches.",
};

export default function HistoryPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10 animate-slide-up">
        <div className="mb-8">
          <h1 className="font-serif font-bold text-3xl text-foreground">
            Search History
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your recent repository discoveries.
          </p>
        </div>

        <HistoryList />
      </main>

      <Footer />
    </div>
  );
}
