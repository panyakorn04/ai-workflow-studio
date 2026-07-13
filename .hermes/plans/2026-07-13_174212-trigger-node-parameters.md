# Trigger Node Parameters & Rules Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** ทำให้ Trigger Node ตัวแรกของ Workflow เช่น Schedule, Webhook และ Manual สามารถเลือกแล้วตั้งค่า Parameters/Trigger Rules ผ่าน Inspector Panel ได้ บันทึกอย่างปลอดภัย และเตรียมพร้อมสำหรับ runtime scheduler จริง

**Architecture:** แยกข้อมูลออกเป็นสองชั้นเพื่อไม่ทำลาย API เดิม: `nodes: string[]` ยังคงเป็น public summary และใช้สร้าง execution stages ส่วน definition แบบมีชนิด/config/position จะเก็บในคอลัมน์ JSONB ใหม่ `definition` และเปิดเผยผ่าน Admin API เท่านั้น Frontend Canvas ใช้ `WorkflowDefinitionV1` เป็น state หลัก เปิด Right Inspector ตาม selected node และ derive `nodes: string[]` ตอน Save สำหรับ backward compatibility

**Tech Stack:** Next.js 16 + React 19 + TypeScript + `@xyflow/react` + Bun, Go backend, Supabase/Postgres JSONB, Go tests/Bun tests

---

## Product behavior ที่ต้องการ

### Trigger Node rules

- Workflow ต้องมี Trigger อย่างน้อย 1 ตัว และ Trigger หลักต้องอยู่ลำดับแรกทางซ้าย
- Trigger node ไม่มี target handle; มีเฉพาะ source handle
- Action/Logic/Output node มี target + source ตามเดิม
- คลิก Node แล้วเปิด Inspector Panel ด้านขวา
- Inspector แสดง form ตาม `node.type` ไม่ใช้การเดาจาก label
- Node ที่ยังตั้งค่าไม่ครบแสดง warning badge บน Canvas
- Save draft ได้แม้ config ยังไม่ครบ แต่เปลี่ยนเป็น `active` หรือกด Run ไม่ได้จน validation ผ่าน

### Schedule Parameters v1

```ts
type ScheduleTriggerConfig = {
  enabled: boolean;
  mode: "interval" | "daily" | "weekly" | "cron";
  timezone: string; // IANA เช่น Asia/Bangkok
  intervalMinutes?: number; // 1–43,200
  time?: string; // HH:mm สำหรับ daily/weekly
  daysOfWeek?: Array<0 | 1 | 2 | 3 | 4 | 5 | 6>;
  cronExpression?: string;
  misfirePolicy: "skip" | "run-once";
};
```

ค่าเริ่มต้น:

```ts
{
  enabled: true,
  mode: "daily",
  timezone: "Asia/Bangkok",
  time: "09:00",
  misfirePolicy: "skip"
}
```

Inspector แสดง:
- Enabled toggle
- Run mode
- Every N minutes สำหรับ interval
- Time สำหรับ daily
- Days + Time สำหรับ weekly
- Cron expression สำหรับ advanced mode
- Timezone selector
- Misfire policy
- Human-readable preview เช่น `Every day at 09:00 (Asia/Bangkok)`
- Next-run preview เมื่อ backend scheduler พร้อม

### Trigger types ถัดไป

- **Webhook:** HTTP method, path slug, authentication mode, response mode; secret/token ต้องสร้างและเก็บฝั่ง backend ห้ามอยู่ใน public JSON
- **Manual:** ไม่มี runtime parameters; แสดงข้อความ “Runs only when you click Run”

---

## Current-state findings

1. Frontend และ backend เก็บ `nodes` เป็น `string[]` เท่านั้น
   - Frontend: `src/lib/studio-api.ts:12`
   - Admin command: `src/lib/studio-admin.ts:6,11`
   - Backend model: `portfolio-backend-2026/internal/model/studio.go:22,54,67`
   - Backend validation: `portfolio-backend-2026/internal/handler/studio.go:47-53,107-134`
