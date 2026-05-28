import React, { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Sparkles, Play } from "lucide-react";


const DEFAULT_COVER =
  "https://d64gsuwffb70l.cloudfront.net/6855b7b44152a08ab0b05643_1755626920268_0d5db80b.png";

interface NewSong {
  id: string;
  title: string;
  artist: string;
  genre: string;
  image_url: string | null;
  cover_url: string | null;
  audio_url: string | null;
  created_at: string;
}

function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

const NewSongs: React.FC = () => {
  const [songs, setSongs] = useState<NewSong[]>([]);
  const [loading, setLoading] = useState(true);

  // Direct audio playback state
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingSongId, setPlayingSongId] = useState<string | null>(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);

  // Create audio element once on mount
  useEffect(() => {
    const audio = new Audio();
    audio.preload = "auto";
    audio.crossOrigin = "anonymous";
    audioRef.current = audio;

    const handleEnded = () => {
      setIsAudioPlaying(false);
      setPlayingSongId(null);
    };
    const handlePause = () => setIsAudioPlaying(false);
    const handlePlay = () => setIsAudioPlaying(true);
    const handleError = () => {
      console.error("NewSongs audio playback error");
      setIsAudioPlaying(false);
      setPlayingSongId(null);
    };

    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("error", handleError);

    return () => {
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("error", handleError);
      audio.pause();
      audio.src = "";
    };
  }, []);

  const handlePlaySong = useCallback(
    async (song: NewSong) => {
      if (!song.audio_url) return;
      const audio = audioRef.current;
      if (!audio) return;

      // Toggle pause/play if same song
      if (playingSongId === song.id) {
        if (isAudioPlaying) {
          audio.pause();
        } else {
          try {
            await audio.play();
          } catch (err) {
            console.error("Resume failed:", err);
          }
        }
        return;
      }

      // Play new song
      audio.pause();
      audio.src = song.audio_url;
      audio.load();
      setPlayingSongId(song.id);

      try {
        await audio.play();
      } catch (err) {
        console.error("Playback failed:", err);
        setPlayingSongId(null);
        setIsAudioPlaying(false);
      }
    },
    [playingSongId, isAudioPlaying]
  );

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // Fetch the 50 most recently added songs that have audio
        const { data, error } = await supabase
          .from("songs")
          .select("id, title, artist, genre, image_url, cover_url, audio_url, created_at")
          .not("audio_url", "is", null)
          .neq("audio_url", "")
          .order("created_at", { ascending: false })
          .limit(50);

        if (cancelled) return;

        if (error) {
          console.error("NewSongs fetch error:", error);
          setLoading(false);
          return;
        }

        const allSongs = (data || []) as NewSong[];

        // Only include songs that have an image (image_url or cover_url)
        const songsWithImages = allSongs.filter(
          (s) => (s.image_url && s.image_url.trim() !== "") || (s.cover_url && s.cover_url.trim() !== "")
        );

        // Randomly pick 6 from the filtered songs
        const shuffled = shuffleArray(songsWithImages);
        const picked = shuffled.slice(0, 8);


        setSongs(picked);
      } catch (err) {
        console.error("NewSongs fetch error:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-5 h-5 rounded bg-orange-400/20 animate-pulse" />
          <div className="h-5 w-28 rounded bg-white/10 animate-pulse" />
        </div>
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-1.5">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg bg-white/10 animate-pulse" />
              <div className="h-3 w-14 rounded bg-white/10 animate-pulse" />
              <div className="h-2 w-10 rounded bg-white/10 animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (songs.length === 0) return null;

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-5 h-5 text-[#39FF14]" />
        <h2 className="text-sm sm:text-base font-bold text-[#39FF14]">
          New Songs
        </h2>
      </div>
      <div className="grid grid-cols-4 sm:grid-cols-8 gap-3 sm:gap-4">
        {songs.map((song) => {
          const imgSrc = song.image_url || song.cover_url || DEFAULT_COVER;
          const isCurrent = playingSongId === song.id;
          const isCurrentlyPlaying = isCurrent && isAudioPlaying;
          return (
            <button
              key={song.id}
              type="button"
              onClick={() => handlePlaySong(song)}
              className="group flex flex-col items-center gap-1.5 transition-transform hover:scale-105 cursor-pointer"
              title={`Play ${song.title} by ${song.artist}`}
            >
              <div
                className={`relative w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden border transition-colors shadow-lg ${
                  isCurrent
                    ? "border-orange-400 shadow-orange-400/30"
                    : "border-white/10 group-hover:border-orange-400/60 shadow-orange-400/5 group-hover:shadow-orange-400/20"
                }`}
              >
                <img
                  src={imgSrc}
                  alt={song.title}
                  className={`w-full h-full object-cover transition-all duration-200 ${
                    isCurrent ? "brightness-75" : "group-hover:brightness-75"
                  }`}
                  loading="lazy"
                />
                {/* Play/Pause overlay */}
                <div
                  className={`absolute inset-0 flex items-center justify-center transition-opacity duration-200 ${
                    isCurrent
                      ? "opacity-100"
                      : "opacity-0 group-hover:opacity-100"
                  }`}
                >
                  {isCurrentlyPlaying ? (
                    <div className="flex items-center gap-[3px]">
                      <span className="w-[3px] h-3 sm:h-4 bg-orange-400 rounded-full animate-pulse" />
                      <span
                        className="w-[3px] h-4 sm:h-5 bg-orange-400 rounded-full animate-pulse"
                        style={{ animationDelay: "0.15s" }}
                      />
                      <span
                        className="w-[3px] h-3 sm:h-4 bg-orange-400 rounded-full animate-pulse"
                        style={{ animationDelay: "0.3s" }}
                      />
                    </div>
                  ) : (
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-orange-500/90 flex items-center justify-center shadow-lg shadow-orange-500/30">
                      <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white fill-white ml-0.5" />
                    </div>
                  )}
                </div>
                {/* Genre badge */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1 pt-3">
                  <span
                    className="text-[8px] sm:text-[10px] font-semibold text-orange-400"
                    style={{ textShadow: "0 0 8px rgba(251,146,60,0.8)" }}
                  >
                    {song.genre}
                  </span>
                </div>
              </div>
              <div className="min-w-0 text-center max-w-full">
                <p
                  className={`text-[10px] sm:text-xs transition-colors font-medium truncate ${
                    isCurrent
                      ? "text-orange-400"
                      : "text-white/90 group-hover:text-orange-300"
                  }`}
                >
                  {song.title}
                </p>
                <p className="text-[9px] sm:text-[10px] text-white/50 truncate">
                  {song.artist}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default NewSongs;
