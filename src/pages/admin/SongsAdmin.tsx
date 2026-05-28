// src/pages/admin/SongsAdmin.tsx
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  RefreshCw,
  Star,
  StarOff,
  Trash2,
  Link as LinkIcon,
  Music2,
} from "lucide-react";

type RawSong = {
  id: string;               // your inserts use crypto.randomUUID()
  title: string;
  artist: string | null;
  genre: string | null;
  is_featured: boolean | null;
  created_at: string | null;
  user_id: string | null;
  duration?: number | null;
  brand_url?: string | null;
  audio_url?: string | null;
};

type ProfileRow = {
  id: string;
  user_id: string | null;
  email: string | null;
  display_name: string | null;
  role: "free" | "paid" | "admin" | "free_new" | string | null;
  subscription_status: string | null;
  subscription_plan: string | null;
};

type SongWithOwner = RawSong & {
  owner?: ProfileRow | null;
};

export default function SongsAdmin() {
  const [songs, setSongs] = useState<SongWithOwner[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  const loadSongs = useCallback(async () => {
    setLoading(true);

    // 1) pull songs
    const { data: songRows, error: songErr } = await supabase
      .from("songs")
      .select(
        "id, title, artist, genre, is_featured, created_at, user_id, duration, brand_url, audio_url"
      )
      .order("created_at", { ascending: false })
      .limit(200);

    if (songErr) {
      console.error("[admin] load songs error", songErr);
      setSongs([]);
      setLoading(false);
      return;
    }

    const rawSongs = (songRows ?? []) as RawSong[];

    // 2) gather user_ids
    const userIds = Array.from(
      new Set(
        rawSongs
          .map((s) => s.user_id)
          .filter((v): v is string => !!v)
      )
    );

    let profileMap: Record<string, ProfileRow> = {};

    if (userIds.length > 0) {
      // We query twice because your DB sometimes stores auth id in `user_id`
      // and sometimes in `id`
      const [byUserId, byId] = await Promise.all([
        supabase
          .from("profiles")
          .select(
            "id, user_id, email, display_name, role, subscription_status, subscription_plan"
          )
          .in("user_id", userIds),
        supabase
          .from("profiles")
          .select(
            "id, user_id, email, display_name, role, subscription_status, subscription_plan"
          )
          .in("id", userIds),
      ]);

      const profiles: ProfileRow[] = [
        ...(byUserId.data ?? []),
        ...(byId.data ?? []),
      ];

      for (const p of profiles) {
        const key = p.user_id ?? p.id;
        if (key) {
          profileMap[key] = p;
        }
      }
    }

    // 3) merge
    const merged: SongWithOwner[] = rawSongs.map((s) => ({
      ...s,
      owner: s.user_id ? profileMap[s.user_id] ?? null : null,
    }));

    setSongs(merged);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadSongs();
  }, [loadSongs]);

  const toggleFeatured = async (song: SongWithOwner) => {
    const next = !song.is_featured;
    const { error } = await supabase
      .from("songs")
      .update({ is_featured: next })
      .eq("id", song.id);

    if (error) {
      console.error("toggle featured error", error);
      return;
    }

    setSongs((prev) =>
      prev.map((s) => (s.id === song.id ? { ...s, is_featured: next } : s))
    );
  };

  const deleteSong = async (song: SongWithOwner) => {
    const ok = window.confirm(
      `Delete song "${song.title}" by ${song.artist || "Unknown"}? This will remove it from playlists and storage.`
    );
    if (!ok) return;

    try {
      // Single trusted call — RPC runs SECURITY DEFINER and enforces admin.
      const { error } = await supabase.rpc("admin_delete_song", {
        p_song_id: song.id,
      });

      if (error) throw error;

      // Optimistic UI update
      setSongs((prev) => prev.filter((s) => s.id !== song.id));
    } catch (err: any) {
      console.error("[admin] deleteSong error", err);
      alert(err?.message || "Delete failed");
    }
  };

  const filtered = songs.filter((s) => {
    if (!filter.trim()) return true;
    const f = filter.toLowerCase();
    const ownerEmail = s.owner?.email?.toLowerCase() ?? "";
    const ownerRole = s.owner?.role?.toLowerCase() ?? "";
    const subStatus = s.owner?.subscription_status?.toLowerCase() ?? "";
    return (
      s.title.toLowerCase().includes(f) ||
      (s.artist ?? "").toLowerCase().includes(f) ||
      (s.genre ?? "").toLowerCase().includes(f) ||
      ownerEmail.includes(f) ||
      ownerRole.includes(f) ||
      subStatus.includes(f)
    );
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Music2 className="w-5 h-5 text-sky-300" />
          Songs ({filtered.length}/{songs.length})
        </h2>
        <div className="flex gap-2">
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search title / artist / email / role..."
            className="bg-slate-900 border border-slate-700 rounded px-3 py-1 text-sm text-slate-100 w-64"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={loadSongs}
            className="gap-1"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-slate-300">Loading...</p>
      ) : filtered.length === 0 ? (
        <p className="text-slate-400 text-sm">No songs found.</p>
      ) : (
        <div className="border border-slate-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-900">
              <tr>
                <th className="text-left px-4 py-2 w-52">Song</th>
                <th className="text-left px-4 py-2">Artist</th>
                <th className="text-left px-4 py-2">Genre</th>
                <th className="text-left px-4 py-2 w-60">Owner</th>
                <th className="text-left px-4 py-2">Plan</th>
                <th className="text-left px-4 py-2">Featured</th>
                <th className="text-left px-4 py-2">Created</th>
                <th className="text-left px-4 py-2 w-28">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id} className="border-t border-slate-800">
                  <td className="px-4 py-2">
                    <div className="font-medium">{s.title}</div>
                    {s.brand_url ? (
                      <a
                        href={s.brand_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-sky-300 inline-flex items-center gap-1"
                      >
                        <LinkIcon className="w-3 h-3" />
                        brand
                      </a>
                    ) : null}
                  </td>
                  <td className="px-4 py-2">{s.artist || "—"}</td>
                  <td className="px-4 py-2">{s.genre || "—"}</td>
                  <td className="px-4 py-2">
                    {s.owner ? (
                      <div className="flex flex-col gap-0.5">
                        <span>{s.owner.display_name || s.owner.email}</span>
                        <span className="text-xs text-slate-400">
                          {s.owner.email}
                        </span>
                      </div>
                    ) : (
                      <span className="text-slate-500 text-xs">no profile</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {s.owner ? (
                      <div className="flex flex-wrap gap-1">
                        {s.owner.role ? (
                          <Badge
                            variant="outline"
                            className={
                              s.owner.role === "admin"
                                ? "border-red-500/60 text-red-200"
                                : s.owner.role === "paid"
                                ? "border-green-500/60 text-green-200"
                                : s.owner.role === "free_new"
                                ? "border-amber-500/60 text-amber-100"
                                : ""
                            }
                          >
                            {s.owner.role}
                          </Badge>
                        ) : null}
                        {s.owner.subscription_status ? (
                          <Badge variant="outline" className="text-xs">
                            {s.owner.subscription_status}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">
                            legacy
                          </Badge>
                        )}
                        {s.owner.subscription_plan ? (
                          <Badge variant="outline" className="text-xs">
                            {s.owner.subscription_plan}
                          </Badge>
                        ) : null}
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {s.is_featured ? (
                      <Badge className="bg-emerald-600/60 text-white flex items-center gap-1">
                        <Star className="w-3 h-3" /> Yes
                      </Badge>
                    ) : (
                      <span className="text-slate-400 text-xs">No</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {s.created_at
                      ? new Date(s.created_at).toLocaleString()
                      : "—"}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => toggleFeatured(s)}
                        title={s.is_featured ? "Unfeature" : "Feature"}
                      >
                        {s.is_featured ? (
                          <StarOff className="w-4 h-4" />
                        ) : (
                          <Star className="w-4 h-4" />
                        )}
                      </Button>
                      <Button
                        variant="destructive"
                        size="icon"
                        onClick={() => deleteSong(s)}
                        title="Delete song"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
