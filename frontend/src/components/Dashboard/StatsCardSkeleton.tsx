import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const StatsCardSkeleton = () => {
  return (
    <Card className="animate-fade-in h-full">
      <CardHeader className="flex flex-row items-center justify-between pb-1 pt-3">
        <Skeleton className="h-4 w-24" />
        <div className="h-8 w-8 rounded-md bg-primary/5 flex items-center justify-center shadow-sm">
          <Skeleton className="h-5 w-5 rounded-full" />
        </div>
      </CardHeader>
      <CardContent className="pt-0 pb-3">
        <div className="flex flex-col">
          <Skeleton className="h-8 w-[60%] mb-1" />
          <Skeleton className="h-3 w-[80%] mt-0.5" />
        </div>
      </CardContent>
    </Card>
  );
};

export default StatsCardSkeleton;
