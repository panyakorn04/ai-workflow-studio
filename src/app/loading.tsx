import { GitBranch } from "lucide-react";

export default function Loading() {
  return (
    <main className="signin-gate">
      <div className="gate-card">
        <div className="gate-icon">
          <GitBranch size={28} />
        </div>
        <h1>AI Workflow Studio</h1>
        <p>Loading your dashboard…</p>
      </div>
    </main>
  );
}
