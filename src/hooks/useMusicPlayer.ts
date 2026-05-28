import { useState, useRef, useEffect } from 'react';
import { Track } from '@/types/music';
import { toast } from '@/components/ui/use-toast';
import { recordPlay } from '@/lib/plays';

export const useMusicPlayer = () => {
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [volume, setVolume] = useState(50);
  const [playlist, setPlaylist] = useState<Track[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [duration, setDuration] = useState(0);
  const [autoPlay, setAutoPlay] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isLoadingRef = useRef(false);

  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.volume = volume / 100;
      audioRef.current.preload = 'auto';
      audioRef.current.crossOrigin = 'anonymous';
    }
    
    const audio = audioRef.current;
    
    const handleEnded = () => {
      setIsPlaying(false);
      if (autoPlay && playlist.length > 1 && currentIndex < playlist.length - 1) {
        playNext();
      }
    };
    
    const handleLoadedMetadata = () => {
      setDuration(audio.duration || 180);
    };
    
    const handleTimeUpdate = () => {
      setProgress(audio.currentTime);
    };
    
    const handleError = (e: Event) => {
      console.error('Audio error:', e);
      setIsPlaying(false);
      isLoadingRef.current = false;
      toast({
        title: "Playback Error",
        description: "Unable to play this track. Please try another song.",
        variant: "destructive"
      });
    };
    
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('error', handleError);
    
    return () => {
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('error', handleError);
    };
  }, [autoPlay, playlist.length, currentIndex]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume / 100;
    }
  }, [volume]);

  const playTrack = async (track: Track, trackList: Track[] = []) => {
    if (isLoadingRef.current) return;
    
    try {
      isLoadingRef.current = true;
      
      if (audioRef.current) {
        audioRef.current.pause();
        setIsPlaying(false);
      }
      
      // Use the track's URL or audio_url
      const audioUrl = track.url || track.audio_url;
      if (!audioUrl) {
        console.warn('No audio URL available for track:', track.title);
        toast({
          title: "Track Unavailable",
          description: `"${track.title}" by ${track.artist} is not available for playback.`,
          variant: "destructive"
        });
        return;
      }
      
      if (audioRef.current) {
        audioRef.current.src = audioUrl;
        audioRef.current.load();
        
        await new Promise((resolve, reject) => {
          const handleCanPlay = () => {
            audioRef.current?.removeEventListener('canplay', handleCanPlay);
            audioRef.current?.removeEventListener('error', handleError);
            resolve(void 0);
          };
          
          const handleError = () => {
            audioRef.current?.removeEventListener('canplay', handleCanPlay);
            audioRef.current?.removeEventListener('error', handleError);
            reject(new Error('Audio load failed'));
          };
          
          audioRef.current?.addEventListener('canplay', handleCanPlay);
          audioRef.current?.addEventListener('error', handleError);
        });
        
        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          await playPromise;
        }
      }
      
      setCurrentTrack(track);
      setPlaylist(trackList);
      const newIndex = trackList.findIndex(t => t.id === track.id);
      setCurrentIndex(newIndex >= 0 ? newIndex : 0);
      setIsPlaying(true);
      setProgress(0);
      setDuration(track.duration || 180);
      
      // Record the play in the database (fire-and-forget)
      if (track.id) {
        recordPlay(track.id, 0, 0);
      }
      
      toast({
        title: "Now Playing",
        description: `${track.title} by ${track.artist}`,
      });
    } catch (error) {
      console.error('Playback error:', error);
      setIsPlaying(false);
      toast({
        title: "Playback Error",
        description: "Unable to play this track. Please try another song.",
        variant: "destructive"
      });
    } finally {
      isLoadingRef.current = false;
    }
  };

  const playPlaylist = async (tracks: Track[]) => {
    if (tracks.length > 0) {
      setAutoPlay(true);
      await playTrack(tracks[0], tracks);
    }
  };

  const togglePlayPause = async () => {
    if (isLoadingRef.current) return;
    
    if (currentTrack && audioRef.current) {
      try {
        if (isPlaying) {
          audioRef.current.pause();
          setIsPlaying(false);
        } else {
          const playPromise = audioRef.current.play();
          if (playPromise !== undefined) {
            await playPromise;
          }
          setIsPlaying(true);
        }
      } catch (error) {
        console.error('Play/pause error:', error);
        setIsPlaying(false);
        toast({
          title: "Playback Error",
          description: "Unable to play this track.",
          variant: "destructive"
        });
      }
    }
  };

  const playNext = async () => {
    if (playlist.length > 0) {
      const nextIndex = (currentIndex + 1) % playlist.length;
      const nextTrack = playlist[nextIndex];
      await playTrack(nextTrack, playlist);
    }
  };

  const playPrevious = async () => {
    if (playlist.length > 0) {
      const prevIndex = currentIndex > 0 ? currentIndex - 1 : playlist.length - 1;
      const prevTrack = playlist[prevIndex];
      await playTrack(prevTrack, playlist);
    }
  };

  const seekTo = (position: number) => {
    if (currentTrack && audioRef.current) {
      audioRef.current.currentTime = position;
      setProgress(position);
    }
  };

  const stopAndClear = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    
    setCurrentTrack(null);
    setIsPlaying(false);
    setProgress(0);
    setDuration(0);
    setPlaylist([]);
    setCurrentIndex(0);
    setAutoPlay(true);
  };

  return {
    currentTrack,
    isPlaying,
    progress,
    duration,
    volume,
    playlist,
    playTrack,
    playPlaylist,
    togglePlayPause,
    playNext,
    playPrevious,
    seekTo,
    setVolume,
    stopAndClear
  };
};