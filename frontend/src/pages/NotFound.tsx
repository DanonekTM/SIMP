import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { getPageTitle } from "@/lib/seo";
import { useEffect } from "react";

export default function NotFound() {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = getPageTitle("Page Not Found");
  }, []);

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-background">
      <div className="container flex max-w-[64rem] flex-col items-center gap-4 text-center">
        <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl md:text-6xl lg:text-7xl">
          404
        </h1>
        <p className="max-w-[42rem] leading-normal text-muted-foreground sm:text-xl sm:leading-8">
          Oops! The page you're looking for doesn't exist.
        </p>
        <Button
          onClick={() => navigate("/dashboard")}
          className="mt-4"
          size="lg"
        >
          Back to Dashboard
        </Button>
      </div>
    </div>
  );
}
