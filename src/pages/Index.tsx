import React, { useState, useEffect } from "react";
import { Navigate, useSearchParams, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import Header from "@/components/Header";
import GenreSelector from "@/components/GenreSelector";
import SeparateSearchFields from "@/components/SeparateSearchFields";
import TrackList from "@/components/TrackList";
import Pagination from "@/components/Pagination";
import FeaturedSongs from "@/components/FeaturedSongs";
import DailyShowcase from "@/components/DailyShowcase";
import NewSongs from "@/components/NewSongs";
import AIMusicBattles from "@/components/AIMusicBattles";


import FeaturedSongsManager from "@/components/FeaturedSongsManager";
import TopGenreSongs from "@/components/TopGenreSongs";
import { Track, GENRES, type Genre } from "@/types/music";
import { useToast } from "@/hooks/use-toast";
import { useMusicData } from "@/hooks/useMusicData";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { formatUnderscores } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  AlertTriangle,
  RefreshCw,
  CheckCircle,
  Crown,
} from "lucide-react";

// Helper function to get initial tab based on URL path
const getInitialHomeTab = (pathname: string, urlTab: string | null): string => {
  if (pathname === '/featuredsongs') return 'featured';
  if (pathname === '/top20bygenre') return 'top-genre';
  if (urlTab === 'featured') return 'featured';
  return 'home';
};

