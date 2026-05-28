// src/pages/admin/FeaturedAdmin.tsx
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Song = {
  id: number;
  title: string;
};

type Featured = {
  id: number;
  song_id: number;
  position: number;
  songs?: Song;
};

export default function FeaturedAdmin() {
  const [featured, setFeatured] = useState<Featured[]>([]);
  const [allSongs, setAllSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [fRes, sRes] = await Promise.all([
        supabase
          .from("featured_songs")
          .select("id, song_id, position, songs(id, title)")
          .order("position", { ascending: true }),
        supabase.from("songs").select("id, title").order("title"),
      ]);

      if (fRes.error) console.error(fRes.error);
      if (sRes.error) console.error(sRes.error);

      setFeatured((fRes.data || []) as Featured[]);
      setAllSongs((sRes.data || []) as Song[]);
      setLoading(false);
    };
    load();
  }, []);

  const addFeatured = async (songId: number) => {
    const nextPos = (featured[featured.length - 1]?.position || 0) + 1;
    const { error } = await supabase
      .from("featured_songs")
      .insert({ song_id: songId, position: nextPos });
    if (error) {
      console.error(error);
      return;
    }
    location.reload();
  };

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">Featured Songs</h2>
      {loading ? (
        <p className="text-slate-300">Loading...</p>
      ) : (
        <>
          <div className="mb-4 flex gap-2">
            <select
              className="bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm"
              onChange={(e) => {
                const v = Number(e.target.value);
                if (v) addFeatured(v);
              }}
              defaultValue=""
            >
              <option value="">Add song to featured...</option>
              {allSongs.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
          </div>
          <div className="border border-slate-800 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-900">
                <tr>
                  <th className="text-left px-4 py-2">Position</th>
                  <th className="text-left px-4 py-2">Song</th>
                </tr>
              </thead>
              <tbody>
                {featured.map((f) => (
                  <tr key={f.id} className="border-t border-slate-800">
                    <td className="px-4 py-2">{f.position}</td>
                    <td className="px-4 py-2">
                      {f.songs?.title || `Song #${f.song_id}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}