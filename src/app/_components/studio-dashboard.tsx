"use client";
import {
  Activity,
  ArrowUpRight,
  Check,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Command,
  GitBranch,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { StudioOverview } from "@/lib/studio-api";
import { type ExecutionStatus, summarizeExecutions } from "@/lib/workflows";
import { useAdminSession } from "../_hooks/use-admin-session";
import { useExecutionStream } from "../_hooks/use-execution-stream";
import { useStudioCommand } from "../_hooks/use-studio-command";
import { useWorkflowStudio } from "../_hooks/use-workflow-studio";
import { AdminAccess } from "./admin-access";
import { Sidebar } from "./sidebar";

const WorkflowForm = dynamic(() => import("./workflow-form").then((mod) => mod.WorkflowForm), { ssr: false });

const statusLabel: Record<ExecutionStatus, string> = {
  completed: "Completed",
  running: "Running",
  failed: "Failed",
  waiting: "Approval",
  paused: "Paused",
  approved: "Approved",
  cancelled: "Cancelled",
};

function SignInGate({
  login,
  error,
}: {
  login: (email: string, password: string) => Promise<boolean>;
  error: string | null;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    emailRef.current?.focus();
  }, []);
  const submit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      setBusy(true);
      await login(email, password);
      setPassword("");
      setBusy(false);
    },
    [email, password, login],
  );
  return (
    <main className="signin-gate">
      <div className="gate-card">
        <div className="gate-icon">
          <GitBranch size={28} />
        </div>
        <h1>AI Workflow Studio</h1>
        <p>
          Sign in with your admin account to manage agent workflows, monitor executions, and control the automation
          plane.
        </p>
        <form onSubmit={submit}>
          <label>
            Email
            <input
              ref={emailRef}
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label>
            Password
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error && <small role="alert">{error}</small>}
          <button type="submit" className="primary" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}

function LoadingGate() {
  return (
    <main className="signin-gate">
      <div className="gate-card">
        <div className="gate-icon">
          <GitBranch size={28} />
        </div>
        <h1>AI Workflow Studio</h1>
        <p>Verifying your session…</p>
      </div>
    </main>
  );
}

