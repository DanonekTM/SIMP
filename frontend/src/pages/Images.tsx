import { useState, useEffect, lazy, Suspense } from "react";
import { Button } from "@/components/ui/button";
// Lazy load ImageGrid for better performance
const ImageGrid = lazy(() => import("@/components/Images/ImageGrid"));
import { UploadCloud } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { uploadImage, getConfig } from "@/services/api";
import { useAuth } from "@/context/AuthContext";
import { Image } from "@/types";

// Loading fallback component
const ImageGridLoading = () => (
  <div className="w-full p-8 flex justify-center">
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
    <span className="ml-3 text-muted-foreground">Loading images...</span>
  </div>
);

const Images = () => {
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [newImage, setNewImage] = useState<Image | null>(null);
  const [maxFileSize, setMaxFileSize] = useState<string>("1MB");

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const config = await getConfig();
        setMaxFileSize(config.max_file_size);
      } catch (error) {
        console.error("Failed to fetch config:", error);
      }
    };

    if (isAuthenticated) {
      fetchConfig();
    }
  }, [isAuthenticated]);

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!isAuthenticated) {
      toast({
        title: "Error",
        description: "You must be logged in to upload images",
        variant: "destructive",
      });
      return;
    }

    // Validate file type
    const validTypes = ["image/jpeg", "image/png", "image/gif"];
    if (!validTypes.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Please upload a JPEG, PNG, or GIF file.",
        variant: "destructive",
      });
      return;
    }

    // Validate file size using the config from backend
    const maxSize = parseFileSize(maxFileSize);
    if (file.size > maxSize) {
      toast({
        title: "File too large",
        description: `Please upload a file smaller than ${maxFileSize}.`,
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    try {
      // Upload the image
      const uploadedImage = await uploadImage(file);

      // Only set the new image after successful upload
      setNewImage(uploadedImage);

      toast({
        title: "Success",
        description: "Image uploaded successfully!",
      });
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: "Upload failed",
        description:
          error instanceof Error
            ? error.message
            : "Failed to upload image. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Helper function to parse file size string (e.g., "1MB" to bytes)
  const parseFileSize = (sizeStr: string): number => {
    const units: { [key: string]: number } = {
      B: 1,
      KB: 1024,
      MB: 1024 * 1024,
      GB: 1024 * 1024 * 1024,
    };
    const match = sizeStr.match(/^(\d+)([A-Z]+)$/);
    if (!match) return 1024 * 1024; // Default to 1MB if parsing fails
    const [, size, unit] = match;
    return parseInt(size) * (units[unit] || 1);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Images</h1>
          <p className="text-muted-foreground">
            Manage your hosted images and view their statistics
          </p>
        </div>
        <div className="relative">
          <input
            type="file"
            accept="image/jpeg,image/png,image/gif"
            onChange={handleFileChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            disabled={isUploading || !isAuthenticated}
          />
          <Button disabled={isUploading || !isAuthenticated}>
            <UploadCloud className="mr-2 h-4 w-4" />
            {isUploading ? "Uploading..." : "Upload New"}
          </Button>
        </div>
      </div>

      <Suspense fallback={<ImageGridLoading />}>
        <ImageGrid newImage={newImage} isUploading={isUploading} />
      </Suspense>
    </div>
  );
};

export default Images;
