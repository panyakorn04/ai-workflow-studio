"use client";

import { Globe2, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { StudioCredential } from "@/lib/studio-admin";

export function HeaderAuthCredentialModal({
  credential,
  onClose,
  onSaved,
  onDeleted,
}: {
  credential?: StudioCredential;
  onClose: () => void;
  onSaved: (credential: StudioCredential) => void;
  onDeleted: (credentialId: string) => void;
}) {
  const editing = Boolean(credential);
  const [credentialName, setCredentialName] = useState(credential?.name ?? "");
  const [headerName, setHeaderName] = useState("");
  const [headerValue, setHeaderValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(editing ? "Saved" : "Not saved");
  const [error, setError] = useState("");
  const [portalReady, setPortalReady] = useState(false);
  const dialogRef = useRef<HTMLElement>(null);
  const savingRef = useRef(saving);
  savingRef.current = saving;

  useEffect(() => setPortalReady(true), []);

  useEffect(() => {
    if (!portalReady) return;
    const previousActive = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const editor = document.querySelector<HTMLElement>(".node-popup");
    const wasInert = editor?.inert ?? false;
    if (editor) editor.inert = true;
    dialogRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !savingRef.current) {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (editor) editor.inert = wasInert;
      previousActive?.focus();
    };
  }, [onClose, portalReady]);

  const save = async () => {
    setSaving(true);
    setError("");
    setStatus("Saving…");
    try {
      const response = await fetch("/api/studio/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: editing ? "update-credential" : "create-credential",
          ...(credential ? { id: credential.id } : {}),
          payload: {
            name: credentialName.trim(),
            type: "header",
            data: { name: headerName.trim(), value: headerValue },
          },
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error?.message ?? "Unable to save Header Auth.");
      setHeaderValue("");
      setStatus("Saved");
      onSaved(payload.data as StudioCredential);
    } catch (cause) {
      setStatus(editing ? "Saved" : "Not saved");
      setError(cause instanceof Error ? cause.message : "Unable to save Header Auth.");
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    if (!credential) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/studio/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test-credential", id: credential.id }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error?.message ?? "Header Auth test failed.");
      setStatus("Connection tested");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Header Auth test failed.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!credential || !window.confirm("Delete this Header Auth credential? Workflows using it will stop executing."))
      return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/studio/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete-credential", id: credential.id }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error?.message ?? "Unable to delete Header Auth.");
      onDeleted(credential.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to delete Header Auth.");
      setSaving(false);
    }
  };

  const valid = credentialName.trim().length >= 2 && headerName.trim().length > 0 && headerValue.length > 0;

  const dialog = (
    <div className="credential-modal-backdrop">
      <section
        ref={dialogRef}
        tabIndex={-1}
        className="credential-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`${credential?.name ?? "New Header Auth"} connection`}
      >
        <header className="credential-modal-header">
          <div className="credential-modal-heading">
            <span className="credential-modal-icon">
              <Globe2 size={20} />
            </span>
            <div>
              <strong>{credential?.name ?? "New Header Auth"}</strong>
              <span>Header Auth</span>
            </div>
          </div>
          <div className="credential-modal-actions">
            <span className="credential-save-state" role="status">
              {status}
            </span>
            {credential ? (
              <button type="button" aria-label="Delete Header Auth credential" disabled={saving} onClick={remove}>
                <Trash2 size={16} />
              </button>
            ) : null}
            <button type="button" aria-label="Close Header Auth connection" disabled={saving} onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        </header>
        <div className="credential-modal-body">
          <nav aria-label="Credential sections">
            <button type="button" className="active">
              Connection
            </button>
          </nav>
          <div className="credential-connection-form">
            <div className="credential-help">
              Header Auth adds one encrypted HTTP header at execution time. Secret values are never returned to the
              browser.
            </div>
            <label>
              Credential name
              <input
                value={credentialName}
                maxLength={120}
                onChange={(event) => setCredentialName(event.target.value)}
                placeholder="Upload-Post API Key"
              />
            </label>
            <label>
              Header name
              <input
                value={headerName}
                maxLength={128}
                autoComplete="off"
                onChange={(event) => setHeaderName(event.target.value)}
                placeholder={editing ? "Enter the header name again to rotate this connection" : "Authorization"}
              />
            </label>
            <label>
              Value
              <input
                type="password"
                value={headerValue}
                autoComplete="new-password"
                onChange={(event) => setHeaderValue(event.target.value)}
                placeholder={editing ? "Enter a new value to rotate this connection" : "Paste the header value"}
              />
            </label>
            {editing ? (
              <p className="credential-security-note">
                For security, the saved header name and value cannot be revealed. Enter both again only when rotating
                this connection.
              </p>
            ) : null}
            {error ? (
              <div className="http-field-error" role="alert">
                {error}
              </div>
            ) : null}
            <div className="credential-modal-footer">
              {credential ? (
                <button type="button" className="http-secondary-button" disabled={saving} onClick={test}>
                  Test connection
                </button>
              ) : (
                <span />
              )}
              <button type="button" className="manual-execute" disabled={saving || !valid} onClick={save}>
                {saving ? "Saving…" : editing ? "Update connection" : "Save connection"}
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );

  return portalReady && typeof document !== "undefined" ? createPortal(dialog, document.body) : dialog;
}
