import { getStudioOverview } from "@/lib/studio-api";
import packageJson from "../../package.json";
import { StudioDashboard } from "./_components/studio-dashboard";

// Resolve the backend URL at request time in standalone deployments.
export const dynamic = "force-dynamic";

export default async function Home() {
  const data = await getStudioOverview();
  return <StudioDashboard data={data} appVersion={packageJson.version} />;
}
