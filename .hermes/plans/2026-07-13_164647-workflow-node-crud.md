# Workflow Node CRUD Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** ทำให้หน้า Full-page Workflow Editor สามารถเพิ่ม แก้ชื่อ ย้าย และลบ Node ได้จริง พร้อมบันทึกค่าเดียวกับที่ผู้ใช้เห็นบน Canvas

**Architecture:** ให้ `WorkflowEditorCanvas` เป็นเจ้าของ React Flow nodes/edges ต่อไป เพื่อไม่ต้องย้าย state ครั้งใหญ่ แต่ expose คำสั่ง `addNode(label)` ผ่าน typed ref ให้ Sidebar เรียกโดยตรง ทุก mutation จะเรียก callback `onChange` เพื่อ sync รายชื่อ Node กลับไปยัง `WorkflowEditorShell` ซึ่งเป็น payload สำหรับ Save พร้อมย้าย logic สร้าง Node และเส้นเชื่อมไปไว้ใน pure utilities เพื่อลดโค้ดซ้ำและเขียน regression tests ได้

**Tech Stack:** Next.js 16, React 19, TypeScript, `@xyflow/react`, Bun test, Biome

---

## Acceptance criteria

1. คลิก Node ใน Sidebar แล้ว Node ใหม่ปรากฏทางขวาของ Node สุดท้ายทันที
2. Node ใหม่มี ID ไม่ซ้ำ มีเส้นเชื่อมกับ Node ก่อนหน้า และใช้ design border/icon ปัจจุบัน
3. แก้ชื่อ Node แล้วกด Save จะส่งชื่อใหม่ ไม่ใช่ชื่อเดิม
4. ลบ Node ด้วยปุ่ม `×` หรือ `Delete`/`Backspace` แล้วกด Save จะไม่ส่ง Node ที่ลบแล้ว
5. สามารถลบ Node ตัวสุดท้ายได้ และเพิ่ม Node กลับจาก Sidebar ได้
6. การลาก Node ยังรักษาตำแหน่งและลำดับที่ใช้สร้าง payload
7. Modal canvas เดิมยังเพิ่ม/แก้ไข/ลบได้ ไม่ regression
8. Keyboard focus ใช้กับช่องชื่อและปุ่มลบได้ โดยไม่ลาก Node โดยไม่ตั้งใจ
9. Tests, Biome lint และ production build ผ่าน

---

### Task 1: สร้าง pure utilities สำหรับเพิ่ม Node และสร้าง linear edges

**Objective:** รวม logic ที่ซ้ำกันระหว่าง Modal Canvas และ Full-page Editor Canvas และทำให้การเพิ่ม Node ทดสอบได้โดยไม่ต้อง render React Flow

**Files:**
- Modify: `src/lib/workflow-canvas-utils.test.ts`
- Modify: `src/lib/workflow-canvas-utils.ts`

**Step 1: เขียน failing tests**

เพิ่ม test cases:

```ts
import {
  appendFlowNode,
  buildLinearEdges,
  // existing imports...
} from "./workflow-canvas-utils";

test("appends a node after the right-most node with a unique id", () => {
  const existing = nodesToFlow(["Trigger", "Process"]).nodes;
  const updated = appendFlowNode(existing, "Publish");

  expect(updated).toHaveLength(3);
  expect(updated[2].id).toBe("node-2");
  expect(updated[2].position).toEqual({ x: 400, y: 0 });
  expect(updated[2].data.label).toBe("Publish");
});

test("builds edges using horizontal node order", () => {
  const nodes = [
    { id: "node-b", position: { x: 200, y: 0 }, data: {} },
    { id: "node-a", position: { x: 0, y: 0 }, data: {} },
  ] as Node[];

  expect(buildLinearEdges(nodes)).toEqual([
    expect.objectContaining({ source: "node-a", target: "node-b", type: "smoothstep" }),
  ]);
});

test("returns no edges for zero or one node", () => {
  expect(buildLinearEdges([])).toEqual([]);
  expect(buildLinearEdges(nodesToFlow(["Only"]).nodes)).toEqual([]);
});
```

**Step 2: รัน test เพื่อยืนยัน RED**

```bash
bun test src/lib/workflow-canvas-utils.test.ts
```

Expected: FAIL เพราะ `appendFlowNode` และ `buildLinearEdges` ยังไม่มี

**Step 3: เพิ่ม implementation ขั้นต่ำ**

ใน `src/lib/workflow-canvas-utils.ts`:

