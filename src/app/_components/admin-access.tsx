"use client";

import { useState } from "react";
import { LockKeyhole, LogOut } from "lucide-react";
import type { AdminSessionState } from "../_hooks/use-admin-session";

type AdminAccessProps = AdminSessionState & {
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
};

export function AdminAccess({ authenticated, user, loading, error, login, logout }: AdminAccessProps) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  if (loading && !open) return <div className="admin-access muted" aria-live="polite">Checking admin access…</div>;
  if (authenticated) {
    return <div className="admin-access"><span><LockKeyhole size={14}/>{user?.name || user?.email || "Admin"}</span><button type="button" onClick={() => void logout()} disabled={loading}><LogOut size={14}/>Sign out</button></div>;
  }
  if (!open) return <div className="admin-access"><span className="read-only">Read-only</span><button type="button" onClick={() => setOpen(true)}><LockKeyhole size={14}/>Admin sign in</button>{error && <small role="alert">{error}</small>}</div>;

  return <form className="admin-login" onSubmit={async (event) => { event.preventDefault(); if (await login(email, password)) { setPassword(""); setOpen(false); } }}>
    <label>Email<input type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)}/></label>
    <label>Password<input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)}/></label>
    {error && <small role="alert">{error}</small>}
    <div><button type="button" onClick={() => setOpen(false)} disabled={loading}>Cancel</button><button className="primary" disabled={loading}>{loading ? "Signing in…" : "Sign in"}</button></div>
  </form>;
}
