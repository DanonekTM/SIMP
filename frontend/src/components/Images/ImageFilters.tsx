import { useState } from "react";
import { Calendar, FilterX } from "lucide-react";
import { format } from "date-fns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

export type DateRange = { from: Date | undefined; to: Date | undefined };
export type ImageType = "all" | "gif" | "image";

interface ImageFiltersProps {
  dateRange: DateRange;
  setDateRange: (range: DateRange) => void;
  selectedType: ImageType;
  setSelectedType: (type: ImageType) => void;
  onClear: () => void;
}

const ImageFilters = ({
  dateRange,
  setDateRange,
  selectedType,
  setSelectedType,
  onClear,
}: ImageFiltersProps) => {
  const [tempDateRange, setTempDateRange] = useState<DateRange>({
    from: dateRange.from,
    to: dateRange.to,
  });
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  // Check if any filters are active
  const hasActiveFilters =
    dateRange.from !== undefined ||
    dateRange.to !== undefined ||
    selectedType !== "all";

  // Handle date range popover open/close
  const handleOpenChange = (open: boolean) => {
    if (open) {
      // When opening, initialize temp range with current range
      setTempDateRange({
        from: dateRange.from,
        to: dateRange.to,
      });
    } else {
      // When closing, apply the temp range to the actual range
      setDateRange(tempDateRange);
    }
    setIsCalendarOpen(open);
  };

  return (
    <div className="flex flex-wrap items-center gap-4 mb-6">
      <Popover open={isCalendarOpen} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="min-w-[240px] justify-start">
            <Calendar className="mr-2 h-4 w-4" />
            {dateRange.from ? (
              dateRange.to ? (
                <>
                  {format(dateRange.from, "LLL dd, y")} -{" "}
                  {format(dateRange.to, "LLL dd, y")}
                </>
              ) : (
                format(dateRange.from, "LLL dd, y")
              )
            ) : (
              <span>Pick a date range</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <CalendarComponent
            initialFocus
            mode="range"
            defaultMonth={tempDateRange.from}
            selected={{
              from: tempDateRange.from,
              to: tempDateRange.to,
            }}
            onSelect={(range) => {
              setTempDateRange({
                from: range?.from,
                to: range?.to,
              });
            }}
            numberOfMonths={2}
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>

      <Select
        value={selectedType}
        onValueChange={(value) => {
          setSelectedType(value as ImageType);
        }}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Select type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All</SelectItem>
          <SelectItem value="gif">GIFs</SelectItem>
          <SelectItem value="image">Images</SelectItem>
        </SelectContent>
      </Select>

      {hasActiveFilters && (
        <Button
          variant="outline"
          size="icon"
          onClick={onClear}
          className="h-10 w-10"
          title="Clear filters"
        >
          <FilterX className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
};

export default ImageFilters;
