import { useParams, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Eye, Globe, Monitor } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useState, useEffect } from "react";
import { Image, ImageView } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { getImageById, getImageViews } from "@/services/api";
import AuthenticatedImage from "@/components/Images/AuthenticatedImage";

const ImageStats = () => {
  const { id } = useParams<{ id: string }>();
  const [image, setImage] = useState<Image | null>(null);
  const [views, setViews] = useState<ImageView[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;

      try {
        setIsLoading(true);
        const [imageData, viewsData] = await Promise.all([
          getImageById(parseInt(id)),
          getImageViews(parseInt(id)),
        ]);

        setImage(imageData);
        setViews(viewsData);
      } catch (error) {
        console.error("Error fetching image stats:", error);
        toast({
          title: "Error",
          description: "Failed to load image statistics. Please try again.",
          variant: "destructive",
        });
        navigate("/images");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [id, navigate, toast]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!image) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <p className="text-lg font-medium text-destructive mb-2">
          Image not found
        </p>
        <Button variant="outline" asChild>
          <Link to="/images">Back to Images</Link>
        </Button>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Group views by country
  const countryViews = views.reduce((acc, view) => {
    const country = view.country || "Unknown";
    acc[country] = (acc[country] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Improved browser detection
  const detectBrowser = (userAgent: string): string => {
    const ua = userAgent.toLowerCase();
    if (ua.includes("chrome") && !ua.includes("edg")) return "Chrome";
    if (ua.includes("firefox")) return "Firefox";
    if (ua.includes("safari") && !ua.includes("chrome")) return "Safari";
    if (ua.includes("edg")) return "Edge";
    if (ua.includes("opera") || ua.includes("opr")) return "Opera";
    if (ua.includes("msie") || ua.includes("trident"))
      return "Internet Explorer";
    return "Unknown";
  };

  // Group views by browser
  const browserViews = views.reduce((acc, view) => {
    const browser = detectBrowser(view.userAgent);
    acc[browser] = (acc[browser] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" asChild>
            <Link to={`/images/${image.id}`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">
            Image Statistics
          </h1>
        </div>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-center bg-muted/40 rounded-md overflow-hidden h-auto max-h-[70vh]">
              <AuthenticatedImage
                src={`/api/proxy/${image.uuid}.${image.extension}`}
                alt={image.filename}
                className="max-w-full max-h-[calc(70vh-2rem)] object-contain"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Total Views</span>
                <span className="font-medium">
                  {image.views.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">First View</span>
                <span className="font-medium">
                  {views.length > 0
                    ? formatDate(views[views.length - 1].viewedAt)
                    : "No views yet"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Last View</span>
                <span className="font-medium">
                  {views.length > 0
                    ? formatDate(views[0].viewedAt)
                    : "No views yet"}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Views by Country
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(countryViews)
                .sort(([, a], [, b]) => b - a)
                .map(([country, count]) => (
                  <div
                    key={country}
                    className="flex justify-between items-center"
                  >
                    <span className="font-medium">{country}</span>
                    <span className="text-muted-foreground">
                      {count.toLocaleString()} views
                    </span>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Monitor className="h-5 w-5" />
              Views by Browser
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(browserViews)
                .sort(([, a], [, b]) => b - a)
                .map(([browser, count]) => (
                  <div
                    key={browser}
                    className="flex justify-between items-center"
                  >
                    <span className="font-medium">{browser}</span>
                    <span className="text-muted-foreground">
                      {count.toLocaleString()} views
                    </span>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Views</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {views.length === 0 ? (
                <p className="text-muted-foreground text-sm">No views yet</p>
              ) : (
                views.map((view) => (
                  <div
                    key={view.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {view.country || "Unknown"}
                      </span>
                      <span className="text-muted-foreground">
                        {detectBrowser(view.userAgent)}
                      </span>
                    </div>
                    <span className="text-muted-foreground">
                      {formatDate(view.viewedAt)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ImageStats;