```ts
export function appendFlowNode(existing: Node[], label: string): Node[] {
  return [
    ...existing,
    {
      id: nextNodeId(existing),
      type: "workflow",
      position: positionForNewNode(existing),
      data: { label },
    },
  ];
}

export function buildLinearEdges(nodes: Node[]): Edge[] {
  const sorted = [...nodes].sort((a, b) => a.position.x - b.position.x);
  return sorted.slice(0, -1).map((node, index) => ({
    id: `edge-${node.id}-${sorted[index + 1].id}`,
    source: node.id,
    target: sorted[index + 1].id,
    type: "smoothstep",
    animated: false,
  }));
}
```

Refactor `nodesToFlow()` ให้เรียก `buildLinearEdges(nodes)` แทน loop เดิม โดยผลลัพธ์เดิมต้องไม่เปลี่ยน

**Step 4: รัน test เพื่อยืนยัน GREEN**

```bash
bun test src/lib/workflow-canvas-utils.test.ts
```

Expected: utility tests ผ่านทั้งหมด

**Step 5: Commit**

```bash
git add src/lib/workflow-canvas-utils.ts src/lib/workflow-canvas-utils.test.ts
git commit -m "test: cover workflow canvas node insertion"
```

---

### Task 2: เชื่อม Sidebar Add action เข้ากับ Full-page Canvas

**Objective:** ให้การคลิก Sidebar เพิ่ม Node ใน state ภายใน `WorkflowEditorCanvas` โดยไม่ reset ตำแหน่ง Node เดิม

**Files:**
- Modify: `src/app/workflow/[id]/editor-canvas.tsx`
- Modify: `src/app/workflow/[id]/editor-shell.tsx`

**Step 1: นิยาม typed imperative handle**

ใน `editor-canvas.tsx` export type:

```ts
export type WorkflowEditorCanvasHandle = {
  addNode: (label: string) => void;
};
```

เปลี่ยน component เป็น `forwardRef<WorkflowEditorCanvasHandle, Props>` และเพิ่ม `useImperativeHandle`

**Step 2: Implement `addNode` โดยใช้ utility**

```ts
const addNode = useCallback(
  (label: string) => {
    setNodes((current) => {
      const updated = appendFlowNode(current, label);
      setEdges(buildLinearEdges(updated));
      notify(updated);
      return updated;
    });
  },
  [notify],
);

useImperativeHandle(ref, () => ({ addNode }), [addNode]);
```

ข้อสำคัญ:
- ห้ามสร้าง state ใหม่จาก `initial` ทุกครั้ง เพราะจะ reset ตำแหน่งที่ผู้ใช้ลากไว้
- ห้ามให้ Sidebar เรียก `setNodes((nodes) => [...nodes, label])` ใน shell โดยตรงอีก
- `notify(updated)` ต้องทำให้ payload สำหรับ Save อัปเดตทันที

**Step 3: เชื่อม ref ใน Editor Shell**

ใน `editor-shell.tsx`:

```ts
const canvasRef = useRef<WorkflowEditorCanvasHandle>(null);

const addNode = useCallback((label: string) => {
  canvasRef.current?.addNode(label);
}, []);
```

เปลี่ยนทุก Sidebar button จาก:

```tsx
onClick={() => setNodes((nodes) => [...nodes, name])}
```

เป็น:

```tsx
onClick={() => addNode(name)}
```

และส่ง ref:

```tsx
<WorkflowEditorCanvas ref={canvasRef} initial={nodes} onChange={setNodes} />
```

**Step 4: Refactor JSX ซ้ำแบบจำกัดขอบเขต**

รวมรายการ Sidebar เป็น typed constant แต่ไม่สร้างระบบ registry ขนาดใหญ่:

```ts
const nodeGroups = [
  { label: "Triggers", tone: "trigger", nodes: ["Webhook", "Schedule", "Manual"] },
  { label: "Actions", tone: "action", nodes: ["Search", "Analyze", "Generate", "Extract", "Transform"] },
  { label: "Logic", tone: "logic", nodes: ["Review", "Approve", "Condition", "Route"] },
  { label: "Output", tone: "output", nodes: ["Publish", "Notify", "Sync", "Export"] },
] as const;
```

Render ด้วย `.map()` เพื่อลด handler ที่ copy-paste

**Step 5: รัน static checks**

```bash
bun run lint
bun run build
```

Expected: ไม่มี hook dependency, ref typing หรือ React 19 errors

**Step 6: Commit**

```bash
git add 'src/app/workflow/[id]/editor-canvas.tsx' 'src/app/workflow/[id]/editor-shell.tsx'
git commit -m "feat: add workflow nodes from editor sidebar"
```

---

### Task 3: ทำ Edit/Delete behavior ให้สอดคล้องกันทุก Canvas

**Objective:** ให้ทุก mutation sync state และรองรับ mouse/keyboard โดยไม่มีกรณี Canvas กับ Save payload ไม่ตรงกัน

