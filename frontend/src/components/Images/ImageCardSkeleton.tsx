import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const ImageCardSkeleton = () => {
  return (
    <Card className="overflow-hidden transition-all">
      <CardContent className="p-0 relative aspect-square">
        <Skeleton className="h-full w-full" />

        {/* View Count Badge Skeleton */}
        <div className="absolute top-2 left-2">
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      </CardContent>
      <CardFooter className="p-3 bg-muted/30 border-t">
        <div className="grid grid-cols-4 gap-2 w-full">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
      </CardFooter>
    </Card>
  );
};

export default ImageCardSkeleton;
