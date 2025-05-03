import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatsCardProps as BaseStatsCardProps } from "@/types";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

interface StatsCardProps extends BaseStatsCardProps {
  secondaryValue?: string;
  totalValue?: string;
  showProgress?: boolean;
}

const StatsCard = ({
  title,
  value,
  icon,
  change,
  helperText,
  secondaryValue,
  totalValue,
  showProgress,
}: StatsCardProps) => {
  // Extract percentage from secondaryValue if it exists and showProgress is true
  let progressValue = 0;
  if (showProgress && secondaryValue) {
    const percentMatch = secondaryValue.match(/(\d+\.?\d*)%/);
    if (percentMatch && percentMatch[1]) {
      progressValue = parseFloat(percentMatch[1]);
    }
  }

  return (
    <Card className="animate-fade-in h-full">
      <CardHeader className="flex flex-row items-center justify-between pb-1 pt-3">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center shadow-sm">
          {React.cloneElement(icon as React.ReactElement, {
            className: "h-5 w-5 text-primary",
          })}
        </div>
      </CardHeader>
      <CardContent className="pt-0 pb-3">
        <div className="flex flex-col">
          <div className="text-2xl font-bold tracking-tight">{value}</div>

          {totalValue && (
            <div className="text-xs text-muted-foreground mt-0.5 flex items-center">
              <span>of {totalValue}</span>
              {secondaryValue && (
                <span className="ml-1">({secondaryValue})</span>
              )}
            </div>
          )}

          {!totalValue && secondaryValue && (
            <div className="text-xs text-muted-foreground mt-0.5">
              {secondaryValue}
            </div>
          )}
        </div>

        {showProgress && (
          <div className="mt-2">
            <Progress value={progressValue} className="h-1.5" />
          </div>
        )}

        {(change || helperText) && (
          <div className="flex items-center text-xs mt-1">
            {change && (
              <span
                className={cn(
                  "mr-1 flex items-center font-medium",
                  change.isPositive ? "text-green-500" : "text-red-500"
                )}
              >
                {change.isPositive ? "↑" : "↓"} {Math.abs(change.value)}%
              </span>
            )}
            {helperText && (
              <span className="text-muted-foreground">{helperText}</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default StatsCard;
