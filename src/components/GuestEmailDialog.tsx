import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function GuestEmailDialog({
  open,
  initialEmail,
  title = "Where should we save this?",
  description = "Enter an email so we can link your ideas and prototypes back to you.",
  onSubmit,
  onOpenChange,
}: {
  open: boolean;
  initialEmail?: string | null;
  title?: string;
  description?: string;
  onSubmit: (email: string) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const [email, setEmail] = useState(initialEmail ?? "");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!isValidEmail(trimmed)) {
      toast.error("Enter a valid email address");
      return;
    }
    onSubmit(trimmed);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoFocus
            required
          />
          <Button type="submit" className="w-full">
            Continue
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
