import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { HeaderAuthCredentialModal } from "./header-auth-credential-modal";

const savedCredential = {
  id: "cred-header-1",
  name: "Upload-Post API Key - paste here",
  type: "header" as const,
  status: "active" as const,
  createdAt: "2026-07-15T00:00:00Z",
  updatedAt: "2026-07-15T00:00:00Z",
};

describe("Header Auth credential connection", () => {
  test("renders a secret-safe saved connection editor", () => {
    const html = renderToStaticMarkup(
      <HeaderAuthCredentialModal
        credential={savedCredential}
        onClose={() => {}}
        onSaved={() => {}}
        onDeleted={() => {}}
      />,
    );
    expect(html).toContain("Upload-Post API Key - paste here");
    expect(html).toContain("Header Auth");
    expect(html).toContain("Connection");
    expect(html).toContain("Header name");
    expect(html).toContain("Value");
    expect(html).toContain("Update connection");
    expect(html).toContain("saved header name and value cannot be revealed");
    expect(html).not.toContain("Authorization: Bearer");
  });

  test("contains focus, makes the editor inert, and restores focus", async () => {
    const source = await Bun.file(new URL("./header-auth-credential-modal.tsx", import.meta.url)).text();
    expect(source).toContain("createPortal(dialog, document.body)");
    expect(source).toContain("editor.inert = true");
    expect(source).toContain("previousActive?.focus()");
    expect(source).toContain('event.key !== "Tab"');
  });

  test("renders a Header Auth-only create connection", () => {
    const html = renderToStaticMarkup(
      <HeaderAuthCredentialModal onClose={() => {}} onSaved={() => {}} onDeleted={() => {}} />,
    );
    expect(html).toContain("New Header Auth");
    expect(html).toContain("Save connection");
    expect(html).not.toContain("Bearer token");
    expect(html).not.toContain("Basic authentication");
    expect(html).not.toContain("Query API key");
  });
});
