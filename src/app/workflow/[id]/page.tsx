import { getStudioOverview, type StudioWorkflow } from "@/lib/studio-api";
import { WorkflowEditorShell } from "./editor-shell";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function WorkflowPage({ params }: Props) {
  const { id } = await params;
  const isNew = id === "new";

  let workflow: StudioWorkflow | undefined;
  if (!isNew) {
    const overview = await getStudioOverview();
    workflow = overview.workflows.find((w) => w.id === id);
  }

  return <WorkflowEditorShell workflow={workflow ?? null} />;
}