2. `WorkflowNode` เลือก icon/tone จาก keyword ใน label จึงยังไม่มี stable `type`
3. Public overview เปิดเผย workflow nodes; config ที่อาจมี secrets ต้องไม่ถูกเพิ่มใน public response
4. Database `StudioWorkflow.nodes` เป็น JSONB อยู่แล้ว แต่ RPC `createStudioExecutionWithStages` ใช้ `jsonb_array_elements_text` และคาดว่าเป็น string array
5. ระบบ execution ปัจจุบันสร้าง run/stages ได้ แต่ยังไม่มี worker ที่ execute nodes จริง ดังนั้น Schedule runtime ต้องเป็น phase แยกจาก UI/persistence

---

## Data contract

### Frontend shared definition

สร้าง `src/lib/workflow-definition.ts`:

```ts
export type WorkflowNodeKind = "trigger" | "action" | "logic" | "output";
export type WorkflowNodeType =
  | "schedule"
  | "webhook"
  | "manual"
  | "search"
  | "analyze"
  | "generate"
  | "extract"
  | "transform"
  | "review"
  | "approve"
  | "condition"
  | "route"
  | "publish"
  | "notify"
  | "sync"
  | "export";

export type WorkflowNodeDefinition = {
  id: string;
  type: WorkflowNodeType;
  kind: WorkflowNodeKind;
  label: string;
  position: { x: number; y: number };
  config: Record<string, unknown>;
};

export type WorkflowEdgeDefinition = {
  id: string;
  source: string;
  target: string;
};

export type WorkflowDefinitionV1 = {
  version: 1;
  nodes: WorkflowNodeDefinition[];
  edges: WorkflowEdgeDefinition[];
};
```

### Backward-compatible API payload

```json
{
  "name": "Daily content pipeline",
  "status": "draft",
  "nodes": ["Schedule", "Search", "Publish"],
  "definition": {
    "version": 1,
    "nodes": [
      {
        "id": "node-0",
        "type": "schedule",
        "kind": "trigger",
        "label": "Schedule",
        "position": { "x": 0, "y": 0 },
        "config": {
          "enabled": true,
          "mode": "daily",
          "timezone": "Asia/Bangkok",
          "time": "09:00",
          "misfirePolicy": "skip"
        }
      }
    ],
    "edges": []
  }
}
```

กฎ backend:
- ยอมรับ `nodes` แบบเดิมเพื่อ backward compatibility
- ถ้ามี `definition` ให้ validate แล้ว derive `nodes` จาก definition ฝั่ง server
- Reject หาก client ส่ง `nodes` ที่ไม่ตรงกับ labels/order ใน definition
- Public overview ส่งเฉพาะ `nodes`; Admin detail/list จึงค่อยส่ง `definition`
- ห้ามใส่ API key, webhook secret หรือ credential plaintext ใน `config`; เก็บได้เฉพาะ credential reference ID

---

## Phase 1: Definition schema และ migration compatibility

### Task 1.1 — Frontend contract tests (RED → GREEN)

**Files:**
- Create: `src/lib/workflow-definition.ts`
- Create: `src/lib/workflow-definition.test.ts`
- Modify: `src/lib/studio-api.ts`
- Modify: `src/lib/studio-api.test.ts`

**Tests:**
- parse `WorkflowDefinitionV1` ที่ถูกต้อง
- reject unknown node type/kind
- reject duplicate node IDs
- reject edge ที่ source/target ไม่มีจริง
- reject config ที่ไม่ใช่ object
- migrate legacy `string[]` เป็น definition v1 ด้วย stable type mapping
- derive labels จาก definition ตาม horizontal order
- public overview ยังคง parse response ที่ไม่มี definition ได้

**Commands:**

```bash
bun test src/lib/workflow-definition.test.ts src/lib/studio-api.test.ts
```

Expected RED ก่อน implementation และ GREEN หลัง implementation

### Task 1.2 — Supabase additive migration

**Backend files:**
- Create: `/Users/panyakornboonyong/portfolio-backend-2026/migrations/0008_studio_workflow_definition.sql`

Migration:

```sql
ALTER TABLE "StudioWorkflow"
ADD COLUMN IF NOT EXISTS "definition" JSONB;

ALTER TABLE "StudioWorkflow"
ADD CONSTRAINT "StudioWorkflow_definition_shape_check"
CHECK (
  "definition" IS NULL OR (
    jsonb_typeof("definition") = 'object'
    AND ("definition"->>'version')::int = 1
    AND jsonb_typeof("definition"->'nodes') = 'array'
    AND jsonb_typeof("definition"->'edges') = 'array'
  )
);
```

