"use client";

import { useCallback, useEffect, useState } from "react";

export type AdminUser = { name?: string; email: string; role?: string };
export type AdminSessionState = {
  authenticated: boolean;
  user: AdminUser | null;
  loading: boolean;
  error: string | null;
};

const initialState: AdminSessionState = { authenticated: false, user: null, loading: true, error: null };

function errorMessage(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object" && "error" in payload) {
    const error = (payload as { error?: { message?: unknown } }).error;
    if (typeof error?.message === "string") return error.message;
  }
  return fallback;
}

export function useAdminSession() {
  const [state, setState] = useState(initialState);

  const refresh = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const response = await fetch("/api/studio/session", { cache: "no-store" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setState({
          authenticated: false,
          user: null,
          loading: false,
          error: response.status === 401 ? null : errorMessage(payload, "Unable to check admin session."),
        });
        return;
      }
      const data = payload?.data;
      setState({ authenticated: data?.authenticated === true, user: data?.user ?? null, loading: false, error: null });
    } catch {
      setState({ authenticated: false, user: null, loading: false, error: "Unable to check admin session." });
    }
  }, []);

  useEffect(() => {
    let active = true;
    void fetch("/api/studio/session", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        if (!active) return;
        if (!response.ok) {
          setState({
            authenticated: false,
            user: null,
            loading: false,
            error: response.status === 401 ? null : errorMessage(payload, "Unable to check admin session."),
          });
          return;
        }
        const data = payload?.data;
        setState({
          authenticated: data?.authenticated === true,
          user: data?.user ?? null,
          loading: false,
          error: null,
        });
      })
      .catch(() => {
        if (active)
          setState({ authenticated: false, user: null, loading: false, error: "Unable to check admin session." });
      });
    return () => {
      active = false;
    };
  }, []);

  const login = async (email: string, password: string) => {
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const response = await fetch("/api/studio/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setState({ authenticated: false, user: null, loading: false, error: errorMessage(payload, "Sign-in failed.") });
        return false;
      }
      setState({ authenticated: true, user: payload?.data?.user ?? null, loading: false, error: null });
      return true;
    } catch {
      setState({ authenticated: false, user: null, loading: false, error: "Sign-in failed." });
      return false;
    }
  };

  const logout = async () => {
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      await fetch("/api/studio/session", { method: "DELETE" });
    } finally {
      setState({ authenticated: false, user: null, loading: false, error: null });
    }
  };

  return { ...state, login, logout, refresh };
}
