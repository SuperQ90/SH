import * as React from "react";
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
import { Flag, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  REPORT_REASONS,
  submitConversationReport,
  submitMessageReport,
} from "@/lib/messageReports";

type ReportConversationDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  threadId: string;
  reportedName: string;
  messageId?: string | null;
};

export default function ReportConversationDialog({
  open,
  onOpenChange,
  threadId,
  reportedName,
  messageId,
}: ReportConversationDialogProps) {
  const { toast } = useToast();
  const [reason, setReason] = React.useState<string>(REPORT_REASONS[0]);
  const [details, setDetails] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setReason(REPORT_REASONS[0]);
    setDetails("");
  }, [open]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      if (messageId) {
        await submitMessageReport(messageId, reason, details || undefined);
      } else {
        await submitConversationReport(threadId, reason, details || undefined);
      }
      toast({
        title: "Report submitted",
        description: "Our team will review this conversation.",
      });
      onOpenChange(false);
    } catch (err: unknown) {
      toast({
        title: "Could not submit report",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[92vw] max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flag className="w-5 h-5 text-amber-400" />
            Report {reportedName}
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground -mt-2">
          {messageId
            ? "Report this message for moderation review."
            : "Report inappropriate behavior in this conversation."}
        </p>
        <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
          <div>
            <Label>Reason</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REPORT_REASONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="report-details">Additional details (optional)</Label>
            <Textarea
              id="report-details"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder="What happened?"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting} variant="destructive">
              {submitting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : null}
              Submit report
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
