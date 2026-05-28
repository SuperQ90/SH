// src/pages/FeaturedArtists.tsx
import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, RefreshCw, Users, Search, X, Sparkles, Music, Zap, Disc3 } from "lucide-react";

type Artist = {
  user_id: string;
  display_name: string | null;
  artist_slug: string;
  profile_image_url: string | null;
  genres: string[] | null;
};

const FeaturedArtists: React.FC = () => {
  const [allArtists, setAllArtists] = useState<Artist[]>([]);
  const [displayedArtists, setDisplayedArtists] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(true);
  const [rotationKey, setRotationKey] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [songCounts, setSongCounts] = useState<Record<string, number>>({});

  // Fetch all artists with profile images + genres, and song counts
  useEffect(() => {
    const fetchArtists = async () => {
      setLoading(true);

      // Fetch artists with genres
      const { data, error } = await supabase
        .from("artist_public_profiles")
        .select("user_id, display_name, artist_slug, profile_image_url, genres")
        .not("profile_image_url", "is", null)
        .neq("profile_image_url", "");

      if (!error && data) {
        setAllArtists(data as Artist[]);
      }

      // Fetch song counts per artist
      const { data: songData } = await supabase
        .from("songs")
        .select("user_id");

      if (songData) {
        const counts: Record<string, number> = {};
        songData.forEach((s: { user_id: string }) => {
          if (s.user_id) {
            counts[s.user_id] = (counts[s.user_id] || 0) + 1;
          }
        });
        setSongCounts(counts);
      }

      setLoading(false);
    };

    fetchArtists();
  }, []);

  // Shuffle and select 28 random artists
  const shuffleArtists = useCallback(() => {
    if (allArtists.length === 0) return;

    const shuffled = [...allArtists].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, 28);
    setDisplayedArtists(selected);
    setRotationKey((prev) => prev + 1);
  }, [allArtists]);

  // Initial shuffle when artists are loaded
  useEffect(() => {
    if (allArtists.length > 0) {
      shuffleArtists();
    }
  }, [allArtists, shuffleArtists]);

  // Auto-rotate every 30 seconds (only when not searching)
  useEffect(() => {
    if (allArtists.length === 0 || isSearching) return;

    const interval = setInterval(() => {
      shuffleArtists();
    }, 30000);

    return () => clearInterval(interval);
  }, [allArtists, shuffleArtists, isSearching]);

  // Search / filter logic
  const filteredArtists = useMemo(() => {
    if (!searchQuery.trim()) return displayedArtists;
    const q = searchQuery.toLowerCase().trim();
    return allArtists.filter(
      (a) =>
        (a.display_name && a.display_name.toLowerCase().includes(q)) ||
        a.artist_slug.toLowerCase().includes(q)
    );
  }, [searchQuery, allArtists, displayedArtists]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    setIsSearching(val.trim().length > 0);
  };

  const clearSearch = () => {
    setSearchQuery("");
    setIsSearching(false);
  };

  // Genre color mapping for badges
  const getGenreColor = (genre: string): string => {
    const g = genre.toLowerCase();
    if (g.includes('rock') || g.includes('metal') || g.includes('punk') || g.includes('hardcore') || g.includes('industrial')) return 'from-red-500/30 to-red-600/20 border-red-500/40 text-red-300';
    if (g.includes('pop') || g.includes('k-pop') || g.includes('dance')) return 'from-pink-500/30 to-pink-600/20 border-pink-500/40 text-pink-300';
    if (g.includes('hip hop') || g.includes('rap') || g.includes('trap') || g.includes('grime')) return 'from-amber-500/30 to-amber-600/20 border-amber-500/40 text-amber-300';
    if (g.includes('jazz') || g.includes('blues') || g.includes('soul') || g.includes('r&b') || g.includes('funk')) return 'from-blue-500/30 to-blue-600/20 border-blue-500/40 text-blue-300';
    if (g.includes('electronic') || g.includes('techno') || g.includes('house') || g.includes('trance') || g.includes('dubstep') || g.includes('drum') || g.includes('breakbeat')) return 'from-cyan-500/30 to-cyan-600/20 border-cyan-500/40 text-cyan-300';
    if (g.includes('country') || g.includes('folk') || g.includes('bluegrass') || g.includes('southern')) return 'from-yellow-500/30 to-yellow-600/20 border-yellow-500/40 text-yellow-300';
    if (g.includes('classical') || g.includes('ambient') || g.includes('new age') || g.includes('healing') || g.includes('lo-fi') || g.includes('chillout')) return 'from-indigo-500/30 to-indigo-600/20 border-indigo-500/40 text-indigo-300';
    if (g.includes('reggae') || g.includes('dub') || g.includes('ska') || g.includes('afrobeat') || g.includes('latin') || g.includes('salsa') || g.includes('world')) return 'from-green-500/30 to-green-600/20 border-green-500/40 text-green-300';
    if (g.includes('gospel') || g.includes('christian') || g.includes('ccm')) return 'from-purple-500/30 to-purple-600/20 border-purple-500/40 text-purple-300';
    if (g.includes('goth') || g.includes('ethereal') || g.includes('experimental')) return 'from-violet-500/30 to-violet-600/20 border-violet-500/40 text-violet-300';
    if (g.includes('indie') || g.includes('alternative')) return 'from-teal-500/30 to-teal-600/20 border-teal-500/40 text-teal-300';
    if (g.includes('disco') || g.includes('garage')) return 'from-fuchsia-500/30 to-fuchsia-600/20 border-fuchsia-500/40 text-fuchsia-300';
    return 'from-emerald-500/30 to-emerald-600/20 border-emerald-500/40 text-emerald-300';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020818] flex items-center justify-center relative overflow-hidden">
        {/* Animated background beams */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-500/10 rounded-full blur-[120px] animate-pulse" />
          <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-emerald-500/8 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '1s' }} />
          <div className="absolute bottom-1/4 right-1/4 w-[350px] h-[350px] bg-blue-600/10 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '0.5s' }} />
        </div>
        <Card className="p-10 text-center border-cyan-500/30 bg-black/60 backdrop-blur-xl relative z-10 shadow-[0_0_60px_rgba(34,211,238,0.15)]">
          <div className="animate-pulse flex flex-col items-center gap-5">
            <div className="w-20 h-20 bg-gradient-to-br from-cyan-500/30 to-emerald-500/30 rounded-full flex items-center justify-center">
              <Music className="w-10 h-10 text-cyan-400/60" />
            </div>
            <div className="h-4 bg-cyan-500/20 rounded-full w-52" />
            <div className="h-3 bg-emerald-500/20 rounded-full w-36" />
            <p className="text-cyan-300/60 text-sm mt-2">Loading artists...</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020818] relative overflow-hidden">
      {/* ===== CONCERT ATMOSPHERE BACKGROUND ===== */}
      {/* Deep space base */}
      <div className="fixed inset-0 bg-gradient-to-b from-[#020818] via-[#041030] to-[#020818]" />

      {/* Animated neon orbs - concert stage lights */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {/* Main cyan spotlight */}
        <div
          className="absolute w-[700px] h-[700px] rounded-full blur-[150px] opacity-20"
          style={{
            background: 'radial-gradient(circle, rgba(34,211,238,0.6) 0%, transparent 70%)',
            top: '-10%',
            left: '20%',
            animation: 'spotlightSway 8s ease-in-out infinite',
          }}
        />
        {/* Emerald spotlight */}
        <div
          className="absolute w-[600px] h-[600px] rounded-full blur-[130px] opacity-15"
          style={{
            background: 'radial-gradient(circle, rgba(16,185,129,0.6) 0%, transparent 70%)',
            top: '-5%',
            right: '15%',
            animation: 'spotlightSway 10s ease-in-out infinite reverse',
          }}
        />
        {/* Blue laser sweep */}
        <div
          className="absolute w-[500px] h-[500px] rounded-full blur-[120px] opacity-10"
          style={{
            background: 'radial-gradient(circle, rgba(59,130,246,0.7) 0%, transparent 70%)',
            bottom: '10%',
            left: '40%',
            animation: 'spotlightSway 12s ease-in-out infinite',
          }}
        />
        {/* Neon green accent */}
        <div
          className="absolute w-[300px] h-[300px] rounded-full blur-[100px] opacity-20"
          style={{
            background: 'radial-gradient(circle, rgba(0,255,136,0.5) 0%, transparent 70%)',
            top: '50%',
            left: '5%',
            animation: 'floatUp 6s ease-in-out infinite',
          }}
        />
        {/* Deep blue pulse */}
        <div
          className="absolute w-[400px] h-[400px] rounded-full blur-[110px] opacity-15"
          style={{
            background: 'radial-gradient(circle, rgba(99,102,241,0.5) 0%, transparent 70%)',
            top: '60%',
            right: '10%',
            animation: 'floatUp 9s ease-in-out infinite reverse',
          }}
        />

        {/* Laser lines */}
        <div className="absolute top-0 left-1/4 w-px h-full bg-gradient-to-b from-cyan-400/0 via-cyan-400/20 to-cyan-400/0" style={{ animation: 'laserFlicker 3s ease-in-out infinite' }} />
        <div className="absolute top-0 left-1/2 w-px h-full bg-gradient-to-b from-emerald-400/0 via-emerald-400/15 to-emerald-400/0" style={{ animation: 'laserFlicker 4s ease-in-out infinite', animationDelay: '1s' }} />
        <div className="absolute top-0 left-3/4 w-px h-full bg-gradient-to-b from-blue-400/0 via-blue-400/20 to-blue-400/0" style={{ animation: 'laserFlicker 3.5s ease-in-out infinite', animationDelay: '0.5s' }} />

        {/* Horizontal scan line */}
        <div
          className="absolute left-0 w-full h-px bg-gradient-to-r from-transparent via-cyan-400/30 to-transparent"
          style={{ animation: 'scanLine 6s linear infinite' }}
        />

        {/* Grid floor effect */}
        <div
          className="absolute bottom-0 left-0 right-0 h-[40%] opacity-[0.04]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(34,211,238,0.5) 1px, transparent 1px),
              linear-gradient(90deg, rgba(34,211,238,0.5) 1px, transparent 1px)
            `,
            backgroundSize: '60px 60px',
            transform: 'perspective(500px) rotateX(60deg)',
            transformOrigin: 'bottom',
          }}
        />
      </div>

      {/* ===== MAIN CONTENT ===== */}
      <div className="relative z-10 min-h-screen">
        {/* Header / Hero Section */}
        <div className="relative border-b border-cyan-500/20 overflow-hidden">
          {/* ===== STAGE LIGHTING ACROSS TOP ===== */}
          <div className="absolute top-0 left-0 right-0 h-full pointer-events-none overflow-hidden">
            {/* Stage light bar - the rig at the top */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-white/20 to-transparent z-10" />
            <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-cyan-500/0 via-cyan-400/50 to-cyan-500/0 blur-[1px] z-10" />

            {/* Light beam 1 - Magenta/Pink - far left */}
            <div
              className="absolute top-0 left-[5%] origin-top"
              style={{
                width: '4px',
                height: '100%',
                background: 'linear-gradient(to bottom, rgba(236,72,153,0.9) 0%, rgba(236,72,153,0.3) 40%, transparent 100%)',
                filter: 'blur(0.5px)',
                animation: 'stageLightSway1 4s ease-in-out infinite',
              }}
            />
            <div
              className="absolute top-0 left-[5%] origin-top"
              style={{
                width: '80px',
                height: '100%',
                marginLeft: '-38px',
                background: 'linear-gradient(to bottom, rgba(236,72,153,0.15) 0%, rgba(236,72,153,0.05) 50%, transparent 100%)',
                filter: 'blur(20px)',
                animation: 'stageLightSway1 4s ease-in-out infinite',
              }}
            />
            {/* Light source glow 1 */}
            <div
              className="absolute top-0 left-[5%] -translate-x-1/2 w-6 h-6 rounded-full z-10"
              style={{
                background: 'radial-gradient(circle, rgba(236,72,153,0.9) 0%, rgba(236,72,153,0.3) 50%, transparent 100%)',
                boxShadow: '0 0 15px rgba(236,72,153,0.6), 0 0 30px rgba(236,72,153,0.3)',
                animation: 'stageLightSway1 4s ease-in-out infinite, pulseLight 2s ease-in-out infinite',
              }}
            />

            {/* Light beam 2 - Cyan - left */}
            <div
              className="absolute top-0 left-[20%] origin-top"
              style={{
                width: '4px',
                height: '100%',
                background: 'linear-gradient(to bottom, rgba(34,211,238,0.9) 0%, rgba(34,211,238,0.3) 40%, transparent 100%)',
                filter: 'blur(0.5px)',
                animation: 'stageLightSway2 5s ease-in-out infinite',
              }}
            />
            <div
              className="absolute top-0 left-[20%] origin-top"
              style={{
                width: '90px',
                height: '100%',
                marginLeft: '-43px',
                background: 'linear-gradient(to bottom, rgba(34,211,238,0.15) 0%, rgba(34,211,238,0.05) 50%, transparent 100%)',
                filter: 'blur(25px)',
                animation: 'stageLightSway2 5s ease-in-out infinite',
              }}
            />
            <div
              className="absolute top-0 left-[20%] -translate-x-1/2 w-6 h-6 rounded-full z-10"
              style={{
                background: 'radial-gradient(circle, rgba(34,211,238,0.9) 0%, rgba(34,211,238,0.3) 50%, transparent 100%)',
                boxShadow: '0 0 15px rgba(34,211,238,0.6), 0 0 30px rgba(34,211,238,0.3)',
                animation: 'stageLightSway2 5s ease-in-out infinite, pulseLight 2.5s ease-in-out infinite',
              }}
            />

            {/* Light beam 3 - Green/Emerald - left-center */}
            <div
              className="absolute top-0 left-[35%] origin-top"
              style={{
                width: '4px',
                height: '100%',
                background: 'linear-gradient(to bottom, rgba(16,185,129,0.9) 0%, rgba(16,185,129,0.3) 40%, transparent 100%)',
                filter: 'blur(0.5px)',
                animation: 'stageLightSway3 4.5s ease-in-out infinite',
              }}
            />
            <div
              className="absolute top-0 left-[35%] origin-top"
              style={{
                width: '85px',
                height: '100%',
                marginLeft: '-40px',
                background: 'linear-gradient(to bottom, rgba(16,185,129,0.15) 0%, rgba(16,185,129,0.05) 50%, transparent 100%)',
                filter: 'blur(22px)',
                animation: 'stageLightSway3 4.5s ease-in-out infinite',
              }}
            />
            <div
              className="absolute top-0 left-[35%] -translate-x-1/2 w-6 h-6 rounded-full z-10"
              style={{
                background: 'radial-gradient(circle, rgba(16,185,129,0.9) 0%, rgba(16,185,129,0.3) 50%, transparent 100%)',
                boxShadow: '0 0 15px rgba(16,185,129,0.6), 0 0 30px rgba(16,185,129,0.3)',
                animation: 'stageLightSway3 4.5s ease-in-out infinite, pulseLight 3s ease-in-out infinite',
              }}
            />

            {/* Light beam 4 - White/Bright - center (main spotlight) */}
            <div
              className="absolute top-0 left-[50%] origin-top"
              style={{
                width: '6px',
                height: '100%',
                background: 'linear-gradient(to bottom, rgba(255,255,255,0.95) 0%, rgba(200,220,255,0.4) 35%, transparent 100%)',
                filter: 'blur(0.5px)',
                animation: 'stageLightCenter 6s ease-in-out infinite',
              }}
            />
            <div
              className="absolute top-0 left-[50%] origin-top"
              style={{
                width: '120px',
                height: '100%',
                marginLeft: '-57px',
                background: 'linear-gradient(to bottom, rgba(200,220,255,0.2) 0%, rgba(200,220,255,0.06) 50%, transparent 100%)',
                filter: 'blur(30px)',
                animation: 'stageLightCenter 6s ease-in-out infinite',
              }}
            />
            <div
              className="absolute top-0 left-[50%] -translate-x-1/2 w-8 h-8 rounded-full z-10"
              style={{
                background: 'radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(200,220,255,0.4) 40%, transparent 100%)',
                boxShadow: '0 0 20px rgba(200,220,255,0.8), 0 0 40px rgba(200,220,255,0.4), 0 0 60px rgba(200,220,255,0.2)',
                animation: 'stageLightCenter 6s ease-in-out infinite, pulseLight 1.5s ease-in-out infinite',
              }}
            />

            {/* Light beam 5 - Blue - right-center */}
            <div
              className="absolute top-0 left-[65%] origin-top"
              style={{
                width: '4px',
                height: '100%',
                background: 'linear-gradient(to bottom, rgba(59,130,246,0.9) 0%, rgba(59,130,246,0.3) 40%, transparent 100%)',
                filter: 'blur(0.5px)',
                animation: 'stageLightSway4 5.5s ease-in-out infinite',
              }}
            />
            <div
              className="absolute top-0 left-[65%] origin-top"
              style={{
                width: '85px',
                height: '100%',
                marginLeft: '-40px',
                background: 'linear-gradient(to bottom, rgba(59,130,246,0.15) 0%, rgba(59,130,246,0.05) 50%, transparent 100%)',
                filter: 'blur(22px)',
                animation: 'stageLightSway4 5.5s ease-in-out infinite',
              }}
            />
            <div
              className="absolute top-0 left-[65%] -translate-x-1/2 w-6 h-6 rounded-full z-10"
              style={{
                background: 'radial-gradient(circle, rgba(59,130,246,0.9) 0%, rgba(59,130,246,0.3) 50%, transparent 100%)',
                boxShadow: '0 0 15px rgba(59,130,246,0.6), 0 0 30px rgba(59,130,246,0.3)',
                animation: 'stageLightSway4 5.5s ease-in-out infinite, pulseLight 2.8s ease-in-out infinite',
              }}
            />

            {/* Light beam 6 - Yellow/Amber - right */}
            <div
              className="absolute top-0 left-[80%] origin-top"
              style={{
                width: '4px',
                height: '100%',
                background: 'linear-gradient(to bottom, rgba(251,191,36,0.9) 0%, rgba(251,191,36,0.3) 40%, transparent 100%)',
                filter: 'blur(0.5px)',
                animation: 'stageLightSway5 4.8s ease-in-out infinite',
              }}
            />
            <div
              className="absolute top-0 left-[80%] origin-top"
              style={{
                width: '80px',
                height: '100%',
                marginLeft: '-38px',
                background: 'linear-gradient(to bottom, rgba(251,191,36,0.15) 0%, rgba(251,191,36,0.05) 50%, transparent 100%)',
                filter: 'blur(20px)',
                animation: 'stageLightSway5 4.8s ease-in-out infinite',
              }}
            />
            <div
              className="absolute top-0 left-[80%] -translate-x-1/2 w-6 h-6 rounded-full z-10"
              style={{
                background: 'radial-gradient(circle, rgba(251,191,36,0.9) 0%, rgba(251,191,36,0.3) 50%, transparent 100%)',
                boxShadow: '0 0 15px rgba(251,191,36,0.6), 0 0 30px rgba(251,191,36,0.3)',
                animation: 'stageLightSway5 4.8s ease-in-out infinite, pulseLight 2.2s ease-in-out infinite',
              }}
            />

            {/* Light beam 7 - Purple/Violet - far right */}
            <div
              className="absolute top-0 left-[95%] origin-top"
              style={{
                width: '4px',
                height: '100%',
                background: 'linear-gradient(to bottom, rgba(168,85,247,0.9) 0%, rgba(168,85,247,0.3) 40%, transparent 100%)',
                filter: 'blur(0.5px)',
                animation: 'stageLightSway6 5.2s ease-in-out infinite',
              }}
            />
            <div
              className="absolute top-0 left-[95%] origin-top"
              style={{
                width: '80px',
                height: '100%',
                marginLeft: '-38px',
                background: 'linear-gradient(to bottom, rgba(168,85,247,0.15) 0%, rgba(168,85,247,0.05) 50%, transparent 100%)',
                filter: 'blur(20px)',
                animation: 'stageLightSway6 5.2s ease-in-out infinite',
              }}
            />
            <div
              className="absolute top-0 left-[95%] -translate-x-1/2 w-6 h-6 rounded-full z-10"
              style={{
                background: 'radial-gradient(circle, rgba(168,85,247,0.9) 0%, rgba(168,85,247,0.3) 50%, transparent 100%)',
                boxShadow: '0 0 15px rgba(168,85,247,0.6), 0 0 30px rgba(168,85,247,0.3)',
                animation: 'stageLightSway6 5.2s ease-in-out infinite, pulseLight 2.6s ease-in-out infinite',
              }}
            />

            {/* Haze / atmospheric fog across the top */}
            <div
              className="absolute top-0 left-0 right-0 h-24"
              style={{
                background: 'linear-gradient(to bottom, rgba(200,220,255,0.06) 0%, transparent 100%)',
                animation: 'hazeShimmer 3s ease-in-out infinite',
              }}
            />
          </div>

          {/* Header glow bar */}

          <div className="max-w-7xl mx-auto px-4 py-4">
            {/* Top nav row */}
            <div className="flex items-center justify-between mb-4">
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="border border-cyan-400/40 bg-cyan-950/30 hover:bg-cyan-900/50 text-cyan-300 shadow-[0_0_20px_rgba(34,211,238,0.25)] backdrop-blur-md transition-all duration-300 hover:shadow-[0_0_30px_rgba(34,211,238,0.5)] hover:border-cyan-400/70"
              >
                <Link to="/">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Home
                </Link>
              </Button>


            </div>

            {/* Hero content */}
            <div className="text-center mb-3">
              <img
                src="https://d64gsuwffb70l.cloudfront.net/6855b7b44152a08ab0b05643_1756180840742_c852d3d4.png"
                alt="AI Music Radio Logo"
                className="h-14 md:h-16 lg:h-20 w-auto object-contain rounded-lg mx-auto mb-3"
                style={{
                  filter: 'drop-shadow(0 0 20px rgba(34,211,238,0.5)) drop-shadow(0 0 40px rgba(16,185,129,0.3))',
                }}
              />

              {/* Flashy title with neon glow */}
              <div className="relative inline-block mb-1">
                <h1
                  className="text-3xl md:text-4xl lg:text-5xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-emerald-300 to-blue-400"
                  style={{
                    textShadow: '0 0 40px rgba(34,211,238,0.5)',
                  }}
                >
                  Featured Artists
                </h1>
                {/* Decorative sparkles */}
                <Sparkles className="absolute -top-2 -right-7 w-5 h-5 text-cyan-400 animate-pulse" />
                <Zap className="absolute -bottom-1 -left-5 w-4 h-4 text-emerald-400 animate-pulse" style={{ animationDelay: '0.5s' }} />
              </div>

              <p className="text-cyan-200/70 text-sm md:text-base max-w-2xl mx-auto leading-relaxed">

                Discover talented lyricists, music artists and more on{" "}
                <span className="font-semibold"><span className="text-white" style={{ textShadow: '0 0 10px rgba(255,255,255,0.5)' }}>AI</span>{" "}<span className="text-cyan-400" style={{ textShadow: '0 0 12px rgba(34,211,238,0.7), 0 0 24px rgba(34,211,238,0.4)' }}>Music</span>{" "}<span className="text-green-400" style={{ textShadow: '0 0 12px rgba(74,222,128,0.7), 0 0 24px rgba(74,222,128,0.4)' }}>Radio</span><span className="text-white" style={{ textShadow: '0 0 10px rgba(255,255,255,0.5)' }}>.io</span></span>

              </p>

              {/* Stats bar */}
              <div className="flex items-center justify-center gap-4 mt-3">
                <button
                  onClick={() => {
                    clearSearch();
                    shuffleArtists();
                  }}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 backdrop-blur-sm hover:bg-emerald-500/20 hover:border-emerald-400/40 hover:shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all duration-300 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-300 text-xs font-medium">Shuffle</span>
                </button>

                <Link
                  to="/all-artists"
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 backdrop-blur-sm hover:bg-emerald-500/20 hover:border-emerald-400/40 hover:shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all duration-300 cursor-pointer"
                >
                  <Users className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-300 text-xs font-medium">All Artists</span>
                </Link>

                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 backdrop-blur-sm">
                  <Music className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-300 text-xs font-medium">Live Rotation</span>
                </div>
              </div>

            </div>

            {/* ===== SEARCH BAR ===== */}
            <div className="max-w-xl mx-auto mt-6">
              <div className="relative group">
                {/* Glow behind search */}
                <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500/20 via-emerald-500/20 to-blue-500/20 rounded-2xl blur-lg opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-500" />

                <div className="relative flex items-center bg-[#0a1628]/80 border border-cyan-500/30 rounded-xl backdrop-blur-xl overflow-hidden shadow-[0_0_30px_rgba(34,211,238,0.1)] group-focus-within:border-cyan-400/60 group-focus-within:shadow-[0_0_40px_rgba(34,211,238,0.25)] transition-all duration-300">
                  <Search className="w-5 h-5 text-cyan-400/60 ml-4 flex-shrink-0" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={handleSearchChange}
                    placeholder="Search artists by name..."
                    className="flex-1 bg-transparent text-cyan-100 placeholder-cyan-400/40 px-4 py-3.5 text-base outline-none"
                  />
                  {searchQuery && (
                    <button
                      onClick={clearSearch}
                      className="mr-3 p-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 transition-colors duration-200"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
              {isSearching && (
                <p className="text-center text-cyan-300/50 text-sm mt-3">
                  Found <span className="text-emerald-400 font-semibold">{filteredArtists.length}</span> artist{filteredArtists.length !== 1 ? 's' : ''} matching "<span className="text-cyan-300">{searchQuery}</span>"
                </p>
              )}
              <p className="text-center mt-4 text-sm md:text-base font-extrabold tracking-wide" style={{
                backgroundImage: 'linear-gradient(0deg, #ff0000 0%, #ff4500 20%, #ff8c00 40%, #ffd700 60%, #ffff00 80%, #fff5a0 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                filter: 'drop-shadow(0 0 6px rgba(255,69,0,0.8)) drop-shadow(0 0 18px rgba(255,140,0,0.6)) drop-shadow(0 0 40px rgba(255,0,0,0.4))',
              }}>
                Will You be the Next Featured Artist?
              </p>


            </div>

          </div>
        </div>

        {/* ===== ARTISTS GRID ===== */}
        <div className="max-w-7xl mx-auto px-4 py-10">
          {filteredArtists.length === 0 ? (
            <Card className="p-10 text-center border-cyan-500/20 bg-[#0a1628]/60 backdrop-blur-xl shadow-[0_0_40px_rgba(34,211,238,0.1)]">
              <div className="relative inline-block mb-4">
                <Users className="w-14 h-14 text-cyan-400/60" />
                <div className="absolute inset-0 w-14 h-14 bg-cyan-400/10 rounded-full blur-xl" />
              </div>
              <p className="text-cyan-200/80 text-lg">
                {isSearching
                  ? `No artists found matching "${searchQuery}"`
                  : "No featured artists available yet."}
              </p>
              <p className="text-sm text-emerald-200/50 mt-2">
                {isSearching
                  ? "Try a different search term."
                  : "Artists with profile images will appear here."}
              </p>
              {isSearching && (
                <Button
                  onClick={clearSearch}
                  variant="outline"
                  size="sm"
                  className="mt-4 border-cyan-400/40 text-cyan-300 hover:bg-cyan-950/50"
                >
                  Clear Search
                </Button>
              )}
            </Card>
          ) : (
            <div
              key={isSearching ? `search-${searchQuery}` : rotationKey}
              className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 md:gap-6"
            >
              {filteredArtists.map((artist, index) => {
                const artistGenres = artist.genres && artist.genres.length > 0 ? artist.genres : [];
                const count = songCounts[artist.user_id] || 0;

                return (
                  <Link
                    key={`${artist.user_id}-${isSearching ? 'search' : rotationKey}`}
                    to={`/artist/${artist.artist_slug}`}
                    className="group relative block"
                    style={{
                      animation: `fadeInUp 0.5s ease-out ${index * 0.04}s both`,
                    }}
                  >
                    {/* Neon glow on hover */}
                    <div className="absolute -inset-1 bg-gradient-to-br from-cyan-500/0 via-emerald-500/0 to-blue-500/0 rounded-2xl blur-lg group-hover:from-cyan-500/25 group-hover:via-emerald-500/15 group-hover:to-blue-500/25 transition-all duration-500 opacity-0 group-hover:opacity-100" />

                    <div className="relative overflow-hidden rounded-xl border border-cyan-500/20 bg-gradient-to-br from-[#0a1628]/90 to-[#071020]/90 backdrop-blur-sm transition-all duration-500 group-hover:scale-[1.03] group-hover:border-cyan-400/50 group-hover:shadow-[0_0_30px_rgba(34,211,238,0.2),0_0_60px_rgba(16,185,129,0.1)]">
                      {/* Top section: Profile image with overlay */}
                      <div className="relative h-44 sm:h-48 overflow-hidden">
                        <img
                          src={artist.profile_image_url || "/placeholder.svg"}
                          alt={artist.display_name || artist.artist_slug}
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                          loading="lazy"
                        />
                        {/* Multi-layer overlay */}
                        <div className="absolute inset-0 bg-gradient-to-t from-[#0a1628] via-[#0a1628]/40 to-transparent opacity-80 group-hover:opacity-90 transition-opacity duration-500" />

                        {/* Neon scan line on hover */}
                        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                          <div
                            className="absolute left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent"
                            style={{ animation: 'cardScan 2s linear infinite' }}
                          />
                        </div>

                        {/* Song count badge - top right */}
                        <div className="absolute top-3 right-3 z-10">
                          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60 border border-cyan-500/30 backdrop-blur-md shadow-[0_0_12px_rgba(34,211,238,0.2)]">
                            <Disc3 className="w-3.5 h-3.5 text-cyan-400" />
                            <span className="text-cyan-200 text-xs font-bold">{count}</span>
                            <span className="text-cyan-400/60 text-xs">{count === 1 ? 'song' : 'songs'}</span>
                          </div>
                        </div>

                        {/* Corner accents */}
                        <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-cyan-400/0 group-hover:border-cyan-400/60 rounded-tl-xl transition-all duration-500" />
                        <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-emerald-400/0 group-hover:border-emerald-400/60 rounded-tr-xl transition-all duration-500" />

                        {/* Artist name overlaid on image */}
                        <div className="absolute bottom-0 left-0 right-0 px-4 pb-3">
                          <p className="text-white font-bold text-base md:text-lg truncate transition-all duration-300 group-hover:text-cyan-100"
                            style={{
                              textShadow: '0 0 15px rgba(34,211,238,0.8), 0 2px 8px rgba(0,0,0,0.9)',
                            }}
                          >
                            {artist.display_name || artist.artist_slug}
                          </p>
                          {/* Neon underline */}
                          <div className="mt-1.5 h-[2px] w-0 group-hover:w-3/4 bg-gradient-to-r from-cyan-400 via-emerald-400 to-blue-400 transition-all duration-500 rounded-full shadow-[0_0_10px_rgba(34,211,238,0.6)]" />
                        </div>
                      </div>

                      {/* Bottom section: Genres */}
                      <div className="px-4 py-3">
                        {artistGenres.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {artistGenres.slice(0, 4).map((genre, gi) => (
                              <span
                                key={gi}
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-gradient-to-r backdrop-blur-sm ${getGenreColor(genre)}`}
                              >
                                {genre}
                              </span>
                            ))}
                            {artistGenres.length > 4 && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border border-white/10 bg-white/5 text-white/50">
                                +{artistGenres.length - 4}
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <Music className="w-3 h-3 text-cyan-500/40" />
                            <span className="text-cyan-400/40 text-[10px] font-medium italic">Genres not set</span>
                          </div>
                        )}
                      </div>

                      {/* Bottom corner accents */}
                      <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-emerald-400/0 group-hover:border-emerald-400/60 rounded-bl-xl transition-all duration-500" />
                      <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-cyan-400/0 group-hover:border-cyan-400/60 rounded-br-xl transition-all duration-500" />
                    </div>

                    {/* Outer glow ring */}
                    <div className="absolute inset-0 rounded-xl ring-1 ring-cyan-500/10 group-hover:ring-cyan-400/40 transition-all duration-500 pointer-events-none" />
                  </Link>
                );
              })}
            </div>
          )}

          {/* Info section */}
          <div className="mt-14 text-center">
            <div className="relative inline-block">
              {/* Glow behind card */}
              <div className="absolute -inset-2 bg-gradient-to-r from-cyan-500/10 via-emerald-500/10 to-blue-500/10 rounded-2xl blur-xl" />
              <Card className="relative p-6 bg-[#0a1628]/70 border-cyan-500/20 backdrop-blur-xl shadow-[0_0_30px_rgba(34,211,238,0.1)]">
                <div className="flex items-center justify-center gap-2 mb-3">
                  <div className="h-px w-8 bg-gradient-to-r from-transparent to-cyan-400/60" />
                  <Sparkles className="w-4 h-4 text-cyan-400/60" />
                  <div className="h-px w-8 bg-gradient-to-l from-transparent to-cyan-400/60" />
                </div>
                <p className="text-cyan-200/70 text-sm leading-relaxed">
                  Artists rotate automatically every 30 seconds.
                  <br />
                  Click on any artist to visit their profile and listen to their music.
                </p>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* ===== ANIMATIONS ===== */}
      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(24px) scale(0.96);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes spotlightSway {
          0%, 100% { transform: translateX(0) translateY(0); }
          25% { transform: translateX(40px) translateY(-20px); }
          50% { transform: translateX(-30px) translateY(15px); }
          75% { transform: translateX(20px) translateY(-10px); }
        }

        @keyframes floatUp {
          0%, 100% { transform: translateY(0) scale(1); opacity: 0.2; }
          50% { transform: translateY(-30px) scale(1.1); opacity: 0.3; }
        }

        @keyframes laserFlicker {
          0%, 100% { opacity: 0.3; }
          30% { opacity: 0.8; }
          50% { opacity: 0.1; }
          70% { opacity: 0.6; }
        }

        @keyframes scanLine {
          0% { top: -2px; }
          100% { top: 100%; }
        }

        @keyframes cardScan {
          0% { top: -2px; }
          100% { top: 100%; }
        }

        @keyframes pulseGlow {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }

        /* Stage lighting animations */
        @keyframes stageLightSway1 {
          0%, 100% { transform: rotate(-8deg); }
          50% { transform: rotate(12deg); }
        }

        @keyframes stageLightSway2 {
          0%, 100% { transform: rotate(6deg); }
          50% { transform: rotate(-10deg); }
        }

        @keyframes stageLightSway3 {
          0%, 100% { transform: rotate(-5deg); }
          30% { transform: rotate(8deg); }
          70% { transform: rotate(-12deg); }
        }

        @keyframes stageLightCenter {
          0%, 100% { transform: rotate(-2deg); }
          25% { transform: rotate(3deg); }
          50% { transform: rotate(-3deg); }
          75% { transform: rotate(2deg); }
        }

        @keyframes stageLightSway4 {
          0%, 100% { transform: rotate(7deg); }
          40% { transform: rotate(-9deg); }
          80% { transform: rotate(5deg); }
        }

        @keyframes stageLightSway5 {
          0%, 100% { transform: rotate(-10deg); }
          50% { transform: rotate(8deg); }
        }

        @keyframes stageLightSway6 {
          0%, 100% { transform: rotate(9deg); }
          35% { transform: rotate(-7deg); }
          65% { transform: rotate(11deg); }
        }

        @keyframes pulseLight {
          0%, 100% { opacity: 0.7; transform: scale(1) translateX(-50%); }
          50% { opacity: 1; transform: scale(1.3) translateX(-50%); }
        }

        @keyframes hazeShimmer {

          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }

        @keyframes fireFlicker {
          0% {
            backgroundImage: linear-gradient(0deg, #ff0000 0%, #ff4500 20%, #ff8c00 40%, #ffd700 60%, #ffff00 80%, #fff5a0 100%);
            filter: drop-shadow(0 0 6px rgba(255,69,0,0.8)) drop-shadow(0 0 18px rgba(255,140,0,0.6)) drop-shadow(0 0 40px rgba(255,0,0,0.4));
            transform: scale(1) translateY(0);
          }
          20% {
            filter: drop-shadow(0 0 10px rgba(255,69,0,1)) drop-shadow(0 0 25px rgba(255,165,0,0.8)) drop-shadow(0 0 50px rgba(255,0,0,0.5));
            transform: scale(1.01) translateY(-1px);
          }
          40% {
            filter: drop-shadow(0 0 4px rgba(255,69,0,0.6)) drop-shadow(0 0 14px rgba(255,140,0,0.5)) drop-shadow(0 0 35px rgba(255,0,0,0.3));
            transform: scale(0.99) translateY(0.5px);
          }
          60% {
            filter: drop-shadow(0 0 12px rgba(255,100,0,1)) drop-shadow(0 0 28px rgba(255,200,0,0.9)) drop-shadow(0 0 55px rgba(255,50,0,0.6));
            transform: scale(1.02) translateY(-1.5px);
          }
          80% {
            filter: drop-shadow(0 0 5px rgba(255,69,0,0.7)) drop-shadow(0 0 16px rgba(255,140,0,0.5)) drop-shadow(0 0 38px rgba(255,0,0,0.35));
            transform: scale(1) translateY(0);
          }
          100% {
            filter: drop-shadow(0 0 8px rgba(255,69,0,0.9)) drop-shadow(0 0 22px rgba(255,165,0,0.7)) drop-shadow(0 0 45px rgba(255,0,0,0.45));
            transform: scale(1.01) translateY(-0.5px);
          }
        }

        @keyframes fireGlow {
          0%, 100% {
            text-shadow: 0 0 4px rgba(255,100,0,0.4), 0 0 11px rgba(255,80,0,0.2), 0 -4px 20px rgba(255,50,0,0.15);
          }
          25% {
            text-shadow: 0 0 8px rgba(255,120,0,0.6), 0 0 20px rgba(255,80,0,0.35), 0 -6px 30px rgba(255,30,0,0.25);
          }
          50% {
            text-shadow: 0 0 6px rgba(255,150,0,0.5), 0 0 15px rgba(255,100,0,0.3), 0 -5px 25px rgba(255,60,0,0.2);
          }
          75% {
            text-shadow: 0 0 10px rgba(255,80,0,0.7), 0 0 24px rgba(255,60,0,0.4), 0 -8px 35px rgba(255,20,0,0.3);
          }
        }

        .fire-text-animated {
          position: relative;
          background-size: 100% 200%;
          animation: fireFlicker 1.5s ease-in-out infinite alternate, fireGlow 3s ease-in-out infinite, fireBackgroundShift 2s ease-in-out infinite alternate !important;
        }

        @keyframes fireBackgroundShift {
          0% {
            background-position: 0% 100%;
          }
          50% {
            background-position: 0% 60%;
          }
          100% {
            background-position: 0% 80%;
          }
        }
      `}</style>


    </div>
  );
};

export default FeaturedArtists;
