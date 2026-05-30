import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  listHireRequestsReceived,
  listHireRequestsSent,
  updateHireRequestStatus,
  HIRE_STATUS_LABELS,
  type HireRequest,
  type HireRequestStatus,
} from "@/lib/hireRequests";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Home, Music2, RefreshCw, Loader2, Mail, Phone } from "lucide-react";

const STATUS_VARIANT: Record<
  HireRequestStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  new: "default",
  in_review: "secondary",
  accepted: "default",
  declined: "destructive",
  completed: "outline",
};

function HireRequestCard({
  request,
  mode,
  onStatusChange,
  updating,
}: {
  request: HireRequest;
  mode: "received" | "sent";
  onStatusChange?: (id: string, status: HireRequestStatus) => void;
  updating: string | null;
}) {
  return (
    <Card className="p-4 bg-black/40 border-white/10 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-white">
            {mode === "received" ? request.requester_name : "Your request"}
          </p>
          <p className="text-xs text-muted-foreground">
            {new Date(request.created_at).toLocaleString()}
          </p>
        </div>
        <Badge variant={STATUS_VARIANT[request.status]}>
          {HIRE_STATUS_LABELS[request.status]}
        </Badge>
      </div>

      <p className="text-sm text-slate-200 whitespace-pre-wrap">{request.brief}</p>

      <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
        {mode === "received" && (
          <>
            <span className="flex items-center gap-1">
              <Mail className="w-3.5 h-3.5" />
              <a
                href={`mailto:${request.requester_email}`}
                className="underline text-cyan-400 break-all"
              >
                {request.requester_email}
              </a>
            </span>
            {request.requester_phone && (
              <span className="flex items-center gap-1">
                <Phone className="w-3.5 h-3.5" />
                {request.requester_phone}
              </span>
            )}
          </>
        )}
        {request.budget && (
          <span>
            <strong className="text-slate-300">Budget:</strong> {request.budget}
          </span>
        )}
        {request.deadline && (
          <span>
            <strong className="text-slate-300">Deadline:</strong>{" "}
            {request.deadline}
          </span>
        )}
      </div>

      {mode === "received" && onStatusChange && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-xs text-muted-foreground">Update status:</span>
          <Select
            value={request.status}
            onValueChange={(v) => onStatusChange(request.id, v as HireRequestStatus)}
            disabled={updating === request.id}
          >
            <SelectTrigger className="w-[160px] h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(HIRE_STATUS_LABELS) as HireRequestStatus[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {HIRE_STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {updating === request.id && (
            <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
          )}
        </div>
      )}
    </Card>
  );
}

const HireRequests: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tab, setTab] = React.useState<"received" | "sent">("received");
  const [received, setReceived] = React.useState<HireRequest[]>([]);
  const [sent, setSent] = React.useState<HireRequest[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [updating, setUpdating] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const [rec, snt] = await Promise.all([
        listHireRequestsReceived(),
        listHireRequestsSent(),
      ]);
      setReceived(rec);
      setSent(snt);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load hire requests");
    } finally {
      setLoading(false);
    }
  }, [user]);

  React.useEffect(() => {
    if (user) void load();
    else setLoading(false);
  }, [user, load]);

  const handleStatusChange = async (id: string, status: HireRequestStatus) => {
    setUpdating(id);
    try {
      await updateHireRequestStatus(id, status);
      setReceived((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status } : r))
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to update status");
    } finally {
      setUpdating(null);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900">
        <header className="sticky top-0 z-40 bg-black/80 backdrop-blur-xl border-b border-white/10">
          <div className="container mx-auto px-4 py-4 flex items-center gap-4">
            <Button
              onClick={() => navigate("/")}
              variant="outline"
              className="border-cyan-400/50 text-cyan-400"
            >
              <Home className="w-4 h-4 mr-2" />
              Home
            </Button>
            <h1 className="text-xl font-bold text-white">Hire Requests</h1>
          </div>
        </header>
        <main className="container mx-auto px-4 py-8">
          <Card className="p-8 bg-black/40 border-white/10">
            <p className="text-gray-400">Please sign in to view hire requests.</p>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900">
      <header className="sticky top-0 z-40 bg-black/80 backdrop-blur-xl border-b border-white/10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button
              onClick={() => navigate("/")}
              variant="outline"
              className="border-cyan-400/50 text-cyan-400"
            >
              <Home className="w-4 h-4 mr-2" />
              Back
            </Button>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Music2 className="w-5 h-5 text-cyan-400" />
              Hire Requests
            </h1>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void load()}
            disabled={loading}
            className="border-cyan-400/40"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-3xl">
        {error && (
          <Card className="p-4 mb-4 border-red-500/40 bg-red-950/20">
            <p className="text-red-400 text-sm">{error}</p>
            <p className="text-xs text-gray-500 mt-2">
              Run migration{" "}
              <code className="text-cyan-400">20260528140000_hire_requests.sql</code>
            </p>
          </Card>
        )}

        <Tabs value={tab} onValueChange={(v) => setTab(v as "received" | "sent")}>
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="received">
              Received ({received.length})
            </TabsTrigger>
            <TabsTrigger value="sent">Sent ({sent.length})</TabsTrigger>
          </TabsList>

          {loading ? (
            <Card className="p-8 flex justify-center bg-black/40 border-white/10">
              <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
            </Card>
          ) : (
            <>
              <TabsContent value="received" className="space-y-4 mt-0">
                {received.length === 0 ? (
                  <Card className="p-8 text-center bg-black/40 border-white/10">
                    <p className="text-gray-400">
                      No hire requests yet. When someone clicks &quot;Want a song? Hire
                      Me&quot; on your artist page, requests appear here.
                    </p>
                  </Card>
                ) : (
                  received.map((r) => (
                    <HireRequestCard
                      key={r.id}
                      request={r}
                      mode="received"
                      onStatusChange={handleStatusChange}
                      updating={updating}
                    />
                  ))
                )}
              </TabsContent>

              <TabsContent value="sent" className="space-y-4 mt-0">
                {sent.length === 0 ? (
                  <Card className="p-8 text-center bg-black/40 border-white/10">
                    <p className="text-gray-400">
                      You have not sent any hire requests yet. Visit an artist page
                      and use &quot;Want a song? Hire Me&quot;.
                    </p>
                  </Card>
                ) : (
                  sent.map((r) => (
                    <HireRequestCard
                      key={r.id}
                      request={r}
                      mode="sent"
                      updating={null}
                    />
                  ))
                )}
              </TabsContent>
            </>
          )}
        </Tabs>
      </main>
    </div>
  );
};

export default HireRequests;
