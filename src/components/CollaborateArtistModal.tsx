import * as React from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Handshake, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  getOrCreateMessageThread,
  sendMessage,
  canMessageUser,
} from "@/lib/messages";
import {
  COLLABORATION_TEMPLATES,
  type CollaborationTemplate,
} from "@/lib/collaborationTemplates";

interface CollaborateArtistModalProps {
  isOpen: boolean;
  onClose: () => void;
  artistUserId: string;
  artistName: string;
  onSignInRequired?: () => void;
}

const CollaborateArtistModal: React.FC<CollaborateArtistModalProps> = ({
  isOpen,
  onClose,
  artistUserId,
  artistName,
  onSignInRequired,
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [templateId, setTemplateId] = React.useState(
    COLLABORATION_TEMPLATES[0].id
  );
  const [message, setMessage] = React.useState(
    COLLABORATION_TEMPLATES[0].body
  );
  const [submitting, setSubmitting] = React.useState(false);

  const selectedTemplate = React.useMemo(
    () =>
      COLLABORATION_TEMPLATES.find((t) => t.id === templateId) ??
      COLLABORATION_TEMPLATES[0],
    [templateId]
  );

  React.useEffect(() => {
    if (!isOpen) return;
    setTemplateId(COLLABORATION_TEMPLATES[0].id);
    setMessage(COLLABORATION_TEMPLATES[0].body);
  }, [isOpen]);

  const onTemplateChange = (id: string) => {
    setTemplateId(id);
    const tpl = COLLABORATION_TEMPLATES.find((t) => t.id === id);
    if (tpl && tpl.id !== "custom") {
      setMessage(tpl.body);
    } else if (tpl?.id === "custom") {
      setMessage("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast({
        title: "Please sign in",
        description: "You need an account to start a collaboration chat.",
      });
      onSignInRequired?.();
      return;
    }

    const body = message.trim();
    if (body.length < 10) {
      toast({
        title: "Message too short",
        description: "Describe your collaboration idea (at least 10 characters).",
        variant: "destructive",
      });
      return;
    }

    if (submitting) return;
    setSubmitting(true);

    try {
      const check = await canMessageUser(artistUserId);
      if (!check.allowed) {
        throw new Error(check.reason || "You cannot message this user");
      }

      const threadId = await getOrCreateMessageThread(
        artistUserId,
        "collaboration"
      );
      await sendMessage(threadId, body);
      toast({
        title: "Collaboration chat started",
        description: `Your proposal was sent to ${artistName}.`,
      });
      onClose();
      navigate(`/messages/${threadId}`);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Could not start collaboration";
      toast({ title: "Error", description: msg, variant: "destructive" });
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
            <Handshake className="h-5 w-5 text-emerald-400 shrink-0" />
            <span>Collaborate with {artistName}</span>
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground -mt-2">
          Start a collaboration conversation. Pick a template or write your own
          pitch — it opens a dedicated chat thread.
        </p>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div>
            <Label htmlFor="collab-template">Template</Label>
            <Select value={templateId} onValueChange={onTemplateChange}>
              <SelectTrigger id="collab-template">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COLLABORATION_TEMPLATES.map((t: CollaborationTemplate) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              {selectedTemplate.description}
            </p>
          </div>

          <div>
            <Label htmlFor="collab-message">Your message *</Label>
            <Textarea
              id="collab-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
              maxLength={4000}
              placeholder="Describe your collaboration idea…"
            />
          </div>

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="bg-emerald-600 hover:bg-emerald-500"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Handshake className="w-4 h-4 mr-2" />
              )}
              Send & open chat
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CollaborateArtistModal;
