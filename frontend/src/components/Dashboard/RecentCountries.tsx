import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CountryViews } from "@/types";
import { Progress } from "@/components/ui/progress";
import { FlagIcon } from "@/components/common/FlagIcon";
import RecentCountriesSkeleton from "./RecentCountriesSkeleton";
import { cn } from "@/lib/utils";

// Custom progress component that fills from right to left
const ReverseProgress = ({
  value,
  className,
}: {
  value: number;
  className?: string;
}) => (
  <div
    className={cn(
      "relative h-2 w-full overflow-hidden rounded-full bg-secondary",
      className
    )}
  >
    <div
      className="h-full bg-primary absolute right-0 rounded-full transition-all"
      style={{ width: `${value || 0}%` }}
    />
  </div>
);

interface RecentCountriesProps {
  data: CountryViews[];
  isLoading: boolean;
}

const RecentCountries = ({
  data: countryViews,
  isLoading,
}: RecentCountriesProps) => {
  if (isLoading) {
    return <RecentCountriesSkeleton />;
  }

  return (
    <Card className="animate-fade-in w-full">
      <CardHeader className="pb-2">
        <CardTitle>Views by Country</CardTitle>
        <CardDescription>Top countries by view count</CardDescription>
      </CardHeader>
      <CardContent className="p-3 sm:p-6">
        <div className="w-full overflow-hidden">
          {countryViews.length === 0 ? (
            <p className="text-muted-foreground text-center py-6">
              No country data available
            </p>
          ) : (
            <div className="space-y-4 w-full">
              {countryViews.map((country) => (
                <div key={country.code || "unknown"} className="w-full">
                  <div className="flex items-center gap-2 w-full mb-2 pr-1">
                    <div className="flex-shrink-0">
                      <FlagIcon
                        countryCode={country.code || "unknown"}
                        countryName={country.country}
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 relative min-w-[100px]">
                          <ReverseProgress value={country.percentage || 0} />
                        </div>
                        <div className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
                          {(country.views || 0).toLocaleString()} (
                          {(country.percentage || 0).toFixed(1)}%)
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default RecentCountries;
