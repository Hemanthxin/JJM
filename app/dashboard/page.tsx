import { getUser } from "@/lib/auth";
import { getAnalysis } from "@/lib/data";
import AppShell from "./AppShell";
import LogoutButton from "./LogoutButton";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getUser();
  const data = await getAnalysis();

  return (
    <>
      <header className="topbar">
        <h1>💧 Jal Jeevan Mission — SCSP / TSP</h1>
        <span className="pill">Karnataka</span>
        <span className="spacer" />
        <span className="who">{user}</span>
        <LogoutButton />
      </header>
      <AppShell data={data} />
    </>
  );
}
