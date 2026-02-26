export function Footer() {
  return (
    <footer className="border-t border-border/60 bg-background">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div>
          <p className="text-sm font-bold font-serif text-foreground tracking-tight">Git Scout</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            AI-powered repository intelligence
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs font-medium text-foreground">
            Built by Jin
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            &copy; {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </footer>
  );
}