export function StudioDashboard({ data, appVersion }: { data: StudioOverview; appVersion: string }) {
  const studio = useWorkflowStudio(data);
  const router = useRouter();
  const admin = useAdminSession();
  const command = useStudioCommand(admin.authenticated, admin.refresh);
  const [editingWorkflow, setEditingWorkflow] = useState<StudioOverview["workflows"][number] | null | undefined>(
    undefined,
  );
  const { executions, stages: loopStages } = data;
  const selected = executions.find((x) => x.id === studio.selectedRun) ?? executions[0];
  const fallbackSnapshot = useMemo(
    () => ({
      execution: selected,
      stages: loopStages.map((stage, position) => ({
        executionId: selected.id,
        position,
        name: stage.name,
        status: stage.state === "done" ? ("completed" as const) : stage.state,
        detail: stage.detail,
        metadata: {},
        updatedAt: selected.started,
      })),
    }),
    [selected, loopStages],
  );
  const live = useExecutionStream(selected.id, fallbackSnapshot);
  const liveSelected = live.snapshot.execution;
  const executionStages = live.snapshot.stages;
  const executionMetrics = summarizeExecutions(executions);
  const totalRuns = data.workflows.reduce((sum, workflow) => sum + workflow.runs, 0);

  // Gate: require sign-in before showing the dashboard.
  if (admin.loading) return <LoadingGate />;
  if (!admin.authenticated) return <SignInGate login={admin.login} error={admin.error} />;

  return (
    <div className="app-shell">
      <Sidebar />
      {editingWorkflow !== undefined && (
        <WorkflowForm
          workflow={editingWorkflow}
          pending={command.pending !== null}
          onClose={() => setEditingWorkflow(undefined)}
          onSubmit={command.run}
        />
      )}
      <main className="main">
        <header className="topbar">
          <div>
            <p className="eyebrow">CONTROL PLANE / OVERVIEW</p>
            <h1>Good morning, Panyakorn</h1>
            <p>Monitor your agent workflows and act on what needs attention.</p>
          </div>
          <div className="header-actions">
            <AdminAccess {...admin} />
            <button type="button" className="icon-button" aria-label="Search">
              <Search size={16} />
            </button>
            <button type="button" className="primary" onClick={() => router.push("/workflow/new")}>
              <Plus size={16} />
              New workflow
            </button>
          </div>
        </header>
        <section className="metrics">
          <Metric
            icon={<GitBranch />}
            title="Total workflows"
            value={String(data.workflows.length)}
            delta="Backend read model"
          />
          <Metric
            icon={<Activity />}
            title="Recorded runs"
            value={totalRuns.toLocaleString()}
            delta="Across listed workflows"
          />
          <Metric
            icon={<ShieldCheck />}
            title="Recent success rate"
            value={`${executionMetrics.successRate}%`}
            delta={`${executionMetrics.total} recent executions`}
          />
          <Metric
            icon={<CircleDollarSign />}
            title="Recent model spend"
            value={`$${executionMetrics.totalCost.toFixed(2)}`}
            delta="Recent execution sample"
          />
        </section>
        <section className="content-grid">
          <div className="stack">
            <div className="section-head">
              <div>
                <h2>Workflow operations</h2>
                <p>Live automation health across your workspace</p>
              </div>
              <button type="button" className="ghost" disabled>
                View all <ArrowUpRight size={14} />
              </button>
            </div>
            <div className="toolbar">
              <div className="search">
                <Search size={14} />
                <input
                  aria-label="Search workflows"
                  value={studio.query}
                  onChange={(e) => studio.setQuery(e.target.value)}
                  placeholder="Search workflows..."
                />
              </div>
              <div className="filters">
                {(["all", "active", "draft"] as const).map((s) => (
                  <button
                    type="button"
                    key={s}
                    className={studio.status === s ? "selected" : ""}
                    aria-pressed={studio.status === s}
                    onClick={() => studio.setStatus(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div className="workflow-list">
              {studio.filtered.map((w) => (
                <article className="workflow" key={w.id}>
                  <div className="workflow-icon">
                    <GitBranch size={17} />
                  </div>
                  <div className="workflow-main">
                    <div className="workflow-title">
                      <h3>{w.name}</h3>
                      <span className={`badge ${w.status}`}>{w.status}</span>
                    </div>
                    <p>{w.description}</p>
                    <div className="node-flow">
                      {w.nodes.map((n, i) => (
                        <span key={n}>
                          <b>{n}</b>
                          {i < w.nodes.length - 1 && <ChevronRight size={12} />}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="workflow-stats">
                    <strong>{w.success}%</strong>
                    <small>{w.runs.toLocaleString()} runs</small>
                    <time>{w.updated}</time>
                  </div>
                  {admin.authenticated && w.status === "active" && (
                    <button
                      type="button"
                      className="ghost run-workflow"
                      aria-label={`Run ${w.name}`}
                      disabled={command.pending !== null}
                      onClick={() => command.run({ action: "create-execution", workflowId: w.id })}
                    >
                      <Play size={14} />
                      {command.pending === `create-execution:${w.id}` ? "Running…" : "Run"}
                    </button>
                  )}
                  {admin.authenticated && (
                    <button
                      type="button"
                      className="more"
                      aria-label={`Edit ${w.name}`}
                      onClick={() => router.push(`/workflow/${w.id}`)}
                    >
                      <MoreHorizontal size={17} />
                    </button>
                  )}
                </article>
              ))}
            </div>
          </div>
          <aside className="run-panel">
            <div className="panel-head">
              <div>
                <span className={`live-dot ${liveSelected.status}`} />
                {liveSelected.status === "running"
                  ? "LIVE EXECUTION"
                  : `${statusLabel[liveSelected.status].toUpperCase()} EXECUTION`}
              </div>
              <button type="button" className="more" aria-label="Execution actions" disabled>
                <MoreHorizontal size={17} />
              </button>
            </div>
            <h2>{liveSelected.id}</h2>
            <p>{liveSelected.workflow}</p>
            <p role="status" aria-live="polite" className="stream-status">
              Live updates: {live.connection}
            </p>
            <div className="run-meta">
              <span>
                <Clock3 size={13} />
                {liveSelected.duration}
              </span>
              <span>
                <CircleDollarSign size={13} />${liveSelected.cost.toFixed(2)}
              </span>
            </div>
            <div className={`timeline ${liveSelected.status !== "running" ? "timeline-static" : ""}`}>
              {executionStages.map((stage, i) => (
                <div className={`stage ${stage.status === "completed" ? "done" : stage.status}`} key={stage.name}>
                  <div className="stage-rail">
                    <span>
                      {stage.status === "completed" ? (
                        <Check size={12} />
                      ) : stage.status === "running" ? (
                        <RotateCcw size={12} />
                      ) : (
                        i + 1
                      )}
                    </span>
                    {i < executionStages.length - 1 && <i />}
                  </div>
                  <div>
                    <strong>{stage.name}</strong>
                    <p>{stage.detail}</p>
                    {stage.status === "running" && (
                      <div className="progress">
                        <b />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {liveSelected.status === "waiting" && (
              <div className="approval">
                <div>
                  <ShieldCheck size={16} />
                  <strong>Approval gate</strong>
                </div>
                <p>Publishing remains blocked until a reviewer approves the generated assets.</p>
                <button type="button" disabled>
                  Open approval queue <ArrowUpRight size={13} />
                </button>
              </div>
            )}
            {admin.authenticated && (
              <div className="run-actions">
                <button
                  type="button"
                  disabled={command.pending !== null || liveSelected.status !== "running"}
                  onClick={() => command.run({ action: "pause", id: liveSelected.id })}
                >
                  <Pause size={14} />
                  Pause
                </button>
                <button
                  type="button"
                  disabled={command.pending !== null || !["failed", "paused"].includes(liveSelected.status)}
                  onClick={() => command.run({ action: "retry", id: liveSelected.id })}
                >
                  <RotateCcw size={14} />
                  Retry
                </button>
                <button
                  type="button"
                  disabled={command.pending !== null || liveSelected.status !== "waiting"}
                  onClick={() => command.run({ action: "approve", id: liveSelected.id })}
                >
                  <Check size={14} />
                  Approve
                </button>
                <button
                  type="button"
                  disabled={
                    command.pending !== null ||
                    !["running", "paused", "failed", "waiting", "approved"].includes(liveSelected.status)
                  }
                  onClick={() => command.run({ action: "cancel", id: liveSelected.id })}
                  className="danger"
                >
                  <X size={14} />
                  Cancel
                </button>
              </div>
            )}
            {command.message && (
              <p role="status" className="command-message">
                {command.message}
              </p>
            )}
          </aside>
        </section>
        <section className="executions">
          <div className="section-head">
            <div>
              <h2>Recent executions</h2>
              <p>Inspect status, latency, and spend per run</p>
            </div>
            <button type="button" className="ghost" disabled>
              All executions <ArrowUpRight size={14} />
            </button>
          </div>
          <div className="table">
            <div className="tr th">
              <span>Run</span>
              <span>Workflow</span>
              <span>Status</span>
              <span>Started</span>
              <span>Duration</span>
              <span>Cost</span>
            </div>
            {executions.map((run) => (
              <button
                type="button"
                className={`tr ${studio.selectedRun === run.id ? "selected-row" : ""}`}
                aria-pressed={studio.selectedRun === run.id}
                onClick={() => studio.setSelectedRun(run.id)}
                key={run.id}
              >
                <span className="mono">{run.id}</span>
                <span>{run.workflow}</span>
                <span>
                  <i className={`status ${run.status}`} />
                  {statusLabel[run.status]}
                </span>
                <span>{run.started}</span>
                <span className="mono">{run.duration}</span>
                <span className="mono">${run.cost.toFixed(2)}</span>
              </button>
            ))}
          </div>
        </section>
        <footer>
          <span>
            <Sparkles size={13} />
            {data.source === "backend" ? "Connected to portfolio backend" : "Demo fallback data"}
          </span>
          <span>{data.source === "backend" ? "Read model synchronized" : "Backend unavailable — fallback active"}</span>
          <span>
            <Command size={12} /> Command menu
          </span>
          <span>v{appVersion}</span>
        </footer>
      </main>
    </div>
  );
}
function Metric({ icon, title, value, delta }: { icon: React.ReactNode; title: string; value: string; delta: string }) {
  return (
    <article className="metric">
      <div className="metric-top">
        <span>{icon}</span>
        <small>30D</small>
      </div>
      <p>{title}</p>
      <strong>{value}</strong>
      <div>
        <ArrowUpRight size={12} />
        {delta}
      </div>
    </article>
  );
}
