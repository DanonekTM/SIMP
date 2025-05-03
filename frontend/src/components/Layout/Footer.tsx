import React from "react";
import { useToast } from "@/components/ui/use-toast";

const Footer: React.FC = () => {
  const year = new Date().getFullYear();
  const { toast } = useToast();

  return (
    <footer className="py-4 bg-background">
      <div className="container flex justify-center items-center">
        <div className="flex items-center">
          <p className="text-sm text-muted-foreground">S.I.M.P © {year}</p>
          <button
            onClick={() => {
              toast({
                title: "About S.I.M.P",
                description: (
                  <div>
                    Running version: v1.0
                    <br />
                    GitHub:{" "}
                    <a
                      href="https://github.com/DanonekTM/SIMP"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline text-blue-500 hover:text-blue-700"
                    >
                      https://github.com/DanonekTM/SIMP
                    </a>
                  </div>
                ),
              });
            }}
            className="text-muted-foreground hover:text-foreground transition-colors ml-2"
            title="View version info"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-4 h-4"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4" />
              <path d="M12 8h.01" />
            </svg>
          </button>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
