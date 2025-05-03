import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

interface AuthGuardProps {
  children: React.ReactNode;
  requireAuth?: boolean;
}

export const AuthGuard = ({ children, requireAuth = true }: AuthGuardProps) => {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!isLoading) {
      if (requireAuth && !isAuthenticated) {
        // If auth is required but user is not authenticated, redirect to login
        navigate("/", {
          replace: true,
          state: { from: location.pathname },
        });
      } else if (!requireAuth && isAuthenticated && location.pathname === "/") {
        // If on login page and authenticated, redirect to dashboard or saved location
        const from = location.state?.from || "/dashboard";
        navigate(from, { replace: true });
      }
    }
  }, [isLoading, isAuthenticated, navigate, requireAuth, location]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
        <span className="ml-3 text-muted-foreground">Loading...</span>
      </div>
    );
  }

  // Only render children if authentication requirements are met
  if (requireAuth && !isAuthenticated) return null;
  if (!requireAuth && isAuthenticated) return null;

  return <>{children}</>;
};
