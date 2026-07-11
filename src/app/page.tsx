import { Sidebar } from "./_components/sidebar";
import { StudioDashboard } from "./_components/studio-dashboard";
import { getStudioOverview } from "@/lib/studio-api";

export default async function Home() {
  const data = await getStudioOverview();
  return <div className="app-shell"><Sidebar/><StudioDashboard data={data}/></div>;
}
