import React from "react";
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

const RecentViewsTableSkeleton: React.FC = () => {
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
              {Array(5)
                .fill(0)
                .map((_, index) => (
                  <TableRow
                    key={index}
                    className="border-b border-muted/30 hover:bg-accent/50"
                  >
                    <TableCell className="font-medium py-4">
                      <div className="flex items-center truncate max-w-[160px]">
                        <Skeleton className="h-5 w-36" />
                        <div className="h-4 w-4 ml-1 flex-shrink-0">
                          <Skeleton className="h-4 w-4 rounded" />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-4 text-muted-foreground">
                      <Skeleton className="h-5 w-24" />
                    </TableCell>
                    <TableCell className="py-4 text-muted-foreground">
                      <Skeleton className="h-5 w-28" />
                    </TableCell>
                    <TableCell className="py-4 hidden md:table-cell">
                      <Skeleton className="h-6 w-20 rounded-full" />
                    </TableCell>
                    <TableCell className="py-4 text-muted-foreground whitespace-nowrap">
                      <Skeleton className="h-5 w-32" />
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

export default RecentViewsTableSkeleton;