**Files:**
- Modify: `src/app/_components/workflow-canvas.tsx`
- Modify: `src/app/workflow/[id]/editor-canvas.tsx`
- Modify: `src/app/_components/workflow-node.tsx`
- Modify: `src/app/workflow-canvas.css`
- Test: `src/lib/workflow-canvas-utils.test.ts`

**Step 1: เพิ่ม regression test สำหรับ empty workflow serialization**

```ts
test("serializes an empty canvas after the final node is deleted", () => {
  expect(flowToNodes([])).toEqual([]);
});
```

รัน:

```bash
bun test src/lib/workflow-canvas-utils.test.ts
```

Expected: PASS เป็น characterization test ก่อนเปลี่ยน delete guards

**Step 2: อนุญาตให้ลบ Node สุดท้าย**

ใน `handleDelete` ของ Canvas ทั้งสอง เอา guard นี้ออก:

```ts
if (filtered.length === 0) return current;
```

แล้วทำต่อทุกครั้ง:

```ts
setEdges(buildLinearEdges(filtered));
notify(filtered);
return filtered;
```

ทำให้ปุ่ม `×` และ keyboard deletion มี semantics เดียวกัน

**Step 3: ใช้ helper เดียวกันสำหรับ edge rebuild**

แทน `rebuildEdges` ที่เขียนซ้ำด้วย:

```ts
const rebuildEdges = useCallback((updatedNodes: Node[]) => {
  setEdges(buildLinearEdges(updatedNodes));
}, []);
```

**Step 4: ป้องกัน input/button จากการ trigger node drag**

ใน `workflow-node.tsx`:

```tsx
<input className="node-label-input nodrag" ... />
<button className="node-delete-btn nodrag" ... />
```

คง `aria-label` และ keyboard focus ของปุ่มลบไว้

**Step 5: เพิ่ม focus-visible style**

ใน `workflow-canvas.css`:

```css
.node-delete-btn:focus-visible,
.node-label-input:focus-visible {
  outline: 2px solid var(--node-tone);
  outline-offset: 2px;
}
```

ตรวจว่า `.workflow-canvas-node:focus-within .node-delete-btn` ยังคงทำให้ปุ่มลบปรากฏเมื่อใช้ keyboard

**Step 6: รัน tests และ lint**

```bash
bun test src/lib/workflow-canvas-utils.test.ts
bun run lint
```

Expected: ผ่านทั้งหมด

**Step 7: Commit**

```bash
git add src/app/_components/workflow-canvas.tsx src/app/_components/workflow-node.tsx src/app/workflow-canvas.css 'src/app/workflow/[id]/editor-canvas.tsx' src/lib/workflow-canvas-utils.test.ts
git commit -m "fix: align workflow node edit and delete behavior"
```

---

### Task 4: Browser smoke test CRUD และ Save payload

**Objective:** พิสูจน์ behavior ที่ผู้ใช้เห็นจริงบน `/workflow/new` ไม่ใช่แค่ utility tests

**Files:**
- No committed file required
- Temporary test artifact: `/tmp/ai-workflow-node-crud.spec.ts`
- Screenshot: `/tmp/ai-workflow-node-crud.png`

**Step 1: เปิด dev server**

```bash
bun run dev --hostname 127.0.0.1 --port 3107
```

รันเป็น tracked background process และรอ `Ready`

**Step 2: สร้าง Playwright smoke test ชั่วคราว**

Test flow:
1. เปิด `http://127.0.0.1:3107/workflow/new`
2. ยืนยันมี Node `Trigger` และ `Process`
3. คลิก Sidebar `Publish`
4. ยืนยันมี Node `Publish` บน Canvas และมี edge เพิ่มหนึ่งเส้น
5. แก้ชื่อ `Publish` เป็น `Publish episode`
6. เลือก `Process` แล้วกด `Delete`
7. ยืนยัน `Process` หายไป
8. ดัก `POST /api/studio/admin` ตอนกด Save แล้วตรวจ `payload.nodes` เท่ากับค่าบน Canvas
9. Capture screenshot

ใช้ route interception ตอบ save request ด้วย mock success เพื่อไม่เขียน backend production:

```ts
await page.route("**/api/studio/admin", async (route) => {
  savedBody = route.request().postDataJSON();
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ ok: true, data: { id: "smoke-workflow" } }),
  });
});
```

**Step 3: รัน browser test**

```bash
bunx playwright@1.55.0 test /tmp/ai-workflow-node-crud.spec.ts --reporter=line
```

Expected: CRUD flow ผ่าน และ intercepted Save payload มี Node ล่าสุดเท่านั้น

**Step 4: ตรวจภาพด้วยตา**

