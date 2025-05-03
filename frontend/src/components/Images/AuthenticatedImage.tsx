import React, { useState, useEffect, useRef } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/AuthContext";
import { getAuthHeaders } from "@/services/api";

interface AuthenticatedImageProps
  extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
}

const AuthenticatedImage = ({ src, ...props }: AuthenticatedImageProps) => {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    let isMounted = true;

    const loadImage = async () => {
      if (!isAuthenticated) {
        setError("Authentication required");
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch(src, {
          headers: getAuthHeaders(),
          credentials: "include",
        });

        if (!response.ok) {
          throw new Error(
            `Failed to load image: ${response.status} ${response.statusText}`
          );
        }

        const blob = await response.blob();
        if (!isMounted) return;

        // Revoke the old object URL if it exists
        if (objectUrlRef.current) {
          URL.revokeObjectURL(objectUrlRef.current);
        }

        // Create and store the new object URL
        const newObjectUrl = URL.createObjectURL(blob);
        objectUrlRef.current = newObjectUrl;
        setImageSrc(newObjectUrl);
        setError(null);
      } catch (error) {
        if (!isMounted) return;
        console.error("Error loading image:", error);
        setError(
          error instanceof Error ? error.message : "Failed to load image"
        );
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    // Only fetch if src is a proxy URL
    if (src && src.startsWith("/api/proxy/")) {
      loadImage();
    } else if (src) {
      // If it's not a proxy URL, use it directly (e.g., for temp blob URLs during upload)
      setImageSrc(src);
      setIsLoading(false);
    } else {
      // No src provided
      setError("No image source");
      setIsLoading(false);
    }

    // Cleanup function
    return () => {
      isMounted = false;
      // Revoke the object URL when the component unmounts or src changes
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, [src, isAuthenticated]); // Add isAuthenticated to dependencies

  if (isLoading) {
    return <Skeleton className="w-full h-full min-h-[200px] rounded-lg" />;
  }

  if (error) {
    return (
      <div className="w-full h-full min-h-[200px] rounded-lg bg-muted flex items-center justify-center">
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  if (!imageSrc) {
    return null;
  }

  return <img src={imageSrc} {...props} />;
};

export default AuthenticatedImage;
