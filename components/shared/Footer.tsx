export function Footer() {
  return (
    <footer className="border-t border-border/60 bg-background">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div>
          <p className="text-sm font-medium text-foreground">GitHub Scout</p>
          <p className="text-xs text-muted-foreground">
            AI-powered repository intelligence
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()}
        </p>
      </div>
    </footer>
  );
}
