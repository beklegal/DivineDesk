import DashboardContent from "@/components/dashboard/DashboardContent";
import { AppShell } from "@/components/layout/AppShell";
import { BarChart3 } from "lucide-react";

export default function Dashboard() {
  return (
    <AppShell
      title="Church overview"
      description="See the pulse of your ministry at a glance, from member momentum to giving and upcoming gatherings."
      icon={BarChart3}
      eyebrow="Weekly leadership view"
    >
      <DashboardContent />
    </AppShell>
  );
}
