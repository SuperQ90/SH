// src/components/DailyShowcase.tsx
import React, { useEffect, useState, useRef, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";

import { supabase } from "@/lib/supabase";
import { Music, User, Play, Star } from "lucide-react";


const DEFAULT_AVATAR =
  "https://d64gsuwffb70l.cloudfront.net/6855b7b44152a08ab0b05643_1755626920268_0d5db80b.png";

interface DailyArtist {
  user_id: string;
  display_name: string | null;
  artist_slug: string;
  profile_image_url: string | null;
}

interface TopFeaturedArtist extends DailyArtist {
  song_count: number;
}

interface DailySong {
  id: string;
  title: string;
  artist: string;
  genre: string;
  image_url: string | null;
  cover_url: string | null;
  audio_url: string | null;
  duration?: number;
}

// Simple seeded PRNG based on date string
function seededRandom(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  }
  return function () {
    h = (h ^ (h >>> 16)) * 0x45d9f3b;
    h = (h ^ (h >>> 16)) * 0x45d9f3b;
    h = h ^ (h >>> 16);
    return (h >>> 0) / 4294967296;
  };
}

// Deterministic shuffle using seeded random
function seededShuffle<T>(arr: T[], rng: () => number): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function getTodayKey(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;
}

const CACHE_KEY_ARTISTS = "daily_showcase_artists";
const CACHE_KEY_SONGS = "daily_showcase_songs";
const CACHE_KEY_TOP_FEATURED = "daily_showcase_top_featured";
const CACHE_KEY_DATE = "daily_showcase_date";

