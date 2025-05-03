import { ThemeProvider } from "@/context/ThemeContext";
import { AuthProvider } from "@/context/AuthContext";
import { Toaster } from "@/components/ui/toaster";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getPageTitle } from "@/lib/seo";
import { useEffect, lazy, Suspense } from "react";
import { useAuth } from "@/context/AuthContext";

// Layouts
import MainLayout from "@/components/Layout/MainLayout";

// Pages - Use lazy loading for code splitting
const Login = lazy(() => import("@/pages/Login"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Images = lazy(() => import("@/pages/Images"));
const ImageDetails = lazy(() => import("@/pages/ImageDetails"));
const NotFound = lazy(() => import("@/pages/NotFound"));

// Loading fallback
const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
  </div>
);

const queryClient = new QueryClient();

// Protected Route wrapper
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <LoadingFallback />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

// Public Route wrapper (accessible only when not authenticated)
const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingFallback />;
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

// Create a wrapper component to handle the base path
const AppRoutes = () => {
  const location = useLocation();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    // Set page title based on current route
    const path = location.pathname;
    if (path === "/") {
      document.title = getPageTitle(isAuthenticated ? "Dashboard" : "Login");
    } else if (path === "/dashboard") {
      document.title = getPageTitle("Dashboard");
    } else if (path === "/dashboard/images") {
      document.title = getPageTitle("Images");
    } else if (path.startsWith("/dashboard/images/")) {
      document.title = getPageTitle("Image Details");
    } else {
      document.title = getPageTitle("Error");
    }
  }, [location.pathname, isAuthenticated]);

  return (
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
        {/* Public routes (only accessible when not authenticated) */}
        <Route
          path="/"
          element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          }
        />

        {/* Protected routes (require authentication) */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="images" element={<Images />} />
          <Route path="images/:id" element={<ImageDetails />} />
        </Route>

        {/* Redirect /images to /dashboard/images */}
        <Route
          path="/images"
          element={
            <ProtectedRoute>
              <Navigate to="/dashboard/images" replace />
            </ProtectedRoute>
          }
        />
        <Route
          path="/images/:id"
          element={
            <ProtectedRoute>
              <Navigate to="/dashboard/images/:id" replace />
            </ProtectedRoute>
          }
        />

        {/* Catch all route */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter basename="/admin">
      <ThemeProvider>
        <TooltipProvider>
          <AuthProvider>
            <AppRoutes />
            <Toaster />
            <Sonner />
          </AuthProvider>
        </TooltipProvider>
      </ThemeProvider>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