const Index = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  
  // Get initial tab and song from URL parameters
  const urlTab = searchParams.get('tab');
  const urlSongId = searchParams.get('song');
  
  const [activeTab, setActiveTab] = useState("discover");
  const [homeTab, setHomeTab] = useState(() => getInitialHomeTab(location.pathname, urlTab));

  const [trackUpdates, setTrackUpdates] = useState<
    Record<string, Partial<Track>>
  >({});
  const [top40Songs, setTop40Songs] = useState<Track[]>([]);
  const [top40Loading, setTop40Loading] = useState(false);
  const [sharedSongId, setSharedSongId] = useState<string | null>(urlSongId);

  const { user, loading: authLoading, profile } = useAuth();
  const { toast } = useToast();
  const {
    tracks,
    likedTracks,
    selectedGenre,
    artistSearch,
    songSearch,
    loading,
    error,
    initialLoadComplete,
    currentPage,
    totalPages,
    SONGS_PER_PAGE,
    setSelectedGenre,
    setArtistSearch,
    setSongSearch,
    setCurrentPage,
    toggleLikeTrack,
    refreshUserSongs,
    getTotalFilteredSongs,
  } = useMusicData();


  useAutoRefresh(refreshUserSongs);

  // Listen for resetToHome event and reset all state
  useEffect(() => {
    const handleResetToHome = () => {
      console.log("Resetting Index component to home state");
      // Reset all filters and searches
      setActiveTab("discover"); // For authenticated users
      setHomeTab("home"); // For non-authenticated users
      setArtistSearch("");
      setSongSearch("");
      setSelectedGenre(null);
      setCurrentPage(1);
      // Clear any track updates
      setTrackUpdates({});
      // Navigate to home URL
      navigate('/', { replace: true });
    };


    window.addEventListener("resetToHome", handleResetToHome);
    return () => {
      window.removeEventListener("resetToHome", handleResetToHome);
    };
  }, [
    navigate,
    setArtistSearch,
    setSongSearch,
    setSelectedGenre,
    setCurrentPage,
  ]);


  const email = (user?.email || "").toLowerCase();
  const isPledge = email.endsWith("@pledge.ai");
  const {
    subscription_status: subStatus,
    role: profileRole,
    plan_source: planSource,
  } = profile || {};
  const isAdmin =
    email === "mrutter@gmail.com" ||
    isPledge ||
    profileRole === "admin";

  // New free = blocky
  const isNewFree =
    !isAdmin &&
    (subStatus === "free_new" || planSource === "auth_bootstrap");

  // Dummy handler for onPlayTrack - now handled by inline player
  const handlePlayTrack = (track: Track, playlist?: Track[], isFeatured = false) => {
    // No-op: playback is now handled by InlineAudioPlayer in TrackList
  };

  const handleArtistClick = (artist: string) => {
    setArtistSearch(artist);
    setActiveTab("discover");
    // Scroll down to the artist song list after search is triggered
    setTimeout(() => {
      const trackListElement = document.querySelector(".lg\\:col-span-3");
      if (trackListElement) {
        trackListElement.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
    }, 100);
  };

  // Load top 40 songs by play count (right now by created_at)
  const loadTop40Songs = async () => {
    setTop40Loading(true);
    try {
      const { data, error } = await supabase
        .from("songs")
        .select(
          "id, title, artist, genre, audio_url, user_id, duration, created_at, brand_url, cover_url, image_url, purchase_url"
        )
        .order("created_at", { ascending: false })
        .limit(40);

      if (error) throw error;

      const formattedSongs: Track[] = (data || []).map((song) => ({
        id: song.id,
        title: song.title || "Unknown Title",
        artist: song.artist || "Unknown Artist",
        genre: (song.genre as any) || "Other",
        duration: song.duration || 0,
        url: song.audio_url || "",
        user_id: song.user_id,
        brand_url: song.brand_url,
        image_url: song.image_url || song.cover_url || "/placeholder.svg",
        purchase_url: song.purchase_url,
      }));

      setTop40Songs(formattedSongs);
    } catch (error: any) {
      console.error("Error loading top 40 songs:", error);
      toast({
        title: "Error",
        description: `Error loading top 40 songs: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setTop40Loading(false);
    }
  };

  // Load top 40 songs once
  useEffect(() => {
    if (top40Songs.length === 0) {
      loadTop40Songs();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle tab change with URL navigation
  const handleHomeTabChange = (value: string) => {
    setHomeTab(value);
    // Navigate to the appropriate URL based on tab selection
    if (value === 'featured') {
      navigate('/featuredsongs', { replace: true });
    } else if (value === 'top-genre') {
      navigate('/top20bygenre', { replace: true });
    } else {
      navigate('/', { replace: true });
    }
  };

  const renderMainContent = () => (
    <div className="space-y-4">
      <Tabs
        value={homeTab}
        onValueChange={handleHomeTabChange}
        className="mb-4"
      >
        <TabsList className="grid w-full grid-cols-3 gap-1 justify-center">

          <TabsTrigger value="home" className="text-xs sm:text-sm text-[#39FF14] data-[state=active]:text-[#39FF14] data-[state=active]:bg-[#39FF14]/15 hover:text-[#39FF14]">
            Home
          </TabsTrigger>
          <TabsTrigger value="featured" className="text-xs sm:text-sm text-[#39FF14] data-[state=active]:text-[#39FF14] data-[state=active]:bg-[#39FF14]/15 hover:text-[#39FF14]">
            Featured Songs
          </TabsTrigger>
          <TabsTrigger value="top-genre" className="text-xs sm:text-sm text-[#39FF14] data-[state=active]:text-[#39FF14] data-[state=active]:bg-[#39FF14]/15 hover:text-[#39FF14]">
            Top 20
          </TabsTrigger>


        </TabsList>
        <TabsContent value="home">
          <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
              <div className="lg:col-span-1">
                <GenreSelector
                  selectedGenre={selectedGenre}
                  onGenreSelect={(genre) => setSelectedGenre(genre)}
                  onSongAdded={refreshUserSongs}
                />
              </div>

              <div className="lg:col-span-3">
                <div className="mb-4">
                  <SeparateSearchFields
                    onArtistSearch={setArtistSearch}
                    onSongSearch={setSongSearch}
                    onClear={() => {
                      setArtistSearch("");
                      setSongSearch("");
                    }}
                    artistSearchValue={artistSearch}
                    songSearchValue={songSearch}
                  />
                </div>
                <div className="rounded-xl border border-cyan-400/30 shadow-[0_0_10px_rgba(0,191,255,0.25)] p-4">
                  <DailyShowcase />
                </div>
                <div className="rounded-xl border border-cyan-400/30 shadow-[0_0_10px_rgba(0,191,255,0.25)] p-4">
                  <NewSongs />
                </div>
                <div className="rounded-xl border border-cyan-400/30 shadow-[0_0_10px_rgba(0,191,255,0.25)] p-4">
                  <AIMusicBattles />
                </div>



                <div className="mt-4">

                  <TrackList
                    tracks={tracks}
                    onPlayTrack={handlePlayTrack}
                    onLikeTrack={toggleLikeTrack}
                    likedTracks={likedTracks}
                    currentTrack={null}
                    onTrackDeleted={refreshUserSongs}
                    selectedGenre={selectedGenre}
                    onGenreSelect={(genre) => {
                      if ((GENRES as readonly string[]).includes(genre)) {
                        setSelectedGenre(genre as Genre);
                      }
                    }}
                    onSongAdded={refreshUserSongs}
                    onTrackUpdate={() => {}}
                    onArtistClick={handleArtistClick}
                    initialExpandedSongId={!urlTab ? urlSongId : null}
                  />

                  {totalPages > 1 && (
                    <div className="mt-6">
                      <Pagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        onPageChange={setCurrentPage}
                        totalItems={getTotalFilteredSongs()}
                        itemsPerPage={SONGS_PER_PAGE}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </TabsContent>
        <TabsContent value="featured">
          <div className="mb-1">
            <FeaturedSongs
              onPlayTrack={(track) =>
                handlePlayTrack(track, undefined, true)
              }
              onSongDeleted={refreshUserSongs}
              onArtistClick={handleArtistClick}
              initialSongId={sharedSongId}
            />
          </div>
        </TabsContent>

        <TabsContent value="top-genre">

          <TopGenreSongs
            onPlayTrack={handlePlayTrack}
            onLikeTrack={toggleLikeTrack}
            likedTracks={likedTracks}
            currentTrack={null}
            onArtistClick={handleArtistClick}
          />
        </TabsContent>
      </Tabs>
    </div>
  );

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header onSongAdded={refreshUserSongs} />
        <main className="min-h-screen">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-center p-8">
              <RefreshCw className="w-6 h-6 animate-spin mr-2" />
              <span>Loading...</span>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-blue-900 to-black relative overflow-hidden">
      {/* Cyberpunk background effects */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-400/10 via-green-400/10 to-cyan-400/10"></div>
        <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
        <div className="absolute top-3/4 right-1/4 w-1 h-1 bg-green-400 rounded-full animate-ping"></div>
        <div className="absolute top-1/2 right-1/3 w-1 h-1 bg-cyan-400 rounded-full animate-pulse"></div>
      </div>
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 via-green-400 to-cyan-400 animate-pulse"></div>
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
      <Header onSongAdded={refreshUserSongs} />
      <main className="min-h-screen relative z-10">
        <div className="container mx-auto px-4 py-4">
          {user && (
            <div className="mb-3 flex flex-col gap-2">
              <div className="p-3 bg-green-100 dark:bg-green-900 border border-green-300 dark:border-green-700 rounded-lg">
                <div className="flex items-center">
                  <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 mr-2" />
                  <p className="text-green-800 dark:text-green-200 text-sm">
                    <strong>Signed in as:</strong> {user.email}
                  </p>
                </div>
              </div>

              {/* plan banner */}
              {profile && (
                <div className="p-3 rounded-lg bg-slate-900/40 border border-slate-700/60 flex items-center justify-between gap-3">
                  <div className="text-sm">
                    <p className="text-slate-100">
                      Plan:{" "}
                      <span className="font-semibold">
                        {profile.subscription_status
                          ? formatUnderscores(profile.subscription_status)
                          : "free_legacy"}
                      </span>
                      {isAdmin && " (admin override)"}
                    </p>
                    {isNewFree && (
                      <p className="text-xs text-amber-100/80 mt-1">
                        Uploads are limited on this plan. Upgrade to unlock full
                        uploads.
                      </p>
                    )}
                  </div>
                  {isNewFree && (
                    <Button
                      asChild
                      size="sm"
                      className="bg-amber-500 text-amber-950 hover:bg-amber-600"
                    >
                      <a href="/pricing" className="flex items-center gap-1">
                        <Crown className="w-4 h-4" />
                        Upgrade
                      </a>
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="mb-3 p-3 bg-red-100 dark:bg-red-900 border border-red-300 dark:border-red-700 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 mr-2" />
                  <div>
                    <p className="text-red-800 dark:text-red-200 font-medium text-sm">
                      Connection Error
                    </p>
                    <p className="text-red-700 dark:text-red-300 text-xs">
                      {error}
                    </p>
                  </div>
                </div>
                <Button onClick={refreshUserSongs} variant="outline" size="sm">
                  Retry
                </Button>
              </div>
            </div>
          )}

          {user ? (
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="mb-4"
            >
              <TabsList className="gap-3">
                <TabsTrigger value="discover" className="bg-[#00BFFF]/30 text-[#39FF14] border border-[#00BFFF] hover:bg-[#00BFFF]/50 hover:border-[#00BFFF] hover:text-[#39FF14] shadow-[0_0_10px_rgba(0,191,255,0.4)] data-[state=active]:bg-[#00BFFF]/50 data-[state=active]:text-[#39FF14]">All Songs</TabsTrigger>
                <TabsTrigger value="top-genre" className="bg-[#00BFFF]/30 text-[#39FF14] border border-[#00BFFF] hover:bg-[#00BFFF]/50 hover:border-[#00BFFF] hover:text-[#39FF14] shadow-[0_0_10px_rgba(0,191,255,0.4)] data-[state=active]:bg-[#00BFFF]/50 data-[state=active]:text-[#39FF14]">Top 20</TabsTrigger>
                <TabsTrigger value="playlists" className="bg-[#00BFFF]/30 text-[#39FF14] border border-[#00BFFF] hover:bg-[#00BFFF]/50 hover:border-[#00BFFF] hover:text-[#39FF14] shadow-[0_0_10px_rgba(0,191,255,0.4)] data-[state=active]:bg-[#00BFFF]/50 data-[state=active]:text-[#39FF14]">My Playlists</TabsTrigger>
              </TabsList>




              <TabsContent value="discover">
                {renderMainContent()}
              </TabsContent>

              <TabsContent value="top-genre">
                <TopGenreSongs
                  onPlayTrack={handlePlayTrack}
                  onLikeTrack={toggleLikeTrack}
                  likedTracks={likedTracks}
                  currentTrack={null}
                  onArtistClick={handleArtistClick}
                />
              </TabsContent>

              <TabsContent value="playlists">
                {/* Immediate client-side redirect using React Router */}
                <Navigate to="/playlists" replace />
              </TabsContent>

              {isAdmin && (
                <TabsContent value="featured">
                  <FeaturedSongsManager />
                </TabsContent>
              )}
            </Tabs>
          ) : (
            renderMainContent()
          )}
        </div>
      </main>
    </div>
  );
};

export default Index;
