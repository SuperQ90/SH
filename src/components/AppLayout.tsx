import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useMusicData } from '@/hooks/useMusicData';
import { useMusicPlayer } from '@/hooks/useMusicPlayer';
import { useNavigate, useLocation } from 'react-router-dom';
import HeroSection from './HeroSection';
import AIRadioFeatures from './AIRadioFeatures';
import GenreGrid from './GenreGrid';
import AIRadioPlayer from './AIRadioPlayer';
import AIFooter from './AIFooter';
import TrackList from './TrackList';
import { AuthModal } from './AuthModal';
import { AddSongModal } from './AddSongModal';
import ProfileModal from './ProfileModal';
import { Button } from '@/components/ui/button';
import { Radio, User, Plus, LogOut, Music, Heart, ListMusic } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

const AppLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showAddSongModal, setShowAddSongModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showHero, setShowHero] = useState(true);
  
  const { user, signOut } = useAuth();
  const {
    tracks,
    likedTracks,
    selectedGenre,
    setSelectedGenre,
    toggleLikeTrack,
    refreshUserSongs
  } = useMusicData();
  
  const {
    currentTrack,
    isPlaying,
    progress,
    duration,
    volume,
    playTrack,
    togglePlayPause,
    playNext,
    playPrevious,
    seekTo,
    setVolume,
    downloadTrack
  } = useMusicPlayer();

  // Check if we should open auth modal from navigation state
  useEffect(() => {
    if (location.state?.openAuthModal) {
      setShowAuthModal(true);
      // Clear the state so it doesn't trigger again
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  const handleStartListening = () => {
    setShowHero(false);
    if (!selectedGenre) {
      setSelectedGenre('Electronic');
    }
  };

  const handleGenreSelect = (genre: string) => {
    setSelectedGenre(genre);
    setShowHero(false);
  };

  const handlePlayTrack = (track: any) => {
    playTrack(track, tracks);
  };

  const isLiked = currentTrack ? likedTracks.includes(currentTrack.id) : false;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-black/80 backdrop-blur-xl border-b border-white/10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img 
                src="https://d64gsuwffb70l.cloudfront.net/68e68f5d71ba149dddd30364_1760034468563_9ee7b2c8.webp"
                alt="Hey it's Music"
                className="h-12 w-auto cursor-pointer"
                onClick={() => setShowHero(true)}
              />
              <div className="hidden md:block">
                <h1 className="text-xl font-bold text-white">Hey it's Music</h1>
                <p className="text-xs text-cyan-400">The AI Radio Station</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <Button
                onClick={() => navigate('/top-liked')}
                variant="outline"
                className="border-pink-400/50 text-pink-400 hover:bg-pink-400/10"
              >
                <Heart className="w-4 h-4 mr-2" />
                Top Liked
              </Button>

              {user && (
                <Button
                  onClick={() => navigate('/my-likes')}
                  variant="outline"
                  className="border-purple-400/50 text-purple-400 hover:bg-purple-400/10"
                >
                  <Heart className="w-4 h-4 mr-2 fill-purple-400" />
                  My Likes
                </Button>
              )}

              <Button
                onClick={() => navigate('/playlists')}
                variant="outline"
                className="border-green-400/50 text-green-400 hover:bg-green-400/10"
              >
                <ListMusic className="w-4 h-4 mr-2" />
                Playlists
              </Button>
              
              {user && (
                <Button
                  onClick={() => setShowAddSongModal(true)}
                  variant="outline"
                  className="border-cyan-400/50 text-cyan-400 hover:bg-cyan-400/10"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Music
                </Button>
              )}
              
              {user ? (
                <div className="flex items-center gap-3">
                  <Avatar 
                    className="cursor-pointer border-2 border-cyan-400/50"
                    onClick={() => setShowProfileModal(true)}
                  >
                    <AvatarFallback className="bg-gradient-to-br from-purple-600 to-cyan-600 text-white">
                      {user.email?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <Button
                    onClick={signOut}
                    variant="ghost"
                    size="icon"
                    className="text-gray-400 hover:text-white"
                  >
                    <LogOut className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <Button 
                  onClick={() => setShowAuthModal(true)}
                  className="bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700"
                >
                  <User className="w-4 h-4 mr-2" />
                  Sign In
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 pb-32 min-h-screen">
        {showHero ? (
          <>
            <HeroSection 
              onStartListening={handleStartListening}
              onOpenAuth={() => setShowAuthModal(true)}
              isAuthenticated={!!user}
            />
            <AIRadioFeatures />
            <GenreGrid 
              selectedGenre={selectedGenre}
              onGenreSelect={handleGenreSelect}
            />
          </>
        ) : (
          <div className="space-y-8">
            <GenreGrid 
              selectedGenre={selectedGenre}
              onGenreSelect={handleGenreSelect}
            />
            
            {selectedGenre && (
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <Music className="w-6 h-6 text-cyan-400" />
                  <h2 className="text-2xl font-bold text-white">
                    {selectedGenre} Station • Now Playing
                  </h2>
                </div>
                <TrackList
                  tracks={tracks}
                  onPlayTrack={handlePlayTrack}
                  onDownloadTrack={downloadTrack}
                  onLikeTrack={toggleLikeTrack}
                  likedTracks={likedTracks}
                  currentTrack={currentTrack}
                  onTrackDeleted={refreshUserSongs}
                />
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <AIFooter />

      {/* Player */}
      <AIRadioPlayer
        currentTrack={currentTrack}
        isPlaying={isPlaying}
        onPlayPause={togglePlayPause}
        onNext={playNext}
        onPrevious={playPrevious}
        progress={progress}
        duration={duration}
        volume={volume}
        onVolumeChange={setVolume}
        onSeek={seekTo}
        onDownload={() => currentTrack && downloadTrack(currentTrack)}
        onToggleLike={() => currentTrack && toggleLikeTrack(currentTrack.id)}
        isLiked={isLiked}
      />

      {/* Modals */}
      <AuthModal 
        isOpen={showAuthModal} 
        onClose={() => setShowAuthModal(false)} 
      />
      
      {user && (
        <>
          <AddSongModal 
            isOpen={showAddSongModal} 
            onClose={() => setShowAddSongModal(false)}
            onSongAdded={refreshUserSongs}
          />
          <ProfileModal
            isOpen={showProfileModal}
            onClose={() => setShowProfileModal(false)}
            profile={null}
            onSaveProfile={() => {}}
          />
        </>
      )}
    </div>
  );
};

export default AppLayout;