Backfill legacy workflows:
- แปลง `nodes` string array เป็น object nodes
- type mapping จาก label แบบ deterministic
- positions `x = ordinality * 200`, `y = 0`
- config default `{}` ยกเว้น Schedule ใช้ default schedule config
- สร้าง linear edges
- เก็บ `nodes` string array เดิมไว้ ไม่เปลี่ยน RPC เดิม

**Verification:**
- migration idempotent
- existing workflows ยังอ่านได้
- existing `createStudioExecutionWithStages(nodes string[])` ยังทำงาน

---

## Phase 2: Backend Admin API และ validation

### Task 2.1 — Go model รองรับ definition

**Files:**
- Modify: `/Users/panyakornboonyong/portfolio-backend-2026/internal/model/studio.go`
- Modify: `/Users/panyakornboonyong/portfolio-backend-2026/internal/model/studio_test.go`

เพิ่ม Go structs:

```go
type StudioWorkflowDefinition struct {
    Version int                      `json:"version"`
    Nodes   []StudioWorkflowNode     `json:"nodes"`
    Edges   []StudioWorkflowEdge     `json:"edges"`
}

type StudioWorkflowNode struct {
    ID       string         `json:"id"`
    Type     string         `json:"type"`
    Kind     string         `json:"kind"`
    Label    string         `json:"label"`
    Position StudioPosition `json:"position"`
    Config   map[string]any `json:"config"`
}
```

เพิ่ม `Definition *StudioWorkflowDefinition` ใน model/input/row และ `workflowBody()`

### Task 2.2 — Validate definition และ Schedule config

**Files:**
- Modify: `/Users/panyakornboonyong/portfolio-backend-2026/internal/handler/studio.go`
- Modify: `/Users/panyakornboonyong/portfolio-backend-2026/internal/handler/studio_test.go`
- Modify: `/Users/panyakornboonyong/portfolio-backend-2026/internal/handler/studio_security_test.go`

Validation rules:
- 1–30 nodes
- unique node IDs, max 128 chars
- allowlisted type/kind combinations
- first node ต้อง `kind=trigger`
- trigger อย่างน้อย 1; MVP จำกัด trigger หลัก 1 ตัว
- edges อ้างถึง node ที่มีจริง, no self-loop, no duplicate edge
- label 1–80 chars
- position finite และ bounded
- config จำกัด serialized size เช่น 16 KB ต่อ node / 128 KB ต่อ workflow
- Schedule:
  - IANA timezone ต้องโหลดได้ด้วย `time.LoadLocation`
  - interval 1–43,200 นาที
  - time ต้อง `HH:mm`
  - weekly ต้องมี days อย่างน้อย 1 วัน
  - cron expression ต้อง parse ด้วย allowlisted parser และกำหนดจำนวน fields ชัดเจน
  - misfire policy เฉพาะ `skip|run-once`
- reject credential-looking keys เช่น `apiKey`, `token`, `secret`, `password` ใน config
- derive labels/order ฝั่ง backend และตรวจ `nodes` compatibility
- active workflow ต้อง config ครบ; draft อนุญาต incomplete พร้อม validation metadata ฝั่ง UI

### Task 2.3 — Admin-only workflow detail endpoint

**Files:**
- Modify: `/Users/panyakornboonyong/portfolio-backend-2026/internal/handler/routes.go`
- Modify: `/Users/panyakornboonyong/portfolio-backend-2026/internal/handler/studio.go`
- Modify: `/Users/panyakornboonyong/portfolio-backend-2026/internal/handler/studio_test.go`

เพิ่ม:

```text
GET /api/admin/studio/workflows/:id
```

Behavior:
- require admin session/bearer ตามระบบเดิม
- viewer อ่านได้, editor/admin แก้ได้
- response มี `definition`
- public `/api/studio/overview` ห้ามมี `definition`
- test ยืนยัน public response ไม่ leak schedule/webhook config

### Task 2.4 — Frontend BFF proxy แบบ session-only

