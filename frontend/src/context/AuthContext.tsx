import { createContext, useContext, useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { login, logout, verifyToken, refreshToken } from "@/services/api";
import { useNavigate, useLocation } from "react-router-dom";
import { LoginResponse } from "@/types";

interface AuthContextType {
  isAuthenticated: boolean;
  username: string | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const performLogout = () => {
    setIsAuthenticated(false);
    setUsername(null);
    if (location.pathname !== "/") {
      navigate("/");
    }
  };

  // Check authentication on mount and set up refresh interval
  useEffect(() => {
    let isMounted = true;
    let refreshInterval: NodeJS.Timeout;

    const checkAuth = async () => {
      try {
        // Skip verification if we're on the login page
        if (location.pathname === "/") {
          setIsLoading(false);
          return;
        }

        // Verify current session for all other paths
        const response = await verifyToken();
        if (isMounted) {
          if (response.username) {
            setIsAuthenticated(true);
            setUsername(response.username);
          } else {
            // Try to refresh the token
            try {
              const refreshResponse = await refreshToken();
              if (refreshResponse.success && refreshResponse.username) {
                setIsAuthenticated(true);
                setUsername(refreshResponse.username);
              } else {
                performLogout();
              }
            } catch (refreshError) {
              console.error("Auth refresh failed:", refreshError);
              performLogout();
            }
          }
        }
      } catch (verifyError) {
        if (isMounted) {
          console.error("Auth verify failed:", verifyError);
          performLogout();
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    // Set up automatic token refresh
    const setupRefreshInterval = () => {
      refreshInterval = setInterval(async () => {
        try {
          const response = await refreshToken();
          if (!response.success || !response.username) {
            throw new Error("Invalid refresh response");
          }
        } catch (error) {
          console.error("Failed to refresh token:", error);
          performLogout();
        }
      }, 14 * 60 * 1000); // 15 minutes
    };

    checkAuth();
    setupRefreshInterval();

    return () => {
      isMounted = false;
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, [navigate, location.pathname]);

  const handleLogin = async (username: string, password: string) => {
    try {
      setIsLoading(true);
      const response = await login(username, password);
      setIsAuthenticated(true);
      setUsername(response.username);
      toast({
        title: "Welcome back!",
        description: `Successfully logged in as ${response.username}`,
      });
      navigate("/dashboard");
    } catch (error) {
      console.error("Login error:", error);
      setIsAuthenticated(false);
      setUsername(null);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      setIsLoading(true);
      await logout();
      performLogout();
      toast({
        title: "Logged out",
        description: "Successfully logged out",
      });
    } catch (error) {
      console.error("Logout error:", error);
      // Still perform logout on frontend even if API call fails
      performLogout();
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const value = {
    isAuthenticated,
    username,
    isLoading,
    login: handleLogin,
    logout: handleLogout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
