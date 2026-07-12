"use client";

export default function ErrorBoundary({
  error: _error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="signin-gate">
      <div className="gate-card">
        <div className="gate-icon">
          <span style={{ fontSize: 28 }}>⚠</span>
        </div>
        <h1>Something went wrong</h1>
        <p>The dashboard could not be loaded. The backend may be temporarily unavailable.</p>
        <button type="button" className="primary" onClick={reset} style={{ marginTop: 8 }}>
          Try again
        </button>
      </div>
    </main>
  );
}
