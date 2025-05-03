import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { getDiskUsage } from "@/services/api";
import { DiskUsage as DiskUsageType } from "@/types";
import { useToast } from "@/hooks/use-toast";

// Helper function to format numbers with specified precision
const formatNumber = (num: number, precision: number = 1): string => {
  return num.toFixed(precision);
};

const DiskUsage = () => {
  const [diskUsage, setDiskUsage] = useState<DiskUsageType>({
    used: 0,
    total: 0,
    percentage: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchDiskUsage = async () => {
      try {
        const data = await getDiskUsage();
        setDiskUsage(data);
      } catch (error) {
        console.error("Error fetching disk usage:", error);
        toast({
          title: "Error",
          description: "Failed to load disk usage data",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchDiskUsage();
  }, [toast]);

  if (isLoading) {
    return (
      <Card className="animate-fade-in">
        <CardHeader className="pb-2">
          <CardTitle>Disk Usage</CardTitle>
          <CardDescription>Storage space used</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-24">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="animate-fade-in">
      <CardHeader className="pb-2">
        <CardTitle>Disk Space Usage</CardTitle>
        <CardDescription>Storage space used</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col space-y-4">
          <div className="flex justify-between">
            <span className="text-sm font-medium">
              {formatNumber(diskUsage.used)} GB of{" "}
              {formatNumber(diskUsage.total)} GB
            </span>
            <span className="text-sm font-medium">
              {formatNumber(diskUsage.percentage)}%
            </span>
          </div>
          <Progress value={diskUsage.percentage} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Used</span>
            <span>Available</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default DiskUsage;
