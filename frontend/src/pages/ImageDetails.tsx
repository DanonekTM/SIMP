import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Image as ImageType, ImageView } from "@/types";
import {
  getImageStats,
  updateImagePrivacy,
  deleteImage,
  getAuthHeaders,
} from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow, parseISO } from "date-fns";
import {
  Loader2,
  AlertCircle,
  ArrowLeft,
  Lock,
  Unlock,
  Link as LinkIcon,
  Trash2,
  Image,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/context/AuthContext";
import PrivacyDialog from "@/components/Images/PrivacyDialog";
import DeleteDialog from "@/components/Images/DeleteDialog";
import ImageDetailsSkeleton from "@/components/Images/ImageDetailsSkeleton";
import { FlagIcon } from "@/components/common/FlagIcon";

const ImageDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [image, setImage] = useState<ImageType | null>(null);
  const [views, setViews] = useState<ImageView[]>([]);
  const [statsLoading, setStatsLoading] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [isPrivacyDialogOpen, setIsPrivacyDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();
  const currentImageUuid = useRef<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchImage = async () => {
      if (!id) return;

      setStatsLoading(true);
      try {
        const imageId = parseInt(id);
        if (isNaN(imageId)) {
          throw new Error("Invalid image ID");
        }

        // Fetch both image and views in a single call
        const data = await getImageStats(imageId);

        if (isMounted) {
          setImage(data.image);
          setViews(data.views);
        }
      } catch (error) {
        if (isMounted) {
          console.error("Error fetching image:", error);
          toast({
            title: "Error",
            description:
              "Failed to load image details. Redirecting to images page.",
            variant: "destructive",
          });
          // Small delay to show the toast before redirecting
          setTimeout(() => {
            navigate("/dashboard/images");
          }, 2000);
        }
      } finally {
        if (isMounted) {
          setStatsLoading(false);
        }
      }
    };

    fetchImage();

    return () => {
      isMounted = false;
    };
  }, [id, toast, navigate]);

  useEffect(() => {
    let isMounted = true;
    let objectUrl: string | null = null;

    const fetchImageBlob = async () => {
      if (!image || !isAuthenticated) {
        setImageSrc(null);
        setImageError("Cannot load image: Authentication required.");
        return;
      }

      if (image.uuid === currentImageUuid.current && imageSrc) return;

      currentImageUuid.current = image.uuid;
      setImageLoading(true);
      setImageError(null);
      setImageSrc(null);

      try {
        const response = await fetch(
          `/api/proxy/${image.uuid}.${image.extension}`,
          {
            headers: getAuthHeaders(),
            credentials: "include",
          }
        );

        if (!response.ok) {
          if (response.status === 401) {
            throw new Error("Unauthorized: Please log in again.");
          } else if (response.status === 404) {
            throw new Error("Image not found on server.");
          } else {
            throw new Error(
              `Failed to fetch image: ${response.status} ${response.statusText}`
            );
          }
        }

        const blob = await response.blob();
        objectUrl = URL.createObjectURL(blob);
        if (isMounted) {
          setImageSrc(objectUrl);
        }
      } catch (error) {
        if (isMounted) {
          console.error("Error fetching image blob:", error);
          setImageError(
            error instanceof Error ? error.message : "Could not load image"
          );
        }
      } finally {
        if (isMounted) {
          setImageLoading(false);
        }
      }
    };

    if (image) {
      fetchImageBlob();
    } else {
      setImageSrc(null);
      currentImageUuid.current = null;
    }

    return () => {
      isMounted = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
      currentImageUuid.current = null;
    };
  }, [image, isAuthenticated]);

  const handleTogglePrivacy = async (isPrivate: boolean, password?: string) => {
    if (!image || !isAuthenticated) {
      toast({
        title: "Error",
        description: "You must be authenticated to change image privacy.",
        variant: "destructive",
      });
      return;
    }

    try {
      const updatedImage = await updateImagePrivacy(
        image.id,
        isPrivate,
        password
      );

      setImage({
        ...updatedImage,
        url:
          isPrivate && password
            ? `/${updatedImage.uuid}.${updatedImage.extension}?key=${btoa(
                password
              )}`
            : `/${updatedImage.uuid}.${updatedImage.extension}`,
        isPrivate: updatedImage.is_private ?? updatedImage.isPrivate,
        privateKey: updatedImage.private_key ?? updatedImage.privateKey ?? "",
      });

      toast({
        title: isPrivate ? "Image is now private" : "Image is now public",
        description: isPrivate
          ? "This image is only visible with the private link"
          : "This image is now visible to everyone",
      });
    } catch (error) {
      console.error("Error updating image privacy:", error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to update image privacy";
      toast({
        title: "Error",
        description: errorMessage.includes("CSRF")
          ? "Session expired. Please refresh the page."
          : "Failed to update image privacy. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsPrivacyDialogOpen(false);
    }
  };

  const handleDelete = async () => {
    if (!image || !isAuthenticated) {
      toast({
        title: "Error",
        description: "You must be authenticated to delete images.",
        variant: "destructive",
      });
      return;
    }

    try {
      await deleteImage(image.uuid);
      toast({
        title: "Success",
        description: "Image deleted successfully",
      });
      navigate("/dashboard/images");
    } catch (error) {
      console.error("Error deleting image:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to delete image";
      toast({
        title: "Error",
        description: errorMessage.includes("CSRF")
          ? "Session expired. Please refresh the page."
          : "Failed to delete image. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleShare = () => {
    if (!image) return;
    const url =
      image.isPrivate && image.privateKey
        ? `${window.location.origin}/${image.uuid}.${
            image.extension
          }?key=${btoa(image.privateKey)}`
        : `${window.location.origin}/${image.uuid}.${image.extension}`;
    navigator.clipboard.writeText(url);
    toast({
      title: "Link copied",
      description: "Image link has been copied to clipboard",
    });
  };

  const formatDate = (dateString: string | null | undefined): string => {
    if (!dateString) return "Unknown";
    try {
      const date = parseISO(dateString);
      return formatDistanceToNow(date, { addSuffix: true });
    } catch (error) {
      return "Invalid date";
    }
  };

  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
  };

  // Helper function to detect browser from user agent
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

  if (statsLoading) {
    return <ImageDetailsSkeleton />;
  }

  if (!image) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <p className="text-lg font-medium text-destructive mb-2">
          Image not found
        </p>
        <Button
          variant="outline"
          onClick={() => navigate("/dashboard/images")}
          className="mt-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Images
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {image.filename}
          </h1>
          <p className="text-muted-foreground">
            View image details and statistics
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between mb-6">
        <Button
          variant="outline"
          onClick={() => navigate("/dashboard/images")}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Images
        </Button>

        {isAuthenticated && (
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsPrivacyDialogOpen(true)}
              className="h-8 w-8 rounded-full hover:bg-orange-100 hover:text-orange-600 dark:hover:bg-orange-900/30 dark:hover:text-orange-400 transition-colors"
              title={image.isPrivate ? "Make Public" : "Make Private"}
            >
              {image.isPrivate ? (
                <Unlock className="h-4 w-4" />
              ) : (
                <Lock className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleShare}
              className="h-8 w-8 rounded-full hover:bg-blue-100 hover:text-blue-600 dark:hover:bg-blue-900/30 dark:hover:text-blue-400 transition-colors"
              title="Copy Link"
            >
              <LinkIcon className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsDeleteDialogOpen(true)}
              className="h-8 w-8 rounded-full hover:bg-destructive hover:text-destructive-foreground transition-colors"
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-center bg-muted/40 rounded-md overflow-hidden h-auto max-h-[70vh]">
                {imageLoading && (
                  <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
                )}
                {imageError && !imageLoading && (
                  <div className="flex flex-col items-center text-destructive p-4">
                    <AlertCircle className="h-10 w-10 mb-2" />
                    <span className="text-sm font-medium">
                      Error Loading Image
                    </span>
                    <span className="text-xs text-center">({imageError})</span>
                  </div>
                )}
                {!imageLoading && !imageError && imageSrc && (
                  <img
                    src={imageSrc}
                    alt={image.filename}
                    className="max-w-full max-h-[calc(70vh-2rem)] object-contain"
                  />
                )}
                {!imageLoading && !imageError && !imageSrc && (
                  <div className="flex flex-col items-center text-muted-foreground p-4">
                    <AlertCircle className="h-10 w-10 mb-2" />
                    <span className="text-sm font-medium">
                      Image not available
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardContent className="p-4 sm:p-6">
              <h3 className="text-lg font-semibold mb-4">Image Details</h3>
              <dl className="space-y-2">
                <div>
                  <dt className="text-sm text-muted-foreground">Filename</dt>
                  <dd className="text-sm font-medium">{image.filename}</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">Size</dt>
                  <dd className="text-sm font-medium">
                    {formatBytes(image.size)}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">Uploaded</dt>
                  <dd className="text-sm font-medium">
                    {formatDate(image.uploadedAt)}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">Views</dt>
                  <dd className="text-sm font-medium">{image.views}</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">Status</dt>
                  <dd className="text-sm font-medium">
                    {image.isPrivate ? (
                      <span className="flex items-center text-amber-500">
                        <Lock className="h-3 w-3 mr-1" />
                        Private
                      </span>
                    ) : (
                      <span className="flex items-center text-green-500">
                        <Unlock className="h-3 w-3 mr-1" />
                        Public
                      </span>
                    )}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="w-full shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle>Recent Views</CardTitle>
          <CardDescription>View activity for this image</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto -mx-6 px-6">
            {views.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                No views yet
              </div>
            ) : (
              <Table className="min-w-[600px]">
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-b border-border">
                    <TableHead className="w-[100px] font-medium text-foreground bg-background py-3 uppercase text-xs tracking-wider">
                      Country
                    </TableHead>
                    <TableHead className="w-[120px] font-medium text-foreground bg-background py-3 uppercase text-xs tracking-wider">
                      IP Address
                    </TableHead>
                    <TableHead className="w-[120px] font-medium text-foreground bg-background py-3 uppercase text-xs tracking-wider">
                      Browser
                    </TableHead>
                    <TableHead className="w-[160px] font-medium text-foreground bg-background py-3 uppercase text-xs tracking-wider">
                      Time
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {views.map((view) => (
                    <TableRow
                      key={view.id}
                      className="border-b border-muted/30 hover:bg-accent/50"
                    >
                      <TableCell className="py-4">
                        <FlagIcon
                          countryCode={view.country_code || "unknown"}
                          countryName={view.country_name || view.country}
                          className="text-muted-foreground"
                        />
                      </TableCell>
                      <TableCell className="py-4 text-muted-foreground font-mono text-xs">
                        {view.ip}
                      </TableCell>
                      <TableCell className="py-4 text-muted-foreground">
                        {detectBrowser(view.user_agent || view.userAgent)}
                      </TableCell>
                      <TableCell className="py-4 text-muted-foreground whitespace-nowrap">
                        {formatDate(view.viewed_at || view.viewedAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </CardContent>
      </Card>

      <PrivacyDialog
        open={isPrivacyDialogOpen}
        onOpenChange={setIsPrivacyDialogOpen}
        isPrivate={image.isPrivate}
        onConfirm={handleTogglePrivacy}
      />

      <DeleteDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirm={handleDelete}
      />
    </div>
  );
};

export default ImageDetails;
