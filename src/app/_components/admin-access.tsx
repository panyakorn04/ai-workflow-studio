"use client";

import { LockKeyhole, LogOut } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { AdminSessionState } from "../_hooks/use-admin-session";

type AdminAccessProps = AdminSessionState & {
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
};

export function AdminAccess({ authenticated, user, loading, error, login, logout }: AdminAccessProps) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    emailRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        requestAnimationFrame(() => triggerRef.current?.focus());
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  if (loading && !open)
    return (
      <div className="admin-access muted" aria-live="polite">
        Checking admin access…
      </div>
    );
  if (authenticated) {
    return (
      <div className="admin-access">
        <span>
          <LockKeyhole size={14} />
          {user?.name || user?.email || "Admin"}
        </span>
        <button type="button" onClick={() => void logout()} disabled={loading}>
          <LogOut size={14} />
          Sign out
        </button>
      </div>
    );
  }
  if (!open)
    return (
      <div className="admin-access">
        <span className="read-only">Read-only</span>
        <button ref={triggerRef} type="button" aria-haspopup="dialog" onClick={() => setOpen(true)}>
          <LockKeyhole size={14} />
          Admin sign in
        </button>
        {error && <small role="alert">{error}</small>}
      </div>
    );

  return (
    <form
      ref={formRef}
      className="admin-login"
      role="dialog"
      aria-modal="true"
      aria-label="Admin sign in"
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const controls = formRef.current?.querySelectorAll<HTMLElement>("input, button:not(:disabled)");
        if (!controls?.length) return;
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }}
      onSubmit={async (event) => {
        event.preventDefault();
        if (await login(email, password)) {
          setPassword("");
          setOpen(false);
          requestAnimationFrame(() => triggerRef.current?.focus());
        }
      }}
    >
      <label>
        Email
        <input
          ref={emailRef}
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>
      <label>
        Password
        <input
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      {error && <small role="alert">{error}</small>}
      <div>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            requestAnimationFrame(() => triggerRef.current?.focus());
          }}
          disabled={loading}
        >
          Cancel
        </button>
        <button type="submit" className="primary" disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </div>
    </form>
  );
}
