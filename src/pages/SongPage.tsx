// src/pages/SongPage.tsx
import React, { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Track } from "@/types/music";
import Header from "@/components/Header";
import InlineAudioPlayer from "@/components/InlineAudioPlayer";
import LikeButton from "@/components/LikeButton";
import ShareButton from "@/components/ShareButton";
import SongComments from "@/components/SongComments";
import NewSongBadge from "@/components/NewSongBadge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { 
  ArrowLeft, 
  ExternalLink, 
  Headphones, 
  RefreshCw,
  User,
  Music
} from "lucide-react";


interface SongWithArtist extends Track {
  artist_slug?: string;
  display_name?: string;
  likes_count?: number;
}

const SongPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [song, setSong] = useState<SongWithArtist | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [artistSlug, setArtistSlug] = useState<string | null>(null);

  // Ensure brand URL is an absolute URL (add https:// if missing)
  const ensureAbsoluteUrl = (url: string): string => {
    if (!url) return url;
    const trimmed = url.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }
    return `https://${trimmed}`;
  };

  useEffect(() => {
    const fetchSong = async () => {
      if (!id) {
        setError("No song ID provided");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Fetch the song
        const { data: songData, error: songError } = await supabase
          .from("songs")
          .select("id, title, artist, genre, audio_url, cover_url, image_url, brand_url, purchase_url, duration, created_at, user_id, likes_count")
          .eq("id", id)
          .single();

        if (songError || !songData) {
          setError("Song not found");
          setLoading(false);
          return;
        }

        // Fetch artist slug if user_id exists
        if (songData.user_id) {
          const { data: artistData } = await supabase
            .from("artist_public_profiles")
            .select("artist_slug, display_name")
            .eq("user_id", songData.user_id)
            .single();

          if (artistData?.artist_slug) {
            setArtistSlug(artistData.artist_slug);
          }
        }

        const formattedSong: SongWithArtist = {
          id: songData.id,
          title: songData.title || "Unknown Title",
          artist: songData.artist || "Unknown Artist",
          genre: (songData.genre as any) || "Other",
          duration: songData.duration || 0,
          url: songData.audio_url || "",
          user_id: songData.user_id,
          brand_url: songData.brand_url,
          image_url: songData.image_url || songData.cover_url || "/placeholder.svg",
          purchase_url: songData.purchase_url,
          likes_count: (songData as any).likes_count ?? 0,
          created_at: songData.created_at ?? undefined,
        };


        setSong(formattedSong);
      } catch (err: any) {
        console.error("Error fetching song:", err);
        setError(err.message || "Failed to load song");
      } finally {
        setLoading(false);
      }
    };

    fetchSong();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-blue-900 to-black">
        <Header onSongAdded={() => {}} />
        <main className="container mx-auto px-4 py-8">
          <div className="flex flex-col items-center justify-center min-h-[60vh]">
            <RefreshCw className="w-8 h-8 animate-spin text-cyan-400 mb-4" />
            <p className="text-white text-lg">Loading song...</p>
          </div>
        </main>
      </div>
    );
  }

  if (error || !song) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-blue-900 to-black">
        <Header onSongAdded={() => {}} />
        <main className="container mx-auto px-4 py-8">
          <div className="flex flex-col items-center justify-center min-h-[60vh]">
            <Music className="w-16 h-16 text-gray-500 mb-4" />
            <h1 className="text-2xl font-bold text-white mb-2">Song Not Found</h1>
            <p className="text-gray-400 mb-6">{error || "The song you're looking for doesn't exist or has been removed."}</p>
            <Button onClick={() => navigate("/")} className="bg-cyan-500 hover:bg-cyan-600">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </div>
        </main>
      </div>
    );
  }

  const coverImage = song.image_url || "/placeholder.svg";

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-blue-900 to-black relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-400/10 via-green-400/10 to-cyan-400/10"></div>
        <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
        <div className="absolute top-3/4 right-1/4 w-1 h-1 bg-green-400 rounded-full animate-ping"></div>
        <div className="absolute top-1/2 right-1/3 w-1 h-1 bg-cyan-400 rounded-full animate-pulse"></div>
      </div>
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 via-green-400 to-cyan-400 animate-pulse"></div>

      <Header onSongAdded={() => {}} />

      <main className="container mx-auto px-4 py-8 relative z-10">
        {/* Back button */}
        <Button
          variant="ghost"
          onClick={() => navigate("/")}
          className="mb-6 text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Home
        </Button>

        {/* Song Card */}
        <Card className="max-w-3xl mx-auto bg-gradient-to-br from-slate-900/95 to-slate-800/95 border-cyan-500/30 shadow-[0_0_40px_rgba(0,212,255,0.2)] overflow-hidden">
          {/* Song Header */}
          <div className="relative">
            {/* Background blur image */}
            <div className="absolute inset-0 overflow-hidden">
              <img
                src={coverImage}
                alt=""
                className="w-full h-full object-cover blur-2xl opacity-30 scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-slate-900/50 to-slate-900"></div>
            </div>

            {/* Content */}
            <div className="relative p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row items-center gap-6">
                {/* Album Art */}
                <div className="w-48 h-48 sm:w-56 sm:h-56 rounded-xl overflow-hidden border-2 border-cyan-500/40 shadow-[0_0_30px_rgba(0,255,136,0.3)] flex-shrink-0">
                  {coverImage && coverImage !== "/placeholder.svg" ? (
                    <img
                      src={coverImage}
                      alt={song.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-500/20 to-pink-500/20">
                      <Headphones className="w-16 h-16 text-muted-foreground/50" />
                    </div>
                  )}
                </div>

                {/* Song Info */}
                <div className="flex-1 text-center sm:text-left">
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-2">
                    <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight">
                      {song.title}
                    </h1>
                    <NewSongBadge createdAt={song.created_at} />
                  </div>

                  
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-4">
                    {artistSlug ? (
                      <Link
                        to={`/artist/${artistSlug}`}
                        className="text-lg text-cyan-400 hover:text-cyan-300 transition-colors font-medium"
                      >
                        {song.artist}
                      </Link>
                    ) : (
                      <span className="text-lg text-cyan-400 font-medium">
                        {song.artist}
                      </span>
                    )}
                    
                    {song.brand_url && (
                      <a
                        href={ensureAbsoluteUrl(song.brand_url)}

                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 transition-colors"
                        title="Visit artist's page"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mb-4">
                    <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm font-semibold border border-green-500/30">
                      {song.genre}
                    </span>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center justify-center sm:justify-start gap-3">
                    <LikeButton songId={song.id} initialCount={song.likes_count || 0} />
                    <ShareButton
                      songId={song.id}
                      title={song.title}
                      artist={song.artist}
                      variant="outline"
                      size="sm"
                      className="border-cyan-500/30 hover:border-cyan-500/50"
                    />
                    {artistSlug && (
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                        className="border-purple-500/30 hover:border-purple-500/50 text-purple-400 hover:text-purple-300"
                      >
                        <Link to={`/artist/${artistSlug}`}>
                          <User className="w-4 h-4 mr-2" />
                          Artist Page
                        </Link>
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Audio Player */}
          <div className="p-6 border-t border-cyan-500/20 bg-slate-900/50">
            <InlineAudioPlayer
              audioUrl={song.url}
              title={song.title}
              artist={song.artist}
              songId={song.id}
              autoPlay={true}
            />

            {/* Comments */}
            <SongComments songId={song.id} />
          </div>

          {/* Purchase Link */}
          {song.purchase_url && (
            <div className="px-6 pb-6">
              <a
                href={song.purchase_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-semibold rounded-lg transition-all shadow-lg hover:shadow-green-500/25"
              >
                <ExternalLink className="w-4 h-4" />
                Purchase / Stream
              </a>
            </div>
          )}
        </Card>

        {/* Explore More */}
        <div className="max-w-3xl mx-auto mt-8 text-center">
          <p className="text-gray-400 mb-4">Discover Great Music by Great Music Artists.</p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button
              variant="outline"
              onClick={() => navigate("/")}
              className="border-cyan-500/30 hover:border-cyan-500/50 text-cyan-400 hover:text-cyan-300"
            >
              Browse All Songs
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate("/?tab=featured")}
              className="border-purple-500/30 hover:border-purple-500/50 text-purple-400 hover:text-purple-300"
            >
              Featured Songs
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate("/featured-artists")}
              className="animate-pulse bg-[#00BFFF]/30 text-[#39FF14] border-[#00BFFF] hover:bg-[#00BFFF]/50 hover:border-[#00BFFF] hover:text-[#39FF14] shadow-[0_0_10px_rgba(0,191,255,0.4)]"
            >
              Featured Artists
            </Button>

          </div>
        </div>
      </main>
    </div>
  );
};

export default SongPage;
