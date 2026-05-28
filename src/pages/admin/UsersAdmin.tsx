// src/pages/admin/UsersAdmin.tsx
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

type AdminUserRow = {
  id: string;
  email: string | null;
  display_name: string | null;
  username: string | null;
  role: string | null;
  subscription_status: string | null;
  subscription_plan: string | null;
  is_grandfathered: boolean | null;
  plan_song_limit: number | null;
  created_at: string | null;
  last_sign_in_at: string | null;
  songs_uploaded: number | null;
};

const ROLE_OPTIONS = ["free", "paid", "admin"] as const;

export default function UsersAdmin() {
  const { toast } = useToast();
  const [rows, setRows] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // local edits for song limits
  const [limits, setLimits] = useState<Record<string, string>>({});

  // get current auth user so we can block self-demote
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setCurrentUserId(data.user?.id ?? null);
    })();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    setErrorMsg(null);
    const { data, error } = await supabase.rpc("admin_list_users");
    if (error) {
      console.error("admin_list_users error", error);
      setErrorMsg(error.message ?? "Failed to load users");
      setRows([]);
      setLoading(false);
      return;
    }
    const list = (data as AdminUserRow[]) ?? [];
    setRows(list);
    // sync local limits
    const nextLimits: Record<string, string> = {};
    list.forEach((u) => {
      nextLimits[u.id] =
        u.plan_song_limit !== null && u.plan_song_limit !== undefined
          ? String(u.plan_song_limit)
          : "";
    });
    setLimits(nextLimits);
    setLoading(false);
  };

  useEffect(() => {
    void loadUsers();
  }, []);

  const handleChangeRole = async (user: AdminUserRow, newRole: string) => {
    // 1) block self-demote
    if (currentUserId && user.id === currentUserId && newRole !== "admin") {
      toast({
        title: "Blocked",
        description: "You cannot remove your own admin role from here.",
        variant: "destructive",
      });
      return;
    }

    // 2) if we are demoting another admin → confirm
    if ((user.role === "admin" || user.role === "Admin") && newRole !== "admin") {
      const ok = window.confirm(
        `This user is currently an admin. Do you really want to change their role to "${newRole}"?`
      );
      if (!ok) return;
    }

    setLoadingAction(`role-${user.id}`);
    const { error } = await supabase.rpc("admin_set_user_role", {
      p_user_id: user.id,
      p_role: newRole,
    });
    if (error) {
      console.error("admin_set_user_role error", error);
      toast({
        title: "Failed to change role",
        description: error.message,
        variant: "destructive",
      });
      setLoadingAction(null);
      return;
    }
    toast({ title: "Role updated" });
    await loadUsers();
    setLoadingAction(null);
  };

  const handleToggleGrandfathered = async (user: AdminUserRow) => {
    const newVal = !user.is_grandfathered;
    setLoadingAction(`grand-${user.id}`);
    const { error } = await supabase.rpc("admin_set_grandfathered", {
      p_user_id: user.id,
      p_value: newVal,
    });
    if (error) {
      console.error("admin_set_grandfathered error", error);
      toast({
        title: "Failed to update grandfathered",
        description: error.message,
        variant: "destructive",
      });
      setLoadingAction(null);
      return;
    }
    toast({
      title: newVal ? "Marked as legacy/grandfathered" : "Legacy removed",
    });
    await loadUsers();
    setLoadingAction(null);
  };

  const handleSaveLimit = async (user: AdminUserRow) => {
    const raw = limits[user.id] ?? "";
    const parsed = raw.trim() === "" ? null : Number(raw);
    if (parsed !== null && Number.isNaN(parsed)) {
      toast({
        title: "Invalid number",
        description: "Please enter a valid integer",
        variant: "destructive",
      });
      return;
    }
    setLoadingAction(`limit-${user.id}`);
    const { error } = await supabase.rpc("admin_set_plan_song_limit", {
      p_user_id: user.id,
      p_limit: parsed,
    });
    if (error) {
      console.error("admin_set_plan_song_limit error", error);
      toast({
        title: "Failed to update limit",
        description: error.message,
        variant: "destructive",
      });
      setLoadingAction(null);
      return;
    }
    toast({ title: "Song limit updated" });
    await loadUsers();
    setLoadingAction(null);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3">
        <h2 className="text-lg font-semibold">Users</h2>
        <Button variant="outline" size="sm" onClick={() => void loadUsers()}>
          Refresh
        </Button>
      </div>

      {loading ? (
        <p className="text-slate-300">Loading…</p>
      ) : errorMsg ? (
        <div className="p-3 bg-red-950/40 border border-red-500/40 rounded text-sm text-red-100">
          {errorMsg}
        </div>
      ) : rows.length === 0 ? (
        <p className="text-slate-400 text-sm">No users found.</p>
      ) : (
        <div className="border border-slate-800 rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-900">
              <tr>
                <th className="text-left px-4 py-2">Email</th>
                <th className="text-left px-4 py-2">Name</th>
                <th className="text-left px-4 py-2">Role</th>
                <th className="text-left px-4 py-2">Plan</th>
                <th className="text-left px-4 py-2">Legacy</th>
                <th className="text-left px-4 py-2">Song limit</th>
                <th className="text-left px-4 py-2">Songs</th>
                <th className="text-left px-4 py-2">Created</th>
                <th className="text-left px-4 py-2">Last sign-in</th>
                <th className="text-left px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => {
                const isSelf = currentUserId && u.id === currentUserId;
                return (
                  <tr key={u.id} className="border-t border-slate-800">
                    <td className="px-4 py-2">
                      <div className="flex flex-col">
                        <span>{u.email ?? "—"}</span>
                        {isSelf && (
                          <span className="text-[0.6rem] text-amber-300">you</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      {u.display_name || u.username || u.email || "—"}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex gap-1 flex-wrap">
                        {ROLE_OPTIONS.map((r) => (
                          <Button
                            key={r}
                            variant={u.role === r ? "default" : "outline"}
                            size="xs"
                            disabled={loadingAction === `role-${u.id}`}
                            onClick={() => handleChangeRole(u, r)}
                          >
                            {r}
                          </Button>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-slate-200">
                          status: {u.subscription_status ?? "—"}
                        </span>
                        <span className="text-xs text-slate-400">
                          plan: {u.subscription_plan ?? "—"}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <Button
                        variant={u.is_grandfathered ? "default" : "outline"}
                        size="xs"
                        disabled={loadingAction === `grand-${u.id}`}
                        onClick={() => handleToggleGrandfathered(u)}
                      >
                        {u.is_grandfathered ? "Yes" : "No"}
                      </Button>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex gap-2 items-center">
                        <Input
                          className="w-20 h-7 text-xs"
                          value={limits[u.id] ?? ""}
                          onChange={(e) =>
                            setLimits((prev) => ({ ...prev, [u.id]: e.target.value }))
                          }
                        />
                        <Button
                          size="xs"
                          disabled={loadingAction === `limit-${u.id}`}
                          onClick={() => handleSaveLimit(u)}
                        >
                          Save
                        </Button>
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      {u.songs_uploaded ?? 0}
                    </td>
                    <td className="px-4 py-2">
                      {u.created_at
                        ? new Date(u.created_at).toLocaleString()
                        : "—"}
                    </td>
                    <td className="px-4 py-2">
                      {u.last_sign_in_at
                        ? new Date(u.last_sign_in_at).toLocaleString()
                        : "—"}
                    </td>
                    <td className="px-4 py-2 text-xs text-slate-400">
                      {/* room for future actions */}
                      —
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
