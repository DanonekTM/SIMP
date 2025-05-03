import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff } from "lucide-react";

interface PrivacyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (isPrivate: boolean, password?: string) => void;
  isPrivate: boolean;
}

const PrivacyDialog = ({
  open,
  onOpenChange,
  onConfirm,
  isPrivate,
}: PrivacyDialogProps) => {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const { toast } = useToast();

  // Reset password state when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setPassword("");
      setShowPassword(false);
    }
  }, [open]);

  const handleConfirm = () => {
    if (!isPrivate) {
      // If making private, require password
      if (!password) {
        toast({
          title: "Error",
          description: "Please enter a password for private access",
          variant: "destructive",
        });
        return;
      }
      onConfirm(true, password);
    } else {
      // If making public, no password needed
      onConfirm(false);
    }
    onOpenChange(false);
  };

  const togglePasswordVisibility = () => {
    setShowPassword((prev) => !prev);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isPrivate ? "Make Image Public" : "Make Image Private"}
          </DialogTitle>
          <DialogDescription>
            {isPrivate
              ? "Are you sure you want to make this image public?"
              : "Set a password to make this image private."}
          </DialogDescription>
        </DialogHeader>
        {!isPrivate && (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password for private access"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
                  onClick={togglePasswordVisibility}
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm}>
            {isPrivate ? "Make Public" : "Make Private"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PrivacyDialog;
