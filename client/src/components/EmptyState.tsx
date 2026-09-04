export default function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="absolute inset-0 z-[450] flex items-center justify-center bg-canvas/95">
      <div className="max-w-xs text-center">
        <div className="w-10 h-10 mx-auto mb-3 rounded-full bg-line-soft flex items-center justify-center text-ink-faint">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v5M12 16h.01" />
          </svg>
        </div>
        <div className="font-semibold text-sm text-ink mb-1">{title}</div>
        <p className="text-xs text-ink-soft leading-relaxed">{body}</p>
      </div>
    </div>
  );
}
