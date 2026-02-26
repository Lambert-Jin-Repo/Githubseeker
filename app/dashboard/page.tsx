import { Header } from "@/components/shared/Header";
import { Footer } from "@/components/shared/Footer";
import { DashboardContent } from "@/components/dashboard/DashboardContent";

export const metadata = {
    title: "Dashboard — Git Scout",
    description: "Your repository intelligence at a glance.",
};

export default function DashboardPage() {
    return (
        <div className="flex min-h-screen flex-col bg-background">
            <Header />

            <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-10 animate-slide-up">
                <div className="mb-8">
                    <h1 className="font-serif font-bold text-3xl text-foreground">
                        Dashboard
                    </h1>
                    <p className="mt-2 text-sm text-muted-foreground">
                        Your repository intelligence at a glance.
                    </p>
                </div>

                <DashboardContent />
            </main>

            <Footer />
        </div>
    );
}
