import { Visitor } from "@/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface ImageStatsProps {
  visitors: Visitor[];
}

const ImageStats = ({ visitors }: ImageStatsProps) => {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Visitor Statistics</CardTitle>
        <CardDescription>
          Detailed information about the last {visitors.length} visitors
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>IP Address</TableHead>
                <TableHead>Country</TableHead>
                <TableHead>Browser</TableHead>
                <TableHead>OS</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visitors.slice(0, 100).map((visitor) => (
                <TableRow key={visitor.id}>
                  <TableCell className="font-mono text-xs">
                    {formatDate(visitor.timestamp)}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {visitor.ip}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span>{getFlagEmoji(visitor.countryCode)}</span>
                      <span>{visitor.country}</span>
                    </div>
                  </TableCell>
                  <TableCell>{visitor.browser}</TableCell>
                  <TableCell>{visitor.os}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

// Helper function to get flag emoji from country code
const getFlagEmoji = (countryCode: string) => {
  // Handle the case when country code is undefined
  if (!countryCode) return "🏁";

  const codePoints = countryCode
    .toUpperCase()
    .split("")
    .map((char) => 127397 + char.charCodeAt(0));

  return String.fromCodePoint(...codePoints);
};

export default ImageStats;
