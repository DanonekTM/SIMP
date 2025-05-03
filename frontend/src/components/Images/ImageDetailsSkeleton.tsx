import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const ImageDetailsSkeleton = () => {
  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="mb-8">
        <div>
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-72" />
        </div>
      </div>

      {/* Navigation and Actions Bar */}
      <div className="flex items-center justify-between mb-6">
        <Skeleton className="h-10 w-36" /> {/* Back button */}
        <div className="flex items-center space-x-2">
          <Skeleton className="h-8 w-8 rounded-full" /> {/* Privacy button */}
          <Skeleton className="h-8 w-8 rounded-full" /> {/* Share button */}
          <Skeleton className="h-8 w-8 rounded-full" /> {/* Delete button */}
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Image Panel */}
        <div className="lg:col-span-2">
          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-center bg-muted/40 rounded-md overflow-hidden h-auto">
                <Skeleton className="w-full aspect-video" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Details Panel */}
        <div className="space-y-6">
          <Card>
            <CardContent className="p-4 sm:p-6">
              <Skeleton className="h-6 w-32 mb-4" /> {/* Details heading */}
              <div className="space-y-3">
                {Array(5)
                  .fill(0)
                  .map((_, i) => (
                    <div key={i} className="space-y-1">
                      <Skeleton className="h-3.5 w-16" /> {/* Label */}
                      <Skeleton className="h-4 w-28" /> {/* Value */}
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Recent Views Table */}
      <Card className="w-full shadow-sm">
        <CardHeader className="pb-2">
          <Skeleton className="h-6 w-32 mb-1" /> {/* Table title */}
          <Skeleton className="h-4 w-48" /> {/* Table description */}
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto -mx-6 px-6">
            <div className="min-w-[600px]">
              {/* Table Header */}
              <div className="flex border-b border-border py-3">
                <Skeleton className="h-4 w-[100px] mr-4" />
                <Skeleton className="h-4 w-[120px] mr-4" />
                <Skeleton className="h-4 w-[120px] mr-4" />
                <Skeleton className="h-4 w-[160px]" />
              </div>

              {/* Table Rows */}
              {Array(3)
                .fill(0)
                .map((_, i) => (
                  <div key={i} className="flex border-b border-muted/30 py-4">
                    <Skeleton className="h-6 w-6 rounded-full mr-[110px]" />
                    <Skeleton className="h-4 w-[100px] mr-[40px]" />
                    <Skeleton className="h-4 w-[100px] mr-[40px]" />
                    <Skeleton className="h-4 w-[140px]" />
                  </div>
                ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ImageDetailsSkeleton;
