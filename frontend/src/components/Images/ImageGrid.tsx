import { useState, useEffect, useRef, useCallback } from "react";
import ImageCard from "./ImageCard";
import { Image } from "@/types";
import { useToast } from "@/hooks/use-toast";
import ImageFilters, { DateRange, ImageType } from "./ImageFilters";
import { getImages, updateImagePrivacy, deleteImage } from "@/services/api";
import ImageCardSkeleton from "./ImageCardSkeleton";
import { Loader2, ImageIcon, UploadCloud, FilterX } from "lucide-react";
import PrivacyDialog from "./PrivacyDialog";
import DeleteDialog from "./DeleteDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface ImageGridProps {
  newImage?: Image | null;
  isUploading?: boolean;
}

const ImageGrid = ({ newImage, isUploading = false }: ImageGridProps) => {
  const [images, setImages] = useState<Image[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showSkeleton, setShowSkeleton] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>({
    from: undefined,
    to: undefined,
  });
  const [selectedType, setSelectedType] = useState<ImageType>("all");
  const [isPrivacyDialogOpen, setIsPrivacyDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<Image | null>(null);
  const { toast } = useToast();

  const fetchImages = async () => {
    try {
      setIsLoading(true);
      setShowSkeleton(true);
      setError(null);
      const data = await getImages(
        selectedType === "all" ? undefined : selectedType,
        dateRange.from?.toISOString().split("T")[0],
        dateRange.to?.toISOString().split("T")[0]
      );
      setImages(data);

      // Add a delay before removing the skeleton
      setTimeout(() => {
        setShowSkeleton(false);
      }, 300); // 300ms delay
    } catch (error) {
      console.error("Error fetching images:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to load images";
      setError(errorMessage);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchImages();
  }, [
    selectedType,
    dateRange.from ? dateRange.from.toISOString() : undefined,
    dateRange.to ? dateRange.to.toISOString() : undefined,
  ]);

  // Handle new image updates
  useEffect(() => {
    if (newImage) {
      setImages((prevImages) => {
        // Only add the image if it's not already in the list
        const exists = prevImages.some((img) => img.id === newImage.id);
        if (!exists) {
          return [newImage, ...prevImages];
        }
        return prevImages;
      });
    }
  }, [newImage]);

  const handleTogglePrivacy = async (isPrivate: boolean, password?: string) => {
    if (!selectedImage) return;
    try {
      const updatedImage = await updateImagePrivacy(
        selectedImage.id,
        isPrivate,
        password
      );

      setImages((prevImages) =>
        prevImages.map((image) =>
          image.id === selectedImage.id
            ? {
                ...image,
                isPrivate: updatedImage.is_private ?? updatedImage.isPrivate,
                privateKey:
                  updatedImage.private_key ?? updatedImage.privateKey ?? "",
                url:
                  (updatedImage.is_private ?? updatedImage.isPrivate) &&
                  (updatedImage.private_key ?? updatedImage.privateKey)
                    ? `/${updatedImage.uuid}.${
                        updatedImage.extension
                      }?key=${btoa(
                        updatedImage.private_key ??
                          updatedImage.privateKey ??
                          ""
                      )}`
                    : `/${updatedImage.uuid}.${updatedImage.extension}`,
              }
            : image
        )
      );

      toast({
        title: isPrivate ? "Image is now private" : "Image is now public",
        description: isPrivate
          ? "This image is only visible to you"
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
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsPrivacyDialogOpen(false);
      setSelectedImage(null);
    }
  };

  const handleDelete = async () => {
    if (!selectedImage) return;
    try {
      await deleteImage(selectedImage.id);
      setImages((prevImages) =>
        prevImages.filter((image) => image.id !== selectedImage.id)
      );
      toast({
        title: "Success",
        description: "Image deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting image:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to delete image";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsDeleteDialogOpen(false);
      setSelectedImage(null);
    }
  };

  const handleClearFilters = () => {
    // Only fetch if we had active filters
    const hadActiveFilters =
      dateRange.from !== undefined ||
      dateRange.to !== undefined ||
      selectedType !== "all";

    // Reset filters
    setDateRange({ from: undefined, to: undefined });
    setSelectedType("all");

    // Only fetch if we had active filters
    if (hadActiveFilters) {
      fetchImages();
    }
  };

  // Check if filters are active
  const hasActiveFilters =
    dateRange.from !== undefined ||
    dateRange.to !== undefined ||
    selectedType !== "all";

  if (isLoading || showSkeleton) {
    return (
      <div className="space-y-6">
        <ImageFilters
          dateRange={dateRange}
          setDateRange={setDateRange}
          selectedType={selectedType}
          setSelectedType={setSelectedType}
          onClear={handleClearFilters}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array(8)
            .fill(0)
            .map((_, i) => (
              <ImageCardSkeleton key={i} />
            ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <p className="text-lg font-medium text-destructive mb-2">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="text-sm text-primary hover:underline"
        >
          Try again
        </button>
      </div>
    );
  }

  if (images.length === 0) {
    // If filters are active, show different message but keep filters
    if (hasActiveFilters) {
      return (
        <div className="space-y-6">
          <ImageFilters
            dateRange={dateRange}
            setDateRange={setDateRange}
            selectedType={selectedType}
            setSelectedType={setSelectedType}
            onClear={handleClearFilters}
          />
          <div className="flex items-center justify-center h-[50vh] w-full">
            <Card className="w-full h-full bg-muted/30 flex items-center justify-center">
              <CardContent className="flex flex-col items-center justify-center text-center p-8 space-y-4 max-w-md">
                <FilterX className="h-12 w-12 text-muted-foreground/60" />
                <h3 className="text-lg font-medium">
                  No images match your filters
                </h3>
                <p className="text-muted-foreground text-sm">
                  Try adjusting your filter criteria or clear all filters
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      );
    }

    // Original empty state for when there are no images at all
    return (
      <div className="flex items-center justify-center h-[70vh] w-full">
        <Card className="w-full h-full bg-muted/30 flex items-center justify-center">
          <CardContent className="flex flex-col items-center justify-center text-center p-8 space-y-4 max-w-md">
            {isUploading ? (
              <>
                <Loader2 className="h-16 w-16 text-muted-foreground/60 animate-spin" />
                <h3 className="text-lg font-medium">Uploading your image...</h3>
                <p className="text-muted-foreground text-sm">
                  Your image will appear here once uploaded
                </p>
              </>
            ) : (
              <>
                <ImageIcon className="h-16 w-16 text-muted-foreground/60" />
                <h3 className="text-lg font-medium">No images found</h3>
                <p className="text-muted-foreground text-sm">
                  Images will appear here after uploading
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ImageFilters
        dateRange={dateRange}
        setDateRange={setDateRange}
        selectedType={selectedType}
        setSelectedType={setSelectedType}
        onClear={handleClearFilters}
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {images.map((image) => (
          <ImageCard
            key={image.id}
            image={image}
            onTogglePrivacy={(isPrivate) => {
              setSelectedImage(image);
              setIsPrivacyDialogOpen(true);
            }}
            onDelete={() => {
              setSelectedImage(image);
              setIsDeleteDialogOpen(true);
            }}
          />
        ))}
      </div>

      <PrivacyDialog
        open={isPrivacyDialogOpen}
        onOpenChange={setIsPrivacyDialogOpen}
        isPrivate={selectedImage?.isPrivate ?? false}
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

export default ImageGrid;