**Files:**
- Create: `src/app/api/studio/workflows/[id]/route.ts`
- Create: `src/lib/studio-workflow-detail.ts`
- Create tests ตาม pattern ของ `studio-session.test.ts`

Behavior:
- forward เฉพาะ `portfolio_admin_session` cookie
- ไม่ใช้ static admin bearer token
- fail closed เมื่อไม่มี session
- GET admin detail สำหรับ editor page
- mutation ยังผ่าน `/api/studio/admin` แต่ payload รองรับ `definition`

---

## Phase 3: Canvas state migration

### Task 3.1 — ใช้ definition เป็น state หลัก

**Files:**
- Modify: `src/app/workflow/[id]/editor-shell.tsx`
- Modify: `src/app/workflow/[id]/editor-canvas.tsx`
- Modify: `src/app/_components/workflow-canvas.tsx`
- Modify: `src/lib/workflow-canvas-utils.ts`
- Modify tests: `src/lib/workflow-canvas-utils.test.ts`

เปลี่ยนจาก:

```ts
initial: string[];
onChange: (nodes: string[]) => void;
```

เป็น:

```ts
initial: WorkflowDefinitionV1;
onChange: (definition: WorkflowDefinitionV1) => void;
```

กฎ:
- React Flow node data มี `type`, `kind`, `label`, `config`
- position changes update definition
- add/delete/rename update definition และ edges
- Save derive `nodes` summary จาก definition
- legacy workflow ที่ definition เป็น null ใช้ migration helper ใน frontend
- ห้าม sync parent state จาก render-phase updater; รักษา `nodesRef + replaceNodes` pattern ที่แก้แล้ว

### Task 3.2 — Stable palette registry

**Files:**
- Create: `src/lib/workflow-node-registry.ts`
- Modify: `src/app/workflow/[id]/editor-shell.tsx`
- Modify: `src/app/_components/node-palette.tsx`
- Modify: `src/app/_components/workflow-node.tsx`

Registry example:

```ts
{
  type: "schedule",
  kind: "trigger",
  label: "Schedule",
  defaultConfig: { ... },
  icon: Clock3,
  tone: "trigger"
}
```

ผลลัพธ์:
- เลิก infer type จาก label keyword
- Rename label ไม่เปลี่ยน icon หรือ behavior
- Trigger nodes แสดง source handle เท่านั้น
- Add action ใช้ registry เพื่อสร้าง default config

---

## Phase 4: Node Inspector UI

### Task 4.1 — Selection state และ Right Inspector shell

**Files:**
- Modify: `src/app/workflow/[id]/editor-canvas.tsx`
- Modify: `src/app/workflow/[id]/editor-shell.tsx`
- Create: `src/app/workflow/[id]/node-inspector.tsx`
- Create: `src/app/workflow/[id]/schedule-trigger-form.tsx`
- Modify: `src/app/workflow/editor.css`

Layout:

```text
[Node Palette 220px] [Canvas flex] [Inspector 320–360px]
```

Behavior:
- Node click/select → inspector เปิด
- click canvas → inspector ปิด
- inspector header: icon, type, node label, validation status
- mobile/tablet: inspector เป็น right drawer พร้อม focus trap และ close button
- preserve canvas viewport เมื่อเปิด/ปิด inspector

### Task 4.2 — Schedule form

**Files:**
- Create: `src/app/workflow/[id]/schedule-trigger-form.tsx`
- Create: `src/lib/schedule-trigger.ts`
- Create: `src/lib/schedule-trigger.test.ts`

Pure helpers:
- `parseScheduleConfig`
- `validateScheduleConfig`
- `describeSchedule`
- `defaultScheduleConfig`

TDD cases:
- daily 09:00 Asia/Bangkok valid
- invalid timezone rejected
- interval 0 rejected, 1 and 43,200 valid
- weekly without day rejected
- invalid HH:mm rejected
- cron malformed rejected
- mode-specific stale fields stripped before Save

UI:
- controlled fields
- inline errors
- human-readable preview
- “Reset to defaults”
- no Save side effects during render

### Task 4.3 — Workflow-level validation UX

**Files:**
- Create: `src/lib/workflow-validation.ts`
- Create: `src/lib/workflow-validation.test.ts`
- Modify: `src/app/workflow/[id]/editor-shell.tsx`
- Modify: `src/app/_components/workflow-node.tsx`

