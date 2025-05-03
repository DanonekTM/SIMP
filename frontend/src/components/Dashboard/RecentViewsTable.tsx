import { useState, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { getRecentViews } from "@/services/api";
import { Link } from "react-router-dom";
import RecentViewsTableSkeleton from "./RecentViewsTableSkeleton";
import { FlagIcon } from "@/components/common/FlagIcon";

interface RecentView {
  id: number;
  imageId: number;
  imageUuid: string;
  ip: string;
  country: string;
  country_name?: string;
  country_code?: string;
  countryCode?: string;
  userAgent: string;
  viewedAt: string;
}

export function RecentViewsTable() {
  const [data, setData] = useState<RecentView[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Fetch the latest views
        const response = await getRecentViews();
        setData(response.views);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to fetch recent views"
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const detectBrowser = (userAgent: string): string => {
    if (userAgent.includes("Firefox")) return "Firefox";
    if (userAgent.includes("Chrome") && !userAgent.includes("Edg"))
      return "Chrome";
    if (userAgent.includes("Safari") && !userAgent.includes("Chrome"))
      return "Safari";
    if (userAgent.includes("Edg")) return "Edge";
    if (userAgent.includes("MSIE") || userAgent.includes("Trident"))
      return "Internet Explorer";
    return "Unknown";
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);

    // Format date part
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();

    // Format time part
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");

    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
  };

  if (isLoading) {
    return <RecentViewsTableSkeleton />;
  }

  if (error) {
    return (
      <Card className="w-full shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle>Recent Views</CardTitle>
          <CardDescription>Below are the most recent views</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-red-500">Error: {error}</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle>Recent Views</CardTitle>
        <CardDescription>Below are the most recent views</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto -mx-6 px-6">
          <Table className="min-w-[600px]">
            <TableHeader>
              <TableRow className="hover:bg-transparent border-b border-border">
                <TableHead className="w-[180px] font-medium text-foreground bg-background py-3 uppercase text-xs tracking-wider">
                  Image UUID
                </TableHead>
                <TableHead className="w-[100px] font-medium text-foreground bg-background py-3 uppercase text-xs tracking-wider">
                  Country
                </TableHead>
                <TableHead className="w-[120px] font-medium text-foreground bg-background py-3 uppercase text-xs tracking-wider">
                  IP Address
                </TableHead>
                <TableHead className="w-[120px] font-medium text-foreground bg-background py-3 uppercase text-xs tracking-wider hidden md:table-cell">
                  Browser
                </TableHead>
                <TableHead className="w-[160px] font-medium text-foreground bg-background py-3 uppercase text-xs tracking-wider">
                  Viewed At
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center py-6 text-muted-foreground"
                  >
                    No recent views
                  </TableCell>
                </TableRow>
              ) : (
                data.map((view) => (
                  <TableRow
                    key={view.id}
                    className="border-b border-muted/30 hover:bg-accent/50"
                  >
                    <TableCell className="font-medium py-4">
                      <div className="truncate max-w-[160px]">
                        <Link
                          to={`/dashboard/images/${view.imageId}`}
                          className="text-primary group hover:no-underline flex items-center"
                        >
                          <span className="group-hover:underline truncate">
                            {view.imageUuid}
                          </span>
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-4 w-4 ml-1 flex-shrink-0"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                            />
                          </svg>
                        </Link>
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <FlagIcon
                        countryCode={
                          view.country_code || view.countryCode || view.country
                        }
                        countryName={view.country_name || view.country}
                        className="text-muted-foreground"
                      />
                    </TableCell>
                    <TableCell className="py-4 text-muted-foreground">
                      {view.ip}
                    </TableCell>
                    <TableCell className="py-4 hidden md:table-cell text-muted-foreground">
                      {detectBrowser(view.userAgent)}
                    </TableCell>
                    <TableCell className="py-4 text-muted-foreground whitespace-nowrap">
                      {formatDate(view.viewedAt)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

export default RecentViewsTable;
