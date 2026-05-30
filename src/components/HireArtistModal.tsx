import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Music2, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { submitHireRequest } from "@/lib/hireRequests";

interface HireArtistModalProps {
  isOpen: boolean;
  onClose: () => void;
  artistUserId: string;
  artistName: string;
  onSignInRequired?: () => void;
}

const HireArtistModal: React.FC<HireArtistModalProps> = ({
  isOpen,
  onClose,
  artistUserId,
  artistName,
  onSignInRequired,
}) => {
  const { user, profile } = useAuth();
  const { toast } = useToast();

  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [brief, setBrief] = React.useState("");
  const [budget, setBudget] = React.useState("");
  const [deadline, setDeadline] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!isOpen) return;
    setName(profile?.display_name?.trim() || "");
    setEmail(user?.email || profile?.email || "");
    setPhone("");
    setBrief("");
    setBudget("");
    setDeadline("");
  }, [isOpen, user?.email, profile?.display_name, profile?.email]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast({
        title: "Please sign in",
        description: "You need an account to send a hire request.",
      });
      onSignInRequired?.();
      return;
    }

    if (submitting) return;
    setSubmitting(true);

    try {
      const id = await submitHireRequest({
        artistUserId,
        requesterName: name,
        requesterEmail: email,
        requesterPhone: phone || undefined,
        brief,
        budget: budget || undefined,
        deadline: deadline || undefined,
      });

      toast({
        title: "Request sent",
        description: `${artistName} has been notified about your song request.`,
      });
      onClose();
      void id;
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Could not send hire request";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="w-[92vw] max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-left">
            <Music2 className="h-5 w-5 text-cyan-400 shrink-0" />
            <span>Want a song? Hire {artistName}</span>
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground -mt-2">
          Tell the artist what you need. They will receive a notification with your
          contact details and project brief.
        </p>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div>
            <Label htmlFor="hire-name">Your name *</Label>
            <Input
              id="hire-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={120}
              disabled={!user || submitting}
            />
          </div>

          <div>
            <Label htmlFor="hire-email">Email *</Label>
            <Input
              id="hire-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              maxLength={254}
              disabled={!user || submitting}
            />
          </div>

          <div>
            <Label htmlFor="hire-phone">Phone (optional)</Label>
            <Input
              id="hire-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              maxLength={40}
              placeholder="For the artist to reach you"
              disabled={!user || submitting}
            />
          </div>

          <div>
            <Label htmlFor="hire-brief">What song do you want? *</Label>
            <Textarea
              id="hire-brief"
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              required
              minLength={10}
              maxLength={2000}
              rows={4}
              placeholder="Genre, mood, lyrics theme, length, references…"
              disabled={!user || submitting}
            />
            <p className="text-xs text-muted-foreground mt-1">{brief.length}/2000</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="hire-budget">Budget (optional)</Label>
              <Input
                id="hire-budget"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                maxLength={100}
                placeholder="e.g. $50–100"
                disabled={!user || submitting}
              />
            </div>
            <div>
              <Label htmlFor="hire-deadline">Deadline (optional)</Label>
              <Input
                id="hire-deadline"
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                disabled={!user || submitting}
              />
            </div>
          </div>

          {!user && (
            <p className="text-sm text-amber-200/90">
              Sign in to send this request to the artist.
            </p>
          )}

          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!user || submitting}
              className="bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending…
                </>
              ) : (
                "Send hire request"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default HireArtistModal;
