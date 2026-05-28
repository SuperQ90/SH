import React, { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Play, Pause, Headphones, RefreshCw, X } from 'lucide-react';
import { Track } from '@/types/music';
import { supabase } from '@/lib/supabase';
import { DeleteSongButton } from './DeleteSongButton';
import InlineAudioPlayer from './InlineAudioPlayer';
import ShareButton from './ShareButton';
import { AddToPlaylistButton } from './AddToPlaylistButton';
import NewSongBadge from './NewSongBadge';


interface FeaturedSongsProps {
  onPlayTrack: (track: Track) => void;
  onSongDeleted?: () => void;
  onArtistClick?: (artist: string) => void;
  initialSongId?: string | null;
}

interface SongWithArtist extends Track {
  artist_slug?: string;
  display_name?: string;
}

export const FeaturedSongs: React.FC<FeaturedSongsProps> = ({ onPlayTrack, onSongDeleted, onArtistClick, initialSongId }) => {
  const [allSongs, setAllSongs] = useState<SongWithArtist[]>([]);
  const [displayedSongs, setDisplayedSongs] = useState<SongWithArtist[]>([]);
  const [loading, setLoading] = useState(true);
  const [rotationKey, setRotationKey] = useState(0);
  const [expandedSongId, setExpandedSongId] = useState<string | null>(null);
  const [autoPlayTriggered, setAutoPlayTriggered] = useState(false);
  const [initialSongProcessed, setInitialSongProcessed] = useState(false);

  const fetchSongsFromArtistsWithProfiles = async () => {
    try {
      setLoading(true);
      
      // First, get all artists with profiles
      const { data: artists, error: artistError } = await supabase
        .from('artist_public_profiles')
        .select('user_id, display_name, artist_slug, profile_image_url')
        .not('profile_image_url', 'is', null)
        .neq('profile_image_url', '');

      if (artistError || !artists || artists.length === 0) {
        console.error('Error fetching artists:', artistError);
        setAllSongs([]);
        setLoading(false);
        return;
      }

      // Get user_ids of artists with profiles
      const artistUserIds = artists.map(a => a.user_id);

      // Fetch songs from these artists that have images
      const { data: songs, error: songsError } = await supabase
        .from('songs')
        .select('id, title, artist, genre, audio_url, cover_url, image_url, brand_url, purchase_url, duration, created_at, user_id')
        .in('user_id', artistUserIds)
        .not('image_url', 'is', null)
        .neq('image_url', '');

      if (songsError || !songs) {
        console.error('Error fetching songs:', songsError);
        setAllSongs([]);
        setLoading(false);
        return;
      }

      // Create a map of user_id to artist info
      const artistMap = new Map(artists.map(a => [a.user_id, { 
        artist_slug: a.artist_slug, 
        display_name: a.display_name 
      }]));

      // Combine songs with artist info
      const songsWithArtist: SongWithArtist[] = songs.map(song => {
        const artistInfo = artistMap.get(song.user_id);
        return {
          ...song,
          url: song.audio_url,
          image_url: song.image_url || song.cover_url,
          purchase_url: song.purchase_url || song.brand_url,
          artist_slug: artistInfo?.artist_slug,
          display_name: artistInfo?.display_name
        } as SongWithArtist;
      });

      setAllSongs(songsWithArtist);
    } catch (error) {
      console.error('Error fetching featured songs:', error);
      setAllSongs([]);
    } finally {
      setLoading(false);
    }
  };

  // Shuffle and select 32 random songs from multiple genres
  // If initialSongId is provided and not yet processed, ensure that song is included
  const shuffleSongs = useCallback((forceIncludeSongId?: string | null) => {
    if (allSongs.length === 0) return;

    // Group songs by genre
    const songsByGenre = new Map<string, SongWithArtist[]>();
    allSongs.forEach(song => {
      const genre = song.genre || 'Unknown';
      if (!songsByGenre.has(genre)) {
        songsByGenre.set(genre, []);
      }
      songsByGenre.get(genre)!.push(song);
    });

    // Get all genres and shuffle them
    const genres = Array.from(songsByGenre.keys()).sort(() => Math.random() - 0.5);
    
    const selected: SongWithArtist[] = [];
    const usedSongIds = new Set<string>();
    
    // If we need to include a specific song, add it first
    if (forceIncludeSongId) {
      const targetSong = allSongs.find(s => s.id === forceIncludeSongId);
      if (targetSong) {
        selected.push(targetSong);
        usedSongIds.add(targetSong.id);
      }
    }
    
    // Try to get songs from different genres for variety
    let genreIndex = 0;
    while (selected.length < 32 && genreIndex < genres.length * 3) {
      const genre = genres[genreIndex % genres.length];
      const genreSongs = songsByGenre.get(genre) || [];
      
      // Shuffle songs within this genre
      const shuffledGenreSongs = [...genreSongs].sort(() => Math.random() - 0.5);
      
      // Find a song from this genre that hasn't been used
      for (const song of shuffledGenreSongs) {
        if (!usedSongIds.has(song.id)) {
          selected.push(song);
          usedSongIds.add(song.id);
          break;
        }
      }
      
      genreIndex++;
    }

    // If we still need more songs, just add random ones
    if (selected.length < 32) {
      const remainingSongs = allSongs.filter(s => !usedSongIds.has(s.id));
      const shuffledRemaining = remainingSongs.sort(() => Math.random() - 0.5);
      for (const song of shuffledRemaining) {
        if (selected.length >= 32) break;
        selected.push(song);
      }
    }

    // Final shuffle to mix genres (but keep the target song if it exists)
    const finalSelection = selected.sort(() => Math.random() - 0.5);
    setDisplayedSongs(finalSelection);
    setRotationKey(prev => prev + 1);
    
    // Only close expanded song when manually shuffling (not on initial load with song param)
    if (!forceIncludeSongId) {
      setExpandedSongId(null);
    }
  }, [allSongs]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    fetchSongsFromArtistsWithProfiles();
  }, []);

  // Initial shuffle when songs are loaded
  useEffect(() => {
    if (allSongs.length > 0 && !initialSongProcessed) {
      // If there's an initial song ID, include it in the shuffle
      if (initialSongId) {
        shuffleSongs(initialSongId);
      } else {
        shuffleSongs();
      }
    } else if (allSongs.length > 0 && initialSongProcessed) {
      // Normal shuffle after initial load
      shuffleSongs();
    }
  }, [allSongs]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle initial song expansion from URL parameter
  useEffect(() => {
    if (initialSongId && displayedSongs.length > 0 && !initialSongProcessed) {
      const songExists = displayedSongs.find(s => s.id === initialSongId);
      if (songExists) {
        setExpandedSongId(initialSongId);
        setAutoPlayTriggered(false); // Don't auto-play, just expand and show ready to play
        setInitialSongProcessed(true);
        
        // Scroll to the player after a short delay
        setTimeout(() => {
          const playerElement = document.querySelector('[data-featured-player]');
          if (playerElement) {
            playerElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 300);
      } else {
        // Song not in current display, try to find it in all songs
        const songInAll = allSongs.find(s => s.id === initialSongId);
        if (songInAll && !initialSongProcessed) {
          // Re-shuffle to include this song
          shuffleSongs(initialSongId);
        }
        setInitialSongProcessed(true);
      }
    }
  }, [initialSongId, displayedSongs, allSongs, initialSongProcessed, shuffleSongs]);

  const handleSongDeleted = () => {
    fetchSongsFromArtistsWithProfiles();
    onSongDeleted?.();
  };

  const handlePlayClick = (song: SongWithArtist) => {
    // Always switch to the new song, even if another is playing
    // This allows overriding the currently playing song
    if (expandedSongId === song.id) {
      // If clicking on the same song, close it
      setExpandedSongId(null);
      setAutoPlayTriggered(false);
    } else {
      // Switch to the new song - this will stop the old one and start the new one
      setExpandedSongId(song.id);
      setAutoPlayTriggered(true);
    }
  };

  const handleClosePlayer = () => {
    setExpandedSongId(null);
    setAutoPlayTriggered(false);
  };

  // Handle when a song ends - advance to next song in the list
  const handleSongEnded = () => {
    const currentIndex = displayedSongs.findIndex(s => s.id === expandedSongId);
    if (currentIndex !== -1 && currentIndex < displayedSongs.length - 1) {
      // There's a next song, advance to it
      const nextSong = displayedSongs[currentIndex + 1];
      setExpandedSongId(nextSong.id);
      setAutoPlayTriggered(true);
      
      // Scroll to the player
      setTimeout(() => {
        const playerElement = document.querySelector('[data-featured-player]');
        if (playerElement) {
          playerElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    }
  };

  // Handle skip to next song
  const handleSkipNext = () => {
    handleSongEnded();
  };

  // Check if there's a next song
  const hasNextSong = () => {
    const currentIndex = displayedSongs.findIndex(s => s.id === expandedSongId);
    return currentIndex !== -1 && currentIndex < displayedSongs.length - 1;
  };

  const handleManualShuffle = () => {
    setInitialSongProcessed(true); // Mark as processed so we don't re-expand the initial song
    shuffleSongs();
  };

  const getExpandedSong = () => {
    return displayedSongs.find(song => song.id === expandedSongId);
  };


  if (loading) {
    return (
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Headphones className="w-4 h-4 text-cyan-400" />
            Featured Songs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-2">
            <p className="text-muted-foreground text-sm">Loading featured songs...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (displayedSongs.length === 0) {
    return null;
  }

  const expandedSong = getExpandedSong();

  return (
    <div className="relative">
      {/* Neon/Cyberpunk Lighting Effects */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full">
          <div className="absolute top-4 left-0 w-full h-px bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent shadow-[0_0_10px_#00ffff] animate-[pulse_3s_ease-in-out_infinite]"></div>
          <div className="absolute top-12 left-0 w-full h-px bg-gradient-to-r from-transparent via-magenta-400/60 to-transparent shadow-[0_0_10px_#ff00ff] animate-[pulse_4s_ease-in-out_infinite]"></div>
          <div className="absolute left-1/4 top-0 w-px h-full bg-gradient-to-b from-transparent via-purple-400/40 to-transparent shadow-[0_0_8px_#8b5cf6] animate-[pulse_2.5s_ease-in-out_infinite]"></div>
          <div className="absolute right-1/3 top-0 w-px h-full bg-gradient-to-b from-transparent via-cyan-400/40 to-transparent shadow-[0_0_8px_#00ffff] animate-[pulse_3.5s_ease-in-out_infinite]"></div>
        </div>
        
        <div className="absolute top-0 left-0 w-2 h-full bg-gradient-to-b from-transparent via-cyan-300/80 to-transparent shadow-[0_0_20px_#00ffff] animate-[slideRight_6s_linear_infinite] transform-gpu"></div>
        
        <div className="absolute top-2 left-2 w-8 h-8 border-l-2 border-t-2 border-cyan-400/60 shadow-[0_0_15px_#00ffff] animate-[pulse_2s_ease-in-out_infinite]"></div>
        <div className="absolute top-2 right-2 w-8 h-8 border-r-2 border-t-2 border-magenta-400/60 shadow-[0_0_15px_#ff00ff] animate-[pulse_2.5s_ease-in-out_infinite]"></div>
        
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-purple-900/10 via-transparent to-cyan-900/10 animate-[pulse_5s_ease-in-out_infinite] transform-gpu"></div>
      </div>

      <Card className="mb-8">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Headphones className="w-4 h-4 text-cyan-400" />
              Featured Songs
            </CardTitle>
            <Button
              onClick={handleManualShuffle}
              variant="outline"
              size="sm"
              className="border-purple-400/30 bg-black/40 hover:bg-black/60 text-purple-200 shadow-[0_0_12px_rgba(168,85,247,0.25)] backdrop-blur"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Shuffle
            </Button>
          </div>

        </CardHeader>
        <CardContent>
          {/* Expanded Song Inline Player */}
          {expandedSong && (
            <div className="mb-6 animate-in slide-in-from-top-2 duration-300" data-featured-player>
              <div className="relative bg-gradient-to-r from-slate-900/90 to-slate-800/90 rounded-xl p-4 border border-cyan-500/30 shadow-[0_0_30px_rgba(0,212,255,0.2)]">
                {/* Close button */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClosePlayer}
                  className="absolute top-2 right-2 h-8 w-8 p-0 text-gray-400 hover:text-white hover:bg-white/10 rounded-full z-10"
                >
                  <X className="w-4 h-4" />
                </Button>

                {/* Song info header */}
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-16 h-16 rounded-lg overflow-hidden border border-cyan-500/30 shadow-[0_0_15px_rgba(0,255,136,0.3)] flex-shrink-0">
                    {expandedSong.image_url ? (
                      <img
                        src={expandedSong.image_url}
                        alt={expandedSong.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-500/20 to-pink-500/20">
                        <Headphones className="w-6 h-6 text-muted-foreground/50" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 pr-8">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-white truncate text-lg" title={expandedSong.title}>
                        {expandedSong.title}
                      </h3>
                      <NewSongBadge createdAt={expandedSong.created_at} />
                    </div>

                    <div className="flex items-center gap-2">
                      {expandedSong.artist_slug ? (
                        <Link 
                          to={`/artist/${expandedSong.artist_slug}`}
                          className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors truncate"
                        >
                          {expandedSong.artist}
                        </Link>
                      ) : (
                        <button 
                          onClick={() => onArtistClick?.(expandedSong.artist)}
                          className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors truncate bg-transparent border-none p-0 cursor-pointer"
                        >
                          {expandedSong.artist}
                        </button>
                      )}
                      <span className="text-xs px-2 py-0.5 bg-green-500/20 text-green-400 rounded-full border border-green-500/30">
                        {expandedSong.genre}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Inline Audio Player with Waveform - key forces remount when song changes */}
                <InlineAudioPlayer
                  key={expandedSong.id}
                  audioUrl={expandedSong.audio_url || expandedSong.url || ''}
                  title={expandedSong.title}
                  artist={expandedSong.artist}
                  songId={expandedSong.id}
                  autoPlay={autoPlayTriggered}
                  hasNextTrack={hasNextSong()}
                  onSkipNext={handleSkipNext}
                  onEnded={handleSongEnded}
                  onPlay={() => setAutoPlayTriggered(false)}
                />

                {/* Action buttons row */}
                <div className="flex items-center gap-2 mt-4 pt-3 border-t border-white/10">
                  <AddToPlaylistButton 
                    songId={expandedSong.id} 
                    songTitle={expandedSong.title} 
                  />
                  <ShareButton 
                    songId={expandedSong.id} 
                    title={expandedSong.title} 
                    artist={expandedSong.artist}
                    shareContext="featured"
                  />
                </div>

              </div>
            </div>
          )}

          <div 


            key={rotationKey}
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3"
          >
            {displayedSongs.map((song, index) => {
              const isExpanded = expandedSongId === song.id;
              
              return (
                <div 
                  key={`${song.id}-${rotationKey}`} 
                  className={`group relative ${isExpanded ? 'ring-2 ring-cyan-400 ring-offset-2 ring-offset-slate-900 rounded-lg' : ''}`}
                  style={{
                    animation: `fadeInUp 0.5s ease-out ${index * 0.03}s both`,
                  }}
                >
                  <div className={`aspect-square bg-muted rounded-lg overflow-hidden mb-2 relative border transition-all duration-300 group-hover:scale-105 group-hover:shadow-xl group-hover:shadow-purple-500/20 ${
                    isExpanded 
                      ? 'border-cyan-400 shadow-[0_0_25px_rgba(0,255,255,0.6)]' 
                      : 'border-cyan-400/30 shadow-[0_0_15px_rgba(0,255,255,0.4),inset_0_0_15px_rgba(139,92,246,0.2)] group-hover:border-purple-400/50'
                  }`}>
                    {song.image_url ? (
                      <img
                        src={song.image_url}
                        alt={song.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-500/20 to-pink-500/20">
                        <Headphones className="w-8 h-8 text-muted-foreground/50" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                      <Button
                        size="sm"
                        onClick={() => handlePlayClick(song)}
                        className={`w-10 h-10 p-0 rounded-full transition-all ${
                          isExpanded 
                            ? 'bg-gradient-to-r from-cyan-500 to-green-500 hover:from-cyan-400 hover:to-green-400 text-white shadow-[0_0_20px_rgba(0,255,136,0.6)]' 
                            : 'bg-white/20 hover:bg-white/30 text-white border-white/30'
                        }`}
                      >
                        {isExpanded ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                      </Button>
                    </div>
                    <div className="absolute top-1 right-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <ShareButton 
                        songId={song.id} 
                        title={song.title} 
                        artist={song.artist}
                        shareContext="featured"
                        className="h-6 w-6 p-0 bg-black/60 hover:bg-black/80 rounded-full"
                      />
                      <DeleteSongButton track={song} onDeleted={handleSongDeleted} />
                    </div>

                    <div className="absolute bottom-1 left-1">
                      <span className="text-[8px] px-1.5 py-0.5 bg-black/70 text-green-400 rounded font-semibold truncate max-w-[80px] block" style={{textShadow: '0 0 10px #4ade80'}}>
                        {song.genre}
                      </span>
                    </div>
                    {/* Playing indicator */}
                    {isExpanded && (
                      <div className="absolute top-1 left-1">
                        <div className="flex items-center gap-0.5 px-1.5 py-0.5 bg-black/70 rounded">
                          <div className="w-1 h-3 bg-cyan-400 rounded-full animate-pulse"></div>
                          <div className="w-1 h-4 bg-green-400 rounded-full animate-pulse" style={{ animationDelay: '0.1s' }}></div>
                          <div className="w-1 h-2 bg-cyan-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="text-center px-1">
                    <div className="flex items-center justify-center gap-1 mb-0.5">
                      <h3 className="font-medium text-xs truncate" title={song.title}>
                        {song.title}
                      </h3>
                      <NewSongBadge createdAt={song.created_at} />
                    </div>

                    {song.artist_slug ? (
                      <Link 
                        to={`/artist/${song.artist_slug}`}
                        className="text-[10px] text-muted-foreground truncate hover:text-cyan-400 transition-colors block"
                        title={`View ${song.artist}'s profile`}
                      >
                        {song.artist}
                      </Link>
                    ) : (
                      <button 
                        onClick={() => onArtistClick?.(song.artist)}
                        className="text-[10px] text-muted-foreground truncate hover:text-green-400 transition-colors cursor-pointer bg-transparent border-none p-0 block w-full"
                        title="View all songs by this artist"
                      >
                        {song.artist}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* CSS for animations */}
      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
};

export default FeaturedSongs;
