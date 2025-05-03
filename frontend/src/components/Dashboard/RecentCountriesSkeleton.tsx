import React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const RecentCountriesSkeleton = () => {
  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <CardTitle>Views by Country</CardTitle>
        <CardDescription>Top countries by view count</CardDescription>
      </CardHeader>
      <CardContent className="p-3 sm:p-6">
        <div className="w-full overflow-hidden">
          <div className="space-y-4 w-full">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="w-full">
                <div className="flex items-center gap-2 w-full mb-2 pr-1">
                  <div className="flex-shrink-0">
                    <Skeleton className="h-5 w-5" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 relative min-w-[100px]">
                        <Skeleton className="h-2 w-full" />
                      </div>
                      <div className="flex-shrink-0 flex gap-1">
                        <Skeleton className="h-4 w-12" />
                        <Skeleton className="h-4 w-10" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default RecentCountriesSkeleton;
