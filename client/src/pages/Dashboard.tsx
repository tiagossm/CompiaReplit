import StatsGrid from "@/components/Dashboard/StatsGrid";
import ChartsSection from "@/components/Dashboard/ChartsSection";
import RecentInspectionsTable from "@/components/Dashboard/RecentInspectionsTable";
import PriorityActionsCard from "@/components/Dashboard/PriorityActionsCard";
import AIInsightsSection from "@/components/Dashboard/AIInsightsSection";

export default function Dashboard() {
  return (
    <div className="p-6 space-y-6" data-testid="dashboard-page">
      {/* Key Metrics */}
      <StatsGrid />

      {/* Charts Section */}
      <ChartsSection />

      {/* Recent Activity and Priority Items */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <RecentInspectionsTable />
        <PriorityActionsCard />
      </div>

      {/* AI Insights */}
      <AIInsightsSection />
    </div>
  );
}
