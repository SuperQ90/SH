// src/pages/ArtistPage.tsx
import React, { useEffect, useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import TrackList from "@/components/TrackList";
import TipArtistModal from "@/components/TipArtistModal";
import FollowArtistButton from "@/components/FollowArtistButton";
import { Track } from "@/types/music";
import { ArrowLeft, DollarSign, Music, Play, Heart } from "lucide-react";


type ArtistProfile = {
  user_id: string;
  display_name: string | null;
  artist_slug: string;
  bio: string | null;
  genres: string[] | null;
  profile_image_url: string | null;
  hero_image_url: string | null;
  additional_links: string[] | null;
};

const sanitizeLink = (v?: string | null) => {
  if (!v) return null;
  const s = v.trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  return `https://${s}`;
};

const prettyLinkLabel = (v: string) => {
  // display cleaner text on mobile while keeping href intact
  const s = v.trim();
  return s.replace(/^https?:\/\//i, "").replace(/\/$/, "");
};

const ArtistPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [artist, setArtist] = useState<ArtistProfile | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGenre, setSelectedGenre] = useState<string>("all");
  const [paymentMethods, setPaymentMethods] = useState<any>(null);
  const [showTipModal, setShowTipModal] = useState(false);
  const [totalPlays, setTotalPlays] = useState<number>(0);
  const [totalLikes, setTotalLikes] = useState<number>(0);

  useEffect(() => {
    let ok = true;
    (async () => {
      setLoading(true);
      setSelectedGenre("all");
      setTotalPlays(0);
      setTotalLikes(0);

      // profile by slug (public view)
      const { data: prof, error: pErr } = await supabase
        .from("artist_public_profiles")
        .select("*")
        .eq("artist_slug", (slug || "").toLowerCase())
        .maybeSingle();

      if (pErr || !prof) {
        if (ok) {
          setArtist(null);
          setTracks([]);
          setPaymentMethods(null);
          setLoading(false);
        }
        return;
      }

      if (!ok) return;
      setArtist(prof as ArtistProfile);

      // songs for this user — include likes_count for totals
      const { data: songs } = await supabase
        .from("songs")
        .select(
          "id,title,artist,genre,audio_url,user_id,duration,created_at,brand_url,image_url,cover_url,purchase_url,likes_count"
        )
        .eq("user_id", (prof as any).user_id)
        .not("audio_url", "is", null)
        .neq("audio_url", "")
        .order("created_at", { ascending: false });

      const songsList = songs ?? [];

      // Compute total likes from likes_count column
      const likesTotal = songsList.reduce(
        (sum: number, s: any) => sum + (Number(s.likes_count) || 0),
        0
      );

      // Fetch play counts from song_play_stats view
      const songIds = songsList.map((s: any) => s.id);
      let playsTotal = 0;
      if (songIds.length > 0) {
        const { data: playData } = await supabase
          .from("song_play_stats")
          .select("song_id, play_count")
          .in("song_id", songIds);

        playsTotal = (playData ?? []).reduce(
          (sum: number, r: any) => sum + (Number(r.play_count) || 0),
          0
        );
      }

      const mapped: Track[] = songsList.map((s: any) => ({
        id: s.id,
        title: s.title,
        artist: s.artist,
        genre: s.genre,
        duration: s.duration || 0,
        url: s.audio_url,
        user_id: s.user_id,
        brand_url: s.brand_url,
        image_url: s.image_url || s.cover_url || "/placeholder.svg",
        purchase_url: s.purchase_url,
        created_at: s.created_at ?? undefined,
        likes_count: s.likes_count ?? 0,
      }));

      if (!ok) return;
      setTracks(mapped);
      setTotalLikes(likesTotal);
      setTotalPlays(playsTotal);

      // Load payment methods for this artist
      const { data: paymentData } = await supabase
        .from("payment_methods")
        .select("*")
        .eq("user_id", (prof as any).user_id)
        .maybeSingle();

      if (!ok) return;
      setPaymentMethods(paymentData ?? null);

      setLoading(false);
    })();

    return () => {
      ok = false;
    };
  }, [slug]);


  // Dummy handler for onPlayTrack - now handled by inline player in TrackList
  const handlePlayTrack = (t: Track) => {
    // No-op: playback is now handled by InlineAudioPlayer in TrackList
  };

  // unique genres
  const availableGenres = useMemo(() => {
    const genreSet = new Set<string>();
    tracks.forEach((track) => {
      if (track.genre) genreSet.add(track.genre);
    });
    return Array.from(genreSet).sort();
  }, [tracks]);

  // filtered list
  const filteredTracks = useMemo(() => {
    if (selectedGenre === "all") return tracks;
    return tracks.filter((track) => track.genre === selectedGenre);
  }, [tracks, selectedGenre]);

  if (loading) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <Card className="p-6">Loading…</Card>
      </div>
    );
  }

  if (!artist) {
    return (
      <div className="p-6 max-w-6xl mx-auto space-y-4">
        <Card className="p-6">
          <p className="font-semibold">Artist not found.</p>
          <p className="text-sm text-muted-foreground mt-1">
            The page you're looking for doesn't exist.
          </p>
          <Button asChild className="mt-4">
            <Link to="/">Go Home</Link>
          </Button>
        </Card>
      </div>
    );
  }

  const genres = artist.genres || [];
  const profileSrc = artist.profile_image_url || "/placeholder.svg";

  return (
    <div className="min-h-screen bg-background relative">
      {/* Home button */}
      <div className="absolute z-20 top-2 left-2 sm:top-3 sm:left-3">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="border border-cyan-400/30 bg-black/40 hover:bg-black/60 text-cyan-200 shadow-[0_0_12px_rgba(34,211,238,0.25)] backdrop-blur"
          aria-label="Go to Home"
        >
          <Link to="/">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Home
          </Link>
        </Button>
      </div>

      {/* Hero */}
      <section className="relative w-full overflow-hidden">
        <div
          className="absolute inset-0 bg-center bg-cover"
          style={
            artist.hero_image_url
              ? { backgroundImage: `url(${artist.hero_image_url})` }
              : undefined
          }
        />
        {!artist.hero_image_url && (
          <div className="absolute inset-0 bg-gradient-to-r from-slate-800 to-slate-900" />
        )}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-28"
          style={{
            backgroundImage:
              "linear-gradient(to bottom, rgba(0,0,0,0), hsl(var(--background)))",
          }}
        />
        {/* shorter on mobile */}
        <div className="relative h-44 sm:h-56 md:h-72" />
      </section>

      {/* Profile card */}
      <div className="max-w-6xl mx-auto px-3 sm:px-4">
        <Card
          className={[
            "relative z-10 shadow-lg",
            "-mt-10 sm:-mt-12 md:-mt-16",
            "p-4 sm:p-5 md:p-6",
            // IMPORTANT: add top padding on mobile to make room for the overlaid avatar
            "pt-24 sm:pt-5 md:pt-6",
          ].join(" ")}
        >
          <div className="flex flex-col sm:flex-row sm:items-start gap-4">
            {/* Avatar:
                - On mobile: absolute, centered, overlapping hero
                - On sm+: normal flow at left, like desktop layout
            */}
            <div
              className={[
                "absolute -top-20 left-1/2 -translate-x-1/2",
                "sm:static sm:translate-x-0 sm:left-auto sm:top-auto",
                "sm:shrink-0",
                "flex justify-center",
              ].join(" ")}
            >
              <img
                src={profileSrc}
                alt={artist.display_name || artist.artist_slug}
                className={[
                  // bigger on mobile
                  "w-40 h-40",
                  // smaller / normal on larger screens
                  "sm:w-24 sm:h-24",
                  "md:w-32 md:h-32",
                  // circle on mobile, keep your existing rounded square on desktop
                  "rounded-full sm:rounded-lg",
                  "object-cover",
                  // border to separate from hero/card
                  "border-4 border-background",
                  "shadow-xl",
                ].join(" ")}
              />
            </div>

            <div className="flex-1 min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold text-center sm:text-left break-words">
                {artist.display_name || artist.artist_slug}
              </h1>

              {!!genres.length && (
                <div className="mt-2 flex flex-wrap gap-2 justify-center sm:justify-start">
                  {genres.map((g) => (
                    <Badge key={g} variant="secondary" className="max-w-full">
                      <span className="truncate">{g}</span>
                    </Badge>
                  ))}
                </div>
              )}

              {artist.bio && (
                <p className="mt-3 text-sm sm:text-base text-muted-foreground leading-relaxed whitespace-pre-wrap">
                  {artist.bio}
                </p>
              )}

              <div className="mt-3 space-y-2">
                {(artist.additional_links || [])
                  .filter(Boolean)
                  .slice(0, 3)
                  .map((v, i) => {
                    const href = sanitizeLink(v);
                    if (!href) return null;
                    return (
                      <a
                        key={`${v}-${i}`}
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-sm underline text-primary break-all sm:break-words"
                        title={v}
                      >
                        {prettyLinkLabel(v)}
                      </a>
                    );
                  })}
              </div>

              {/* Follow + Tip */}
              <div className="mt-4 flex flex-col sm:flex-row sm:flex-wrap gap-3">
                <FollowArtistButton artistUserId={artist.user_id} />
                <Button
                  onClick={() => setShowTipModal(true)}
                  className="w-full sm:w-auto bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white"
                >
                  <DollarSign className="w-4 h-4 mr-2" />
                  Tip Artist
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Songs */}
      <div className="max-w-6xl mx-auto px-3 sm:px-4 mt-6 sm:mt-8 md:mt-10 pb-16">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div className="flex items-center gap-4 flex-wrap">
            <h2 className="text-xl font-semibold">Songs</h2>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1 text-sm text-cyan-300" title="Total Songs">
                <Music className="w-4 h-4 text-cyan-400" />
                <span className="font-semibold">{tracks.length}</span>
              </span>
              <span className="flex items-center gap-1 text-sm text-cyan-300" title="Total Plays">
                <Play className="w-4 h-4 text-cyan-400" />
                <span className="font-semibold">{totalPlays.toLocaleString()}</span>
              </span>
              <span className="flex items-center gap-1 text-sm text-pink-300" title="Total Likes">
                <Heart className="w-4 h-4 text-pink-400" />
                <span className="font-semibold">{totalLikes.toLocaleString()}</span>
              </span>
            </div>
          </div>


          {availableGenres.length > 0 && (
            <div className="w-full sm:w-[220px]">
              <Select value={selectedGenre} onValueChange={setSelectedGenre}>
                <SelectTrigger className="w-full border-cyan-400/30 bg-black/40 text-cyan-200 shadow-[0_0_8px_rgba(34,211,238,0.15)]">
                  <SelectValue placeholder="Filter by genre" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Genres</SelectItem>
                  {availableGenres.map((genre) => (
                    <SelectItem key={genre} value={genre}>
                      {genre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {tracks.length === 0 ? (
          <Card className="p-6">
            <p className="text-muted-foreground">No songs yet.</p>
          </Card>
        ) : filteredTracks.length === 0 ? (
          <Card className="p-6">
            <p className="text-muted-foreground">
              No songs found for the selected genre.
            </p>
          </Card>
        ) : (
          <TrackList
            tracks={filteredTracks}
            likedTracks={[]}
            currentTrack={null}
            onPlayTrack={handlePlayTrack}
            onLikeTrack={() => {}}
            onTrackDeleted={() => {}}
            onArtistClick={() => {}}
            hideArtistPageButton={true}
          />
        )}
      </div>

      {/* Tip Artist Modal */}
      <TipArtistModal
        isOpen={showTipModal}
        onClose={() => setShowTipModal(false)}
        artistName={artist?.display_name || artist?.artist_slug || "this artist"}
        paymentMethods={paymentMethods}
      />
    </div>
  );
};

export default ArtistPage;
