export function PageLoader() {
  return (
    <div className="flex w-full flex-col items-center justify-center gap-4 py-24">
      <div className="relative h-10 w-10">
        <div className="absolute inset-0 animate-spin rounded-full border-[3px] border-purple-200 border-t-[var(--color-primary)]" />
      </div>
      <p className="text-sm font-medium text-[var(--color-text-muted)] animate-pulse">
        Cargando...
      </p>
    </div>
  );
}