Behavior:
- Draft: Save ได้พร้อม warning
- Active: Save/Run disabled เมื่อ invalid
- Node badge แสดง error count
- Topbar แสดง `3 issues` และคลิกแล้ว select node แรกที่ผิด
- Error message ระบุ field/action ชัดเจน

---

## Phase 5: Save/load integration

### Task 5.1 — Admin command payload

**Frontend files:**
- Modify: `src/lib/studio-admin.ts`
- Modify: `src/lib/studio-admin.test.ts`
- Modify: `src/lib/studio-api.ts`
- Modify: `src/app/workflow/[id]/editor-shell.tsx`
- Modify: `src/app/_components/workflow-form.tsx`

Payload ต้องส่ง:
- workflow metadata
- `nodes` derived string summary
- `definition` validated V1

Tests:
- allowed config forwarded
- definition omitted/legacy fallback supported
- unknown config/type rejectedก่อน fetch
- public overview parser ไม่รับ/ไม่ expose definition

### Task 5.2 — Browser persistence smoke test

Test flow:
1. เปิด workflow ที่มี Schedule
2. select Schedule
3. ตั้ง daily 09:00, Asia/Bangkok, skip
4. intercept PATCH และตรวจ payload
5. reload ด้วย mocked GET admin detail
6. inspector ต้องแสดงค่าเดิม
7. เปลี่ยน workflow เป็น active และตรวจ validation
8. screenshot desktop/mobile
9. assert browser console warnings/errors = `[]`

**Commands:**

```bash
bun run test
bun run lint
bun run build
```

Backend:

```bash
go test ./...
go vet ./...
```

---

## Phase 6: Runtime Scheduler (แยก deploy หลัง UI/persistence เสถียร)

> Phase นี้ทำให้ Schedule “ยิงจริง” ไม่ใช่แค่บันทึก parameters

### Task 6.1 — Trigger schedule projection

**Backend files:**
- Create migration: `/Users/panyakornboonyong/portfolio-backend-2026/migrations/0009_studio_trigger_schedule.sql`
- Add model files under `/Users/panyakornboonyong/portfolio-backend-2026/internal/model/`

Table proposal:

