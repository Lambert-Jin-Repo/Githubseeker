"use client";

import { AlertCircle, RefreshCw } from "lucide-react";

interface ErrorBoundaryCardProps {
    title?: string;
    message?: string;
    onRetry?: () => void;
}

export function ErrorBoundaryCard({
    title = "Something went wrong",
    message = "An unexpected error occurred. Please try again.",
    onRetry,
}: ErrorBoundaryCardProps) {
    return (
        <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
            <div className="flex size-14 items-center justify-center rounded-full bg-destructive/10">
                <AlertCircle className="size-6 text-destructive" />
            </div>
            <div>
                <p className="font-serif text-lg font-semibold text-foreground">
                    {title}
                </p>
                <p className="mt-1 text-sm text-muted-foreground max-w-sm">
                    {message}
                </p>
            </div>
            {onRetry && (
                <button
                    onClick={onRetry}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                    <RefreshCw className="size-4" />
                    Try Again
                </button>
            )}
        </div>
    );
}
