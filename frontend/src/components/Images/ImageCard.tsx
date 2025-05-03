import { useState, useEffect } from "react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Image as ImageType } from "@/types";
import {
  Eye,
  Lock,
  Unlock,
  Share2,
  Trash2,
  BarChart2,
  Link as LinkIcon,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
import AuthenticatedImage from "./AuthenticatedImage";

interface ImageCardProps {
  image: ImageType;
  onTogglePrivacy: (isPrivate: boolean, password?: string) => void;
  onDelete: () => void;
}

const ImageCard = ({ image, onTogglePrivacy, onDelete }: ImageCardProps) => {
  const [isHovering, setIsHovering] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // Handle touch devices
  useEffect(() => {
    setShowInfo(isHovering);
  }, [isHovering]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const formatViews = (count: number) => {
    if (count < 1000) return count.toString();
    if (count < 1000000) return (count / 1000).toFixed(1) + "K";
    return (count / 1000000).toFixed(1) + "M";
  };

  const getPreviewSrc = () => {
    if (!image) return "";
    if (!image.uuid || !image.extension) return "";
    if (image.uuid && image.uuid.startsWith("temp-")) {
      return image.url || "";
    }
    return getImageUrl();
  };

  const getImageUrl = (forSharing: boolean = false) => {
    if (!image) return "";
    if (!image.uuid || !image.extension) return "";
    if (image.uuid && image.uuid.startsWith("temp-")) return image.url || "";

    if (forSharing) {
      const baseUrl = `${window.location.origin}/${image.uuid}.${image.extension}`;
      return image.isPrivate && image.privateKey
        ? `${baseUrl}?key=${btoa(image.privateKey)}`
        : baseUrl;
    }

    if (isAuthenticated) {
      return `/api/proxy/${image.uuid}.${image.extension}`;
    }

    return `/${image.uuid}.${image.extension}`;
  };

  const handleShare = () => {
    const imageUrl = getImageUrl(true);
    navigator.clipboard.writeText(imageUrl);
    toast({
      title: "Link copied!",
      description: "The image link has been copied to your clipboard.",
    });
  };

  const handleStatsClick = () => {
    navigate(`/dashboard/images/${image.id}`);
  };

  return (
    <Card
      className="overflow-hidden transition-all hover:shadow-md group"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <CardContent className="p-0 relative aspect-square">
        <AuthenticatedImage
          src={getPreviewSrc()}
          alt={image.filename}
          className="w-full h-full object-cover transition-all duration-300"
          loading="lazy"
        />

        {/* View Count Badge */}
        <div className="absolute top-2 left-2 bg-black/70 text-white rounded-full px-2 py-1 flex items-center gap-1.5 text-xs">
          <Eye className="h-3 w-3" />
          <span>{formatViews(image.views)}</span>
        </div>

        {image.isPrivate && (
          <div className="absolute top-2 right-2 bg-black/70 text-white rounded-full p-1.5">
            <Lock className="h-3 w-3" />
          </div>
        )}

        {showInfo && (
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex flex-col justify-end p-2 text-white shadow-[inset_0_-2px_4px_rgba(0,0,0,0.2)]">
            <h3 className="font-medium text-xs truncate">{image.filename}</h3>
            <p className="text-[10px] opacity-80">
              {formatDate(image.uploadedAt)} • {formatSize(image.size)}
            </p>
          </div>
        )}
      </CardContent>

      {isAuthenticated && (
        <CardFooter className="p-3 bg-muted/30 border-t">
          <div className="grid grid-cols-4 gap-2 w-full">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onTogglePrivacy(image.isPrivate ? false : true)}
              className="h-8 w-8 rounded-full hover:bg-orange-100 hover:text-orange-600 dark:hover:bg-orange-900/30 dark:hover:text-orange-400 transition-colors"
              title={image.isPrivate ? "Make Public" : "Make Private"}
              aria-label={image.isPrivate ? "Make Public" : "Make Private"}
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
              aria-label="Copy Link"
            >
              <LinkIcon className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleStatsClick}
              className="h-8 w-8 rounded-full hover:bg-purple-100 hover:text-purple-600 dark:hover:bg-purple-900/30 dark:hover:text-purple-400 transition-colors"
              title="View Statistics"
              aria-label="View Statistics"
            >
              <BarChart2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onDelete}
              className="h-8 w-8 rounded-full hover:bg-destructive hover:text-destructive-foreground transition-colors"
              title="Delete"
              aria-label="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </CardFooter>
      )}
    </Card>
  );
};

export default ImageCard;
