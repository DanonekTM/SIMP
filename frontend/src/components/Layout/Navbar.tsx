import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Moon, Sun, BarChart, Image, Power, Menu, X } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import React, { useState, useEffect } from "react";

const Navbar = () => {
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Prevent scrolling when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }

    return () => {
      document.body.style.overflow = "auto";
    };
  }, [isMobileMenuOpen]);

  const isActive = (path: string) => location.pathname === path;

  const linkBaseClasses =
    "text-sm font-medium transition-colors flex items-center space-x-2 py-2";
  const mobileActiveClasses = "text-primary font-semibold";
  const mobileInactiveClasses = "text-foreground/80 hover:text-primary";
  const desktopActiveClasses = "text-foreground pointer-events-none";
  const desktopInactiveClasses = "text-foreground/60 hover:text-primary";

  const handleLinkClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    path: string
  ) => {
    if (isActive(path)) {
      e.preventDefault();
    }
    // Close mobile menu when a link is clicked
    setIsMobileMenuOpen(false);
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const DesktopNavLinks = () => (
    <>
      {isActive("/dashboard") ? (
        <span
          className={`${linkBaseClasses} ${desktopActiveClasses}`}
          aria-current="page"
        >
          <BarChart className="h-4 w-4" />
          <span>Dashboard</span>
        </span>
      ) : (
        <Link
          to="/dashboard"
          className={`${linkBaseClasses} ${desktopInactiveClasses}`}
          onClick={(e) => handleLinkClick(e, "/dashboard")}
        >
          <BarChart className="h-4 w-4" />
          <span>Dashboard</span>
        </Link>
      )}

      {isActive("/dashboard/images") ? (
        <span
          className={`${linkBaseClasses} ${desktopActiveClasses}`}
          aria-current="page"
        >
          <Image className="h-4 w-4" />
          <span>Images</span>
        </span>
      ) : (
        <Link
          to="/dashboard/images"
          className={`${linkBaseClasses} ${desktopInactiveClasses}`}
          onClick={(e) => handleLinkClick(e, "/dashboard/images")}
        >
          <Image className="h-4 w-4" />
          <span>Images</span>
        </Link>
      )}
    </>
  );

  const MobileNavLinks = () => (
    <div className="flex flex-col w-full space-y-1">
      {isActive("/dashboard") ? (
        <span
          className={`text-sm font-medium flex items-center space-x-2 py-2 px-3 rounded-md ${mobileActiveClasses} w-full`}
          aria-current="page"
        >
          <BarChart className="h-4 w-4" />
          <span>Dashboard</span>
        </span>
      ) : (
        <Link
          to="/dashboard"
          className={`text-sm font-medium flex items-center space-x-2 py-2 px-3 rounded-md hover:bg-muted ${mobileInactiveClasses} w-full`}
          onClick={(e) => handleLinkClick(e, "/dashboard")}
        >
          <BarChart className="h-4 w-4" />
          <span>Dashboard</span>
        </Link>
      )}

      {isActive("/dashboard/images") ? (
        <span
          className={`text-sm font-medium flex items-center space-x-2 py-2 px-3 rounded-md ${mobileActiveClasses} w-full`}
          aria-current="page"
        >
          <Image className="h-4 w-4" />
          <span>Images</span>
        </span>
      ) : (
        <Link
          to="/dashboard/images"
          className={`text-sm font-medium flex items-center space-x-2 py-2 px-3 rounded-md hover:bg-muted ${mobileInactiveClasses} w-full`}
          onClick={(e) => handleLinkClick(e, "/dashboard/images")}
        >
          <Image className="h-4 w-4" />
          <span>Images</span>
        </Link>
      )}
    </div>
  );

  return (
    <>
      <header className="sticky top-0 z-30 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center">
            <Link
              to="/dashboard"
              onClick={(e) => handleLinkClick(e, "/dashboard")}
              className="flex items-center space-x-2"
              aria-current={isActive("/dashboard") ? "page" : undefined}
            >
              <span className="text-xl font-bold">S.I.M.P</span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-4">
            <DesktopNavLinks />
          </nav>

          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="h-9 w-9"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={logout}
              className="h-9 w-9"
              aria-label="Log out"
              title={`Log out ${user?.username || ""}`}
            >
              <Power className="h-4 w-4" />
            </Button>

            {/* Mobile Menu Button */}
            <div className="flex md:hidden items-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleMobileMenu}
                className="h-7 w-7 p-0 flex items-center justify-center hover:bg-muted"
                aria-label="Open menu"
              >
                <Menu className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-[9998] md:hidden"
          onClick={toggleMobileMenu}
          aria-hidden="true"
        />
      )}

      {/* Mobile Menu Dropdown */}
      <div
        className={`fixed top-14 right-4 z-[9999] w-64 bg-background rounded-md shadow-lg border transform transition-all duration-150 ease-in-out md:hidden origin-top ${
          isMobileMenuOpen
            ? "scale-y-100 opacity-100"
            : "scale-y-0 opacity-0 pointer-events-none"
        }`}
        style={{
          maxHeight: "calc(100vh - 5rem)",
          overflowY: "auto",
        }}
      >
        <div className="flex flex-col w-full">
          {/* Menu Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h2 className="text-base font-semibold">Navigation</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleMobileMenu}
              className="h-7 w-7 p-0 flex items-center justify-center hover:bg-muted"
              aria-label="Close menu"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Menu Content */}
          <div className="p-2">
            <MobileNavLinks />
          </div>
        </div>
      </div>
    </>
  );
};

export default Navbar;