```sql
CREATE TABLE "StudioTriggerSchedule" (
  "workflowId" TEXT PRIMARY KEY REFERENCES "StudioWorkflow"("id") ON DELETE CASCADE,
  "nodeId" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL,
  "cronExpression" TEXT NOT NULL,
  "timezone" TEXT NOT NULL,
  "misfirePolicy" TEXT NOT NULL,
  "nextRunAt" TIMESTAMPTZ,
  "lastRunAt" TIMESTAMPTZ,
  "leaseUntil" TIMESTAMPTZ,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

เมื่อ Save active workflow:
- normalize interval/daily/weekly เป็น cron canonical form
- upsert schedule projection transactionally
- paused/draft/disabled → `nextRunAt = null`

### Task 6.2 — Concurrency-safe scheduler claim

เพิ่ม Postgres RPC `claimDueStudioTriggers(now, leaseDuration, limit)`:
- `FOR UPDATE SKIP LOCKED`
- lease ป้องกันหลาย backend instance ยิงซ้ำ
- idempotency key เช่น `workflowId:nodeId:scheduledAt`
- unique constraint ที่ execution trigger occurrence
- calculate next run ตาม IANA timezone และ DST policy
- misfire `skip` กับ `run-once` มี test ชัดเจน

### Task 6.3 — Create execution from trigger

Scheduler loop:
- claim due triggers
- เรียก transactional RPC เพื่อสร้าง execution + stages
- audit `execution.triggered`
- update last/next run
- metrics/logging โดยไม่ log secrets/config ทั้งก้อน

ข้อจำกัดปัจจุบัน:
- การสร้าง execution จะทำให้ timeline เริ่ม `running`
- แต่ยังไม่มี worker ประมวลผล Search/Analyze/Publish จริง
- Node executor ต้องเป็น project phase ถัดไป ไม่ควรแอบรวมใน Schedule UI phase

### Task 6.4 — Scheduler verification

- fake clock tests
- timezone/DST tests
- duplicate claim test สอง workers
- restart/misfire test
- paused workflow ไม่ยิง
- config update invalidates old revision
- production dry-run mode log due triggers แต่ไม่ create execution
- deploy แล้ว probe execution/audit rows จริง

---

## Recommended delivery order

### Milestone A — Configurable UI (แนะนำเริ่มก่อน)
- Phase 1–5
- ผู้ใช้ตั้ง Schedule parameters ได้
- Save/load ได้จริง
- Validation และ Inspector พร้อม
- ยังไม่ยิงตามเวลา

### Milestone B — Actual scheduling
- Phase 6
- backend สร้าง execution ตาม schedule จริง
- concurrency/idempotency/misfire พร้อม production safety

### Milestone C — Workflow executor
- worker ประมวลผล Action/Logic/Output ตาม definition
- update persisted execution stages ผ่าน SSE
- credential vault/references
- retry/timeout/cost policies ต่อ node

---

## Security requirements

- Definition/config อ่านได้เฉพาะ Admin API
- Public overview ส่ง labels เท่านั้น
- ห้ามเก็บ plaintext API key/token/password/webhook secret ใน JSONB definition
- ใช้ credential reference ID และ resolve server-side เท่านั้น
- จำกัด type/config fields ด้วย allowlist; ห้าม arbitrary provider/model/options
- จำกัด JSON size และ string lengths
- audit create/update schedule โดยเก็บ metadata ที่ redacted
- scheduler ใช้ DB lease + idempotency ไม่พึ่ง in-memory lock

---

## Verification gate ต่อ milestone

Frontend:

```bash
bun run test
bun run lint
bun run build
```

Backend:

```bash
go test ./...
go vet ./...
```

Database:
- apply migration ใน Supabase SQL Editor ตาม workflow ปัจจุบัน
- read-back schema/constraints
- create/update legacy + V1 workflow
- verify public endpoint ไม่ leak definition
- verify admin endpoint read-back config ตรง

Browser:
- desktop + mobile inspector
- keyboard selection/form/delete
- Save → reload persistence
- invalid active workflow blocked
- console warnings/errors = `[]`

Git/deploy:
- backend migration/API ก่อน
- deploy backend และ probe
- deploy frontend หลัง contract พร้อม
- production smoke test ด้วย admin session
- commit/push แยก repo และตรวจ CI ทั้งสอง

---

## Risks / tradeoffs

1. **เปลี่ยน `nodes` เดิมเป็น object array โดยตรงมี blast radius สูง** เพราะ RPC และ Go model คาด string array จึงเลือก additive `definition` column
2. **Config UI ไม่เท่ากับ runtime execution** ต้องสื่อใน UI ว่า scheduler ยังไม่ enabled จน Milestone B deploy
3. **Timezone/DST** เป็นความเสี่ยงหลักของ scheduler; ต้องใช้ IANA timezone และ fake-clock tests
4. **Empty workflow:** backend ปัจจุบันบังคับ 1–30 nodes; Draft UI อาจว่างชั่วคราวได้ แต่ Save ต้องแจ้ง validation ไม่ยิง payload invalid
5. **Multiple triggers:** MVP จำกัด 1 primary trigger ก่อน เพื่อลด ambiguity; multi-trigger ทำเป็น version 2
6. **Position persistence:** definition ต้องเก็บ positions ไม่เช่นนั้น reload แล้ว layout reset
7. **Secrets:** Webhook/API nodes ห้ามใช้ generic config เป็นที่เก็บ secret

---

## Open decisions before implementation

1. Milestone แรกต้องการเพียงตั้งค่าและ Save/Load หรือให้ Schedule ยิง execution จริงทันที?
2. MVP อนุญาต Trigger มากกว่า 1 ตัวต่อ Workflow หรือจำกัด 1 ตัว?
3. Cron advanced ใช้ 5 fields หรือ 6 fields (มี seconds)? แนะนำ 5 fields
4. เมื่อเครื่องหยุดแล้วกลับมาออนไลน์ ใช้ default misfire เป็น `skip` หรือ `run-once`? แนะนำ `skip`
5. Workflow draft ที่ไม่มี Node อนุญาต Save หรือไม่? Backend ปัจจุบันไม่อนุญาต; แนะนำให้ UI แสดง error และยังไม่ส่ง request
