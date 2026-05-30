import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  adminListMessageReports,
  adminResolveMessageReport,
  REPORT_STATUS_LABELS,
  type MessageReport,
  type MessageReportStatus,
} from "@/lib/messageReports";
import { Flag, Loader2, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/card";

export default function MessageReportsAdmin() {
  const { toast } = useToast();
  const [rows, setRows] = useState<MessageReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<MessageReportStatus | "all">("pending");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    try {
      const list = await adminListMessageReports(
        filter === "all" ? null : filter
      );
      setRows(list);
    } catch (err: unknown) {
      toast({
        title: "Failed to load reports",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [filter]);

  const resolve = async (id: string, status: MessageReportStatus) => {
    setBusyId(id);
    try {
      await adminResolveMessageReport(id, status, notes[id]);
      toast({ title: "Report updated", description: `Marked as ${REPORT_STATUS_LABELS[status]}.` });
      await load();
    } catch (err: unknown) {
      toast({
        title: "Update failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Flag className="w-6 h-6 text-amber-400" />
            Message Reports
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Review user-reported conversations and messages.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={filter}
            onValueChange={(v) => setFilter(v as MessageReportStatus | "all")}
          >
            <SelectTrigger className="w-[160px] bg-slate-900 border-slate-700">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {(Object.keys(REPORT_STATUS_LABELS) as MessageReportStatus[]).map(
                (s) => (
                  <SelectItem key={s} value={s}>
                    {REPORT_STATUS_LABELS[s]}
                  </SelectItem>
                )
              )}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => void load()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-sky-400" />
        </div>
      ) : rows.length === 0 ? (
        <Card className="p-8 bg-slate-900/50 border-slate-700 text-center text-slate-400">
          No reports found for this filter.
        </Card>
      ) : (
        <div className="space-y-4">
          {rows.map((r) => (
            <Card
              key={r.id}
              className="p-4 bg-slate-900/60 border-slate-700 space-y-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-100">{r.reason}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {new Date(r.created_at).toLocaleString()} · Status:{" "}
                    {REPORT_STATUS_LABELS[r.status]}
                  </p>
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-2 text-sm">
                <p>
                  <span className="text-slate-500">Reporter:</span>{" "}
                  {r.reporter_email || r.reporter_user_id}
                </p>
                <p>
                  <span className="text-slate-500">Reported:</span>{" "}
                  {r.reported_email || r.reported_user_id}
                </p>
              </div>
              {r.details && (
                <p className="text-sm text-slate-300 bg-slate-950/50 rounded p-2">
                  {r.details}
                </p>
              )}
              <p className="text-xs text-slate-500 font-mono break-all">
                {r.message_id
                  ? `Message: ${r.message_id}`
                  : r.thread_id
                    ? `Thread: ${r.thread_id}`
                    : null}
              </p>
              {r.admin_notes && (
                <p className="text-xs text-slate-400">
                  Admin notes: {r.admin_notes}
                </p>
              )}
              <Textarea
                placeholder="Admin notes (optional)"
                value={notes[r.id] ?? ""}
                onChange={(e) =>
                  setNotes((prev) => ({ ...prev, [r.id]: e.target.value }))
                }
                rows={2}
                className="bg-slate-950 border-slate-700 text-sm"
              />
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    "reviewed",
                    "action_taken",
                    "dismissed",
                  ] as MessageReportStatus[]
                ).map((status) => (
                  <Button
                    key={status}
                    size="sm"
                    variant={status === "action_taken" ? "destructive" : "outline"}
                    disabled={busyId === r.id}
                    onClick={() => void resolve(r.id, status)}
                  >
                    {busyId === r.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      REPORT_STATUS_LABELS[status]
                    )}
                  </Button>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