ตรวจ `/tmp/ai-workflow-node-crud.png`:
- border/icon/handle ไม่เปลี่ยนจาก design ล่าสุด
- Node ใหม่ไม่ซ้อน Node เดิม
- เส้นเชื่อมต่อจาก handle ถูกต้อง
- ปุ่มลบไม่บัง label/icon

**Step 5: ปิด dev server**

ส่ง SIGTERM ผ่าน tracked process manager; exit 143 จาก deliberate cleanup ถือว่าปกติ

---

### Task 5: Final verification, review, commit/push

**Objective:** ตรวจทั้ง repository และส่งขึ้น `main` โดยไม่มี regression

**Files:**
- Review all modified files from `git status --short --untracked-files=all`

**Step 1: Full canonical verification**

```bash
bun run test
bun run lint
bun run build
git diff --check
```

Expected:
- Tests ผ่านทั้งหมด
- Biome ไม่มี fixes
- Next.js compile + TypeScript + page generation ผ่าน
- ไม่มี whitespace errors

**Step 2: Independent review**

ให้ reviewer ตรวจเฉพาะ diff โดยเน้น:
- state synchronization ระหว่าง Canvas กับ Save payload
- stale closure ใน `useImperativeHandle`/`useCallback`
- unique IDs และ edge rebuild หลัง add/delete/drag
- keyboard accessibility
- Modal Canvas regression

แก้เฉพาะ High/Medium findings แล้วรัน verification ซ้ำ

**Step 3: ตรวจ Git status และ secrets**

```bash
git status --short --untracked-files=all
git diff --cached --check
```

Expected: stage เฉพาะ source/tests ที่เกี่ยวข้อง ไม่มี `/tmp`, screenshots หรือ credentials

**Step 4: Final commit หากยังมี uncommitted review fixes**

```bash
git add src/app src/lib
git commit -m "fix: complete workflow node CRUD interactions"
```

หมายเหตุ: repository hook จะ bump `package.json` version อัตโนมัติ ให้รวม version bump ที่ hook สร้างอย่างตั้งใจ

**Step 5: Push และ verify remote**

```bash
git push origin main
git status --short --branch
git rev-parse HEAD
git ls-remote origin refs/heads/main
```

Expected: local HEAD ตรงกับ `origin/main` และ working tree สะอาด

---

## Files likely to change

- `src/app/workflow/[id]/editor-canvas.tsx` — expose/add Node command และ mutation synchronization
- `src/app/workflow/[id]/editor-shell.tsx` — Sidebar → Canvas wiring และลด JSX ซ้ำ
- `src/app/_components/workflow-canvas.tsx` — ใช้ shared utilities และ delete semantics เดียวกัน
- `src/app/_components/workflow-node.tsx` — `nodrag` และ keyboard-safe controls
- `src/app/workflow-canvas.css` — focus-visible states
- `src/lib/workflow-canvas-utils.ts` — append/rebuild pure utilities
- `src/lib/workflow-canvas-utils.test.ts` — regression tests
- `package.json` — version bump จาก repository hook เท่านั้น

## Risks and tradeoffs

- **Imperative ref:** เป็น API ขนาดเล็กและตรงกับ use case Sidebar สั่ง Canvas; หลีกเลี่ยงการ sync `initial` ด้วย `useEffect` ซึ่งเสี่ยง reset ตำแหน่ง Node ทุกครั้งที่ rename/drag
- **Node order:** payload ปัจจุบันเรียงตาม `position.x`; การลาก Node ข้ามกันจึงเปลี่ยน workflow order โดยตั้งใจ ต้องรักษาพฤติกรรมเดิม
- **Deleting final node:** แผนนี้อนุญาต empty draft เพื่อให้ delete semantics สอดคล้องกัน หาก backend ไม่รับ empty nodes ต้อง disable Save พร้อมข้อความ validation แทนการเก็บ state เก่าแบบเงียบ ๆ
- **Save smoke test:** ต้อง intercept local API เสมอ ห้ามยิง mutation ไป production backend ระหว่าง browser test
- **No new dependency:** ใช้ `bunx playwright` สำหรับ smoke test ไม่เพิ่ม Playwright ลง `package.json` เว้นแต่ทีมต้องการให้เป็น CI test ถาวร

## Open question

- ถ้า business rule กำหนดว่า Workflow ต้องมีอย่างน้อยหนึ่ง Node ให้เปลี่ยน acceptance criterion ข้อ 5 เป็น “ลบ Node สุดท้ายไม่ได้และแสดง disabled/tooltip อย่างชัดเจน” พร้อมเพิ่ม validation test ทั้ง UI และ Save payload ก่อนเริ่ม Task 3
