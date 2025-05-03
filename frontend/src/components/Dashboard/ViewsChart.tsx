import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { ViewsData } from "@/types";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";

interface ViewsChartProps {
  data: ViewsData[];
  isLoading: boolean;
}

const ViewsChart = ({ data: viewsData, isLoading }: ViewsChartProps) => {
  const chartConfig = {
    views: {
      label: "Views",
      color: "hsl(var(--foreground))",
    },
  };

  if (isLoading) {
    return (
      <Card className="animate-fade-in flex flex-col h-[350px] w-full">
        <CardHeader className="pb-2">
          <CardTitle>Views Over Time</CardTitle>
          <CardDescription>
            Daily view count for the last 30 days
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-grow px-1">
          <div className="h-full w-full relative">
            {/* Chart skeleton */}
            <div className="absolute inset-0 flex flex-col">
              {/* Y-axis skeleton */}
              <div className="h-full w-8 sm:w-10 flex flex-col justify-between pr-2">
                {Array(6)
                  .fill(0)
                  .map((_, i) => (
                    <Skeleton key={i} className="h-3 sm:h-4 w-6 sm:w-8" />
                  ))}
              </div>

              {/* Chart area skeleton */}
              <div className="flex-1 ml-8 sm:ml-10 flex flex-col justify-between">
                {/* Grid lines */}
                <div className="h-full flex flex-col justify-between">
                  {Array(6)
                    .fill(0)
                    .map((_, i) => (
                      <div key={i} className="h-px w-full bg-muted/20" />
                    ))}
                </div>

                {/* Line chart skeleton */}
                <div className="absolute inset-0 ml-8 sm:ml-10 flex items-center">
                  <div className="w-full h-16 sm:h-24">
                    <Skeleton className="w-full h-full" />
                  </div>
                </div>
              </div>

              {/* X-axis skeleton */}
              <div className="h-6 mt-2 ml-8 sm:ml-10 flex justify-between">
                {Array(7)
                  .fill(0)
                  .map((_, i) => (
                    <Skeleton key={i} className="h-3 sm:h-4 w-8 sm:w-12" />
                  ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="animate-fade-in flex flex-col h-[350px] w-full min-w-[300px]">
      <CardHeader className="pb-2">
        <CardTitle>Views Over Time</CardTitle>
        <CardDescription>Daily view count for the last 30 days</CardDescription>
      </CardHeader>
      <CardContent className="flex-grow px-1 overflow-hidden">
        {viewsData.length === 0 ? (
          <div className="h-full w-full flex items-center justify-center">
            <p className="text-muted-foreground">No view data available</p>
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-full w-full">
            <ResponsiveContainer width="99%" height="99%">
              <LineChart
                accessibilityLayer
                data={viewsData}
                margin={{
                  top: 5,
                  right: 25,
                  left: 10,
                  bottom: 10,
                }}
              >
                <CartesianGrid
                  vertical={false}
                  stroke="hsl(var(--border))"
                  strokeDasharray="3 3"
                />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={10}
                  tickFormatter={(value) => value.slice(5)}
                  style={{
                    fontSize: "11px",
                    fill: "hsl(var(--muted-foreground))",
                  }}
                  minTickGap={15}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={10}
                  width={40}
                  tickFormatter={(value) => `${value}`}
                  style={{
                    fontSize: "11px",
                    fill: "hsl(var(--muted-foreground))",
                  }}
                />
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent indicator="line" />}
                />
                <Line
                  dataKey="views"
                  type="monotone"
                  stroke="hsl(var(--foreground))"
                  strokeWidth={1.5}
                  dot={false}
                  activeDot={{
                    r: 4,
                    fill: "hsl(var(--foreground))",
                  }}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
};

export default ViewsChart;
