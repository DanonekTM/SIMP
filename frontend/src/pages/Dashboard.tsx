import { useEffect, useState, lazy, Suspense } from "react";
import StatsCard from "@/components/Dashboard/StatsCard";
// Lazy load heavy components
const ViewsChart = lazy(() => import("@/components/Dashboard/ViewsChart"));
const RecentCountries = lazy(
  () => import("@/components/Dashboard/RecentCountries")
);
const RecentViewsTable = lazy(
  () => import("@/components/Dashboard/RecentViewsTable")
);
import RecentViewsTableSkeleton from "@/components/Dashboard/RecentViewsTableSkeleton";
import { BarChart, Image, Lock, Gauge } from "lucide-react";
import {
  getViewsData,
  getDiskUsage,
  getCountryViews,
  getConfig,
  getDashboardStats,
} from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import {
  ViewsData,
  DiskUsage as DiskUsageType,
  DashboardStats as DashboardStatsType,
  CountryViews as CountryViewsType,
} from "@/types";
import DashboardSkeleton from "@/components/Dashboard/DashboardSkeleton";
import StatsCardSkeleton from "@/components/Dashboard/StatsCardSkeleton";
import RecentCountriesSkeleton from "@/components/Dashboard/RecentCountriesSkeleton";

// Component loading fallback
const ComponentLoading = () => (
  <div className="w-full p-8 flex justify-center">
    <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
  </div>
);

// Add a formatter function to display file sizes with appropriate units
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

const Dashboard = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<DashboardStatsType>({
    total_images: 0,
    private_images: 0,
    total_views: 0,
  });
  const [diskUsage, setDiskUsage] = useState<DiskUsageType>({
    used: 0,
    total: 0,
    percentage: 0,
  });
  const [viewsData, setViewsData] = useState<ViewsData[]>([]);
  const [countryViews, setCountryViews] = useState<CountryViewsType[]>([]);
  const [enableIPTracking, setEnableIPTracking] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const [dashboardStats, viewsData, diskUsage, countryViews, config] =
          await Promise.all([
            getDashboardStats().catch((e) => {
              console.error("Error fetching dashboard stats:", e);
              return {
                total_images: 0,
                private_images: 0,
                total_views: 0,
              } as DashboardStatsType;
            }),
            getViewsData().catch((e) => {
              console.error("Error fetching views data:", e);
              return [] as ViewsData[];
            }),
            getDiskUsage().catch((e) => {
              console.error("Error fetching disk usage:", e);
              return { used: 0, total: 0, percentage: 0 } as DiskUsageType;
            }),
            getCountryViews().catch((e) => {
              console.error("Error fetching country views:", e);
              return [];
            }),
            getConfig().catch((e) => {
              console.error("Error fetching config:", e);
              return { enable_ip_tracking: true };
            }),
          ]);

        setEnableIPTracking(config.enable_ip_tracking);
        setStats(dashboardStats);
        setDiskUsage(diskUsage);
        setViewsData(viewsData);
        setCountryViews(countryViews);
      } catch (error) {
        console.error("Dashboard error:", error);
        const errorMessage =
          error instanceof Error
            ? error.message
            : "Failed to load dashboard data";
        setError(errorMessage);
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [toast]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground">
              See your statistics at a glance
            </p>
          </div>
        </div>

        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {Array(4)
            .fill(0)
            .map((_, i) => (
              <StatsCardSkeleton key={i} />
            ))}
        </div>

        <div className="grid gap-6">
          <div className="col-span-full overflow-x-auto pb-2">
            <ViewsChart data={[]} isLoading={true} />
          </div>
          <div className="col-span-full overflow-x-auto pb-2">
            <RecentViewsTableSkeleton />
          </div>
          <div className="col-span-full">
            <RecentCountriesSkeleton />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <p className="text-lg font-medium text-destructive mb-2">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="text-sm text-primary hover:underline"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            See your statistics at a glance
          </p>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Views"
          value={stats.total_views.toLocaleString()}
          icon={<BarChart className="text-primary" />}
        />
        <StatsCard
          title="Images Hosted"
          value={stats.total_images.toLocaleString()}
          icon={<Image className="text-primary" />}
        />
        <StatsCard
          title="Private Images"
          value={stats.private_images.toLocaleString()}
          icon={<Lock className="text-primary" />}
        />
        <StatsCard
          title="Disk Usage"
          value={`${diskUsage.percentage.toFixed(1)}%`}
          icon={<Gauge className="text-primary" />}
          helperText={`${formatFileSize(
            diskUsage.used * 1024 * 1024 * 1024
          )} of ${formatFileSize(diskUsage.total * 1024 * 1024 * 1024)}`}
        />
      </div>

      <div className="grid gap-6">
        <div className="col-span-full overflow-x-auto pb-2">
          <Suspense fallback={<ComponentLoading />}>
            <ViewsChart data={viewsData} isLoading={isLoading} />
          </Suspense>
        </div>
        <div className="col-span-full overflow-x-auto pb-2">
          <Suspense fallback={<RecentViewsTableSkeleton />}>
            <RecentViewsTable />
          </Suspense>
        </div>
        <div className="col-span-full">
          <Suspense fallback={<RecentCountriesSkeleton />}>
            <RecentCountries data={countryViews} isLoading={isLoading} />
          </Suspense>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