const DailyShowcase: React.FC = () => {
  const navigate = useNavigate();
  const [artists, setArtists] = useState<DailyArtist[]>([]);
  const [songs, setSongs] = useState<DailySong[]>([]);
  const [topFeatured, setTopFeatured] = useState<TopFeaturedArtist[]>([]);
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

    const handlePause = () => {
      setIsAudioPlaying(false);
    };

    const handlePlay = () => {
      setIsAudioPlaying(true);
    };

    const handleError = () => {
      console.error("DailyShowcase audio playback error");
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

  const handlePlaySong = useCallback(async (song: DailySong) => {
    if (!song.audio_url) return;
    const audio = audioRef.current;
    if (!audio) return;

    // If the same song is already playing, toggle pause/play
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

    // Stop any currently playing audio, then load and play the new song
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
  }, [playingSongId, isAudioPlaying]);

  useEffect(() => {
    const today = getTodayKey();

    // Check localStorage cache
    const cachedDate = localStorage.getItem(CACHE_KEY_DATE);
    if (cachedDate === today) {
      try {
        const cachedArtists = JSON.parse(localStorage.getItem(CACHE_KEY_ARTISTS) || "[]");
        const cachedSongs = JSON.parse(localStorage.getItem(CACHE_KEY_SONGS) || "[]");
        const cachedTopFeatured = JSON.parse(localStorage.getItem(CACHE_KEY_TOP_FEATURED) || "[]");
        if (cachedArtists.length > 0 && cachedSongs.length > 0) {
          setArtists(cachedArtists);
          setSongs(cachedSongs);
          setTopFeatured(cachedTopFeatured);
          setLoading(false);
          return;
        }
      } catch {
        // Cache corrupted, refetch
      }
    }

    let cancelled = false;

    (async () => {
      try {
        // Fetch artists with profile images
        const { data: artistData } = await supabase
          .from("artist_public_profiles")
          .select("user_id, display_name, artist_slug, profile_image_url")
          .not("profile_image_url", "is", null)
          .neq("profile_image_url", "");

        // Fetch songs with images and audio_url
        const { data: songData } = await supabase
          .from("songs")
          .select("id, title, artist, genre, image_url, cover_url, audio_url, duration, user_id")
          .not("audio_url", "is", null)
          .neq("audio_url", "")
          .order("created_at", { ascending: false })
          .range(0, 4999);

        if (cancelled) return;

        const allArtists = (artistData || []) as DailyArtist[];
        const allSongs = (songData || []) as (DailySong & { user_id?: string })[];

        // --- Top Featured: artists with more than 10 songs ---
        const songCountByUser = new Map<string, number>();
        for (const song of allSongs) {
          if (song.user_id) {
            songCountByUser.set(song.user_id, (songCountByUser.get(song.user_id) || 0) + 1);
          }
        }

        const qualifiedUserIds = new Set<string>();
        for (const [userId, count] of songCountByUser) {
          if (count > 10) {
            qualifiedUserIds.add(userId);
          }
        }

        const topFeaturedArtists: TopFeaturedArtist[] = allArtists
          .filter((a) => qualifiedUserIds.has(a.user_id))
          .map((a) => ({
            ...a,
            song_count: songCountByUser.get(a.user_id) || 0,
          }));

        const rngTopFeatured = seededRandom("top-featured-" + today);
        const shuffledTopFeatured = seededShuffle(topFeaturedArtists, rngTopFeatured);
        const pickedTopFeatured = shuffledTopFeatured.slice(0, 6);


        // --- Artists of the Day ---
        const rngArtists = seededRandom("artists-" + today);
        const rngSongs = seededRandom("songs-" + today);

        // Pick 8 random artists
        const shuffledArtists = seededShuffle(allArtists, rngArtists);
        const pickedArtists = shuffledArtists.slice(0, 8);


        // Pick 8 songs from 8 different genres
        const genreMap = new Map<string, DailySong[]>();
        for (const song of allSongs) {
          if (!song.genre) continue;
          const img = song.image_url || song.cover_url;
          if (!img || img === "/placeholder.svg") continue;
          if (!genreMap.has(song.genre)) {
            genreMap.set(song.genre, []);
          }
          genreMap.get(song.genre)!.push(song);
        }

        // Shuffle genres deterministically, then pick one song from each
        const genreKeys = Array.from(genreMap.keys());
        const shuffledGenres = seededShuffle(genreKeys, rngSongs);
        const pickedSongs: DailySong[] = [];

        for (const genre of shuffledGenres) {
          if (pickedSongs.length >= 8) break;

          const genreSongs = genreMap.get(genre)!;
          const rngGenre = seededRandom("genre-" + genre + "-" + today);
          const shuffledGenreSongs = seededShuffle(genreSongs, rngGenre);
          if (shuffledGenreSongs.length > 0) {
            pickedSongs.push(shuffledGenreSongs[0]);
          }
        }

        setArtists(pickedArtists);
        setSongs(pickedSongs);
        setTopFeatured(pickedTopFeatured);

        // Cache results
        localStorage.setItem(CACHE_KEY_DATE, today);
        localStorage.setItem(CACHE_KEY_ARTISTS, JSON.stringify(pickedArtists));
        localStorage.setItem(CACHE_KEY_SONGS, JSON.stringify(pickedSongs));
        localStorage.setItem(CACHE_KEY_TOP_FEATURED, JSON.stringify(pickedTopFeatured));
      } catch (err) {
        console.error("DailyShowcase fetch error:", err);
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
      <div className="space-y-6 mb-6">
        {/* Skeleton for Top Featured */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-5 h-5 rounded bg-yellow-400/20 animate-pulse" />
            <div className="h-5 w-32 rounded bg-white/10 animate-pulse" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (

              <div key={i} className="flex flex-col items-center gap-2">
                <div className="w-24 h-24 sm:w-28 sm:h-28 lg:w-32 lg:h-32 rounded-full bg-white/10 animate-pulse" />
                <div className="h-3 w-16 rounded bg-white/10 animate-pulse" />
              </div>
            ))}
          </div>
        </div>
        {/* Skeleton for Artists */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-5 h-5 rounded bg-cyan-400/20 animate-pulse" />
            <div className="h-5 w-36 rounded bg-white/10 animate-pulse" />
          </div>
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-2">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white/10 animate-pulse" />
                <div className="h-3 w-14 rounded bg-white/10 animate-pulse" />
              </div>
            ))}
          </div>
        </div>
        {/* Skeleton for Songs */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-5 h-5 rounded bg-green-400/20 animate-pulse" />
            <div className="h-5 w-32 rounded bg-white/10 animate-pulse" />
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
      </div>
    );
  }

  if (artists.length === 0 && songs.length === 0 && topFeatured.length === 0) return null;

  return (
    <div className="space-y-6 mb-6">

      {/* TikTok LIVE Banner - currently hidden */}
      {/* <div className="flex justify-center">
        <a
          href="https://www.tiktok.com/@aimusicradio.io5/live"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block px-5 py-1.5 rounded-full bg-red-600 text-white text-xs font-bold tracking-wide uppercase animate-pulse shadow-lg shadow-red-600/50 hover:bg-red-500 transition-colors"
          style={{ minWidth: '192px', textAlign: 'center' }}
        >
          We are LIVE on TikTok
        </a>
      </div> */}


      {/* Banners Row: Artist Profile + Advertise */}

      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-center">
        {/* Create Your Free Artist Profile Banner */}
        <button
          type="button"
          onClick={() => navigate("/", { state: { openAuthModal: true } })}
          className="w-3/4 sm:w-[37.5%] max-w-[336px] rounded-xl overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
        >
          <img
            src="https://d64gsuwffb70l.cloudfront.net/6855b7b44152a08ab0b05643_1774329462658_9f7b75dc.png"
            alt="Create your Free Artist Profile with 3 songs - Upgrade for even more promotion - AI Music Radio"
            className="w-full h-auto object-cover"
            loading="lazy"
          />
        </button>
        {/* Advertise With Us Banner */}
        <a
          href="mailto:mrutter@gmail.com?subject=Advertising%20Inquiry%20-%20AI%20Music%20Radio"
          target="_blank"
          rel="noopener noreferrer"
          className="w-3/4 sm:w-[37.5%] max-w-[336px] rounded-xl overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
        >
          <img
            src="https://d64gsuwffb70l.cloudfront.net/6855b7b44152a08ab0b05643_1774328689267_bdfb5048.png"
            alt="Are you hosting an AI Song Battle? Contact us to advertise with aimusicradio.io"
            className="w-full h-auto object-cover"
            loading="lazy"
          />
        </a>
      </div>



      {/* Top Featured - Artists with 10+ songs, randomly rotated */}
      {topFeatured.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
            <h2 className="text-sm sm:text-base font-bold text-yellow-400">
              Top Featured
            </h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 sm:gap-5">

            {topFeatured.map((artist) => (
              <Link
                key={artist.user_id}
                to={`/artist/${artist.artist_slug}`}
                className="group flex flex-col items-center gap-2.5 transition-transform hover:scale-105"
              >
                <div className="relative w-24 h-24 sm:w-28 sm:h-28 lg:w-32 lg:h-32 rounded-full overflow-hidden border-2 border-yellow-400/50 group-hover:border-yellow-400 transition-colors shadow-lg shadow-yellow-400/10 group-hover:shadow-yellow-400/30">
                  <img
                    src={artist.profile_image_url || DEFAULT_AVATAR}
                    alt={artist.display_name || artist.artist_slug}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  {/* Song count badge */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1.5 pt-4 flex justify-center">
                    <span className="text-[10px] sm:text-xs font-semibold text-yellow-300">
                      {artist.song_count} songs
                    </span>
                  </div>
                </div>
                <span className="text-xs sm:text-sm text-white/80 group-hover:text-yellow-300 transition-colors text-center truncate max-w-full font-medium">
                  {artist.display_name || artist.artist_slug}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Artists of the Day */}
      {artists.length > 0 && (

        <div>
          <div className="flex items-center gap-2 mb-4">
            <User className="w-5 h-5 text-[#39FF14]" />
            <h2 className="text-sm sm:text-base font-bold text-[#39FF14]">
              Artists of the Day
            </h2>
          </div>
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-3 sm:gap-4">
            {artists.map((artist) => (
              <Link
                key={artist.user_id}
                to={`/artist/${artist.artist_slug}`}
                className="group flex flex-col items-center gap-2 transition-transform hover:scale-105"
              >
                <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden border-2 border-cyan-400/40 group-hover:border-cyan-400 transition-colors shadow-lg shadow-cyan-400/10 group-hover:shadow-cyan-400/30">
                  <img
                    src={artist.profile_image_url || DEFAULT_AVATAR}
                    alt={artist.display_name || artist.artist_slug}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
                <span className="text-xs sm:text-sm text-white/80 group-hover:text-cyan-300 transition-colors text-center truncate max-w-full font-medium">
                  {artist.display_name || artist.artist_slug}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Songs of the Day */}
      {songs.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Music className="w-5 h-5 text-[#39FF14]" />
            <h2 className="text-sm sm:text-base font-bold text-[#39FF14]">
              Songs of the Day
            </h2>
          </div>

          <div className="grid grid-cols-4 sm:grid-cols-8 gap-3 sm:gap-4">
            {songs.map((song) => {
              const imgSrc = song.image_url || song.cover_url || DEFAULT_AVATAR;
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
                  <div className={`relative w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden border transition-colors shadow-lg ${
                    isCurrent
                      ? "border-green-400 shadow-green-400/30"
                      : "border-white/10 group-hover:border-green-400/60 shadow-green-400/5 group-hover:shadow-green-400/20"
                  }`}>
                    <img
                      src={imgSrc}
                      alt={song.title}
                      className={`w-full h-full object-cover transition-all duration-200 ${
                        isCurrent ? "brightness-75" : "group-hover:brightness-75"
                      }`}
                      loading="lazy"
                    />
                    {/* Play/Pause overlay */}
                    <div className={`absolute inset-0 flex items-center justify-center transition-opacity duration-200 ${
                      isCurrent ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                    }`}>
                      {isCurrentlyPlaying ? (
                        <div className="flex items-center gap-[3px]">
                          <span className="w-[3px] h-3 sm:h-4 bg-green-400 rounded-full animate-pulse" />
                          <span className="w-[3px] h-4 sm:h-5 bg-green-400 rounded-full animate-pulse" style={{ animationDelay: "0.15s" }} />
                          <span className="w-[3px] h-3 sm:h-4 bg-green-400 rounded-full animate-pulse" style={{ animationDelay: "0.3s" }} />
                        </div>
                      ) : (
                        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-green-500/90 flex items-center justify-center shadow-lg shadow-green-500/30">
                          <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white fill-white ml-0.5" />
                        </div>
                      )}
                    </div>
                    {/* Genre badge */}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1 pt-3">
                      <span
                        className="text-[8px] sm:text-[10px] font-semibold text-green-400"
                        style={{ textShadow: "0 0 8px rgba(34,197,94,0.8)" }}
                      >
                        {song.genre}
                      </span>
                    </div>
                  </div>
                  <div className="min-w-0 text-center max-w-full">
                    <p className={`text-[10px] sm:text-xs transition-colors font-medium truncate ${
                      isCurrent ? "text-green-400" : "text-white/90 group-hover:text-green-300"
                    }`}>
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
      )}
    </div>
  );
};

export default DailyShowcase;

