import { CountryViews } from "@/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { FlagIcon } from "@/components/common/FlagIcon";

interface CountryViewsListProps {
  data: CountryViews[];
  isLoading?: boolean;
  error?: string;
}

export const CountryViewsList = ({
  data,
  isLoading = false,
  error,
}: CountryViewsListProps) => {
  if (isLoading) {
    return <CountryViewsListSkeleton />;
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Country Views</CardTitle>
          <CardDescription>Views by country</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center items-center h-40">
            <p className="text-destructive">
              Error loading country data: {error}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Country Views</CardTitle>
        <CardDescription>Views by country</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {data.length === 0 ? (
            <p className="text-muted-foreground text-center py-6">
              No country data available
            </p>
          ) : (
            data.slice(0, 6).map((country) => (
              <div key={country.code} className="flex items-center gap-4">
                <FlagIcon countryCode={country.code} />
                <div className="flex-1">
                  <div className="flex justify-between mb-1">
                    <span className="font-medium">{country.country}</span>
                    <span className="text-muted-foreground">
                      {country.views} views
                    </span>
                  </div>
                  <Progress value={country.percentage} className="h-2" />
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export const CountryViewsListSkeleton = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Country Views</CardTitle>
        <CardDescription>Views by country</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-6 w-10" />
              <div className="flex-1">
                <div className="flex justify-between mb-1">
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-5 w-16" />
                </div>
                <Skeleton className="h-2 w-full" />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
