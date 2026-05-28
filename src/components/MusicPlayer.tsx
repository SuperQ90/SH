import React, { useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Play, Pause, SkipBack, SkipForward, Volume2, X } from 'lucide-react';
import { Track } from '@/types/music';
import { useIsMobile } from '@/hooks/use-mobile';

interface MusicPlayerProps {
  currentTrack: Track | null;
  isPlaying: boolean;
  onPlayPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
  progress: number;
  duration: number;
  volume: number;
  onVolumeChange: (volume: number) => void;
  onSeek: (position: number) => void;
  onClose?: () => void;
  isFeatured?: boolean;
}

const MusicPlayer: React.FC<MusicPlayerProps> = ({
  currentTrack,
  isPlaying,
  onPlayPause,
  onNext,
  onPrevious,
  progress,
  duration,
  volume,
  onVolumeChange,
  onSeek,
  onClose,
  isFeatured = false
}) => {
  const audioContextRef = useRef<AudioContext | null>(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    const initAudioContext = () => {
      if (!audioContextRef.current) {
        try {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
          if (audioContextRef.current.state === 'suspended') {
            audioContextRef.current.resume();
          }
        } catch (error) {
          console.error('Failed to initialize audio context:', error);
        }
      }
    };

    initAudioContext();
  }, []);

  const handlePlayPause = async () => {
    try {
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
      onPlayPause();
    } catch (error) {
      console.error('Error handling play/pause:', error);
      onPlayPause();
    }
  };

  if (!currentTrack) return null;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Use the provided image for featured songs
  const featuredImage = "https://d64gsuwffb70l.cloudfront.net/6855b7b44152a08ab0b05643_1752288778200_254c5606.png";

  const playerClass = isFeatured 
    ? "fixed bottom-0 left-0 right-0 p-2 bg-card border-t border-border z-50 neon-glow"
    : "fixed bottom-0 left-0 right-0 p-3 md:p-4 bg-card border-t border-border z-50 neon-glow";

  return (
    <Card className={playerClass}>
      {/* Mobile Layout */}
      {isMobile ? (
        <div className={`space-y-${isFeatured ? '2' : '3'}`}>
          {/* Track Info and Close Button */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3 flex-1 min-w-0">
              <div className={`${isFeatured ? 'w-8 h-8' : 'w-10 h-10'} bg-primary rounded-lg flex items-center justify-center neon-glow flex-shrink-0 overflow-hidden`}>
                {isFeatured ? (
                  <img src={featuredImage} alt="AI Music Radio" className="w-full h-full object-cover" />
                ) : (
                  <div className={`${isFeatured ? 'w-4 h-4' : 'w-6 h-6'} bg-slate-800 rounded`} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className={`text-foreground font-semibold neon-text ${isFeatured ? 'text-xs' : 'text-sm'} truncate`}>{currentTrack.title}</h3>
                <p className={`text-muted-foreground ${isFeatured ? 'text-xs' : 'text-xs'} truncate max-w-[120px] sm:max-w-none`}>{currentTrack.artist}</p>
              </div>
            </div>
            {onClose && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={onClose}
                className="text-foreground hover:bg-accent hover:text-red-400 flex-shrink-0"
                title="Close player"
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
          
          {/* Progress Bar */}
          <div className="flex items-center space-x-2">
            <span className="text-xs text-muted-foreground w-10 text-right">{formatTime(progress)}</span>
            <Slider
              value={[progress]}
              onValueChange={(value) => onSeek(value[0])}
              max={duration}
              step={1}
              className="flex-1"
            />
            <span className="text-xs text-muted-foreground w-10">{formatTime(duration)}</span>
          </div>
          
          {/* Controls */}
          <div className={`flex items-center justify-center space-x-${isFeatured ? '4' : '6'}`}>
            <Button variant="ghost" size="sm" onClick={onPrevious} className="text-foreground hover:bg-accent neon-glow">
              <SkipBack className={`${isFeatured ? 'w-4 h-4' : 'w-5 h-5'}`} />
            </Button>
            <Button 
              variant="ghost" 
              size={isFeatured ? "sm" : "lg"} 
              onClick={handlePlayPause} 
              className="text-foreground hover:bg-accent green-neon"
            >
              {isPlaying ? <Pause className={`${isFeatured ? 'w-5 h-5' : 'w-6 h-6'}`} /> : <Play className={`${isFeatured ? 'w-5 h-5' : 'w-6 h-6'}`} />}
            </Button>
            <Button variant="ghost" size="sm" onClick={onNext} className="text-foreground hover:bg-accent neon-glow">
              <SkipForward className={`${isFeatured ? 'w-4 h-4' : 'w-5 h-5'}`} />
            </Button>
          </div>
          
          {/* Volume Control */}
          <div className="flex items-center justify-center space-x-2">
            <Volume2 className="w-4 h-4 text-foreground" />
            <Slider
              value={[volume]}
              onValueChange={(value) => onVolumeChange(value[0])}
              max={100}
              step={1}
              className="w-24"
            />
          </div>
        </div>
      ) : (
        /* Desktop Layout */
        <>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className={`${isFeatured ? 'w-10 h-10' : 'w-12 h-12'} bg-primary rounded-lg flex items-center justify-center neon-glow overflow-hidden`}>
                {isFeatured ? (
                  <img src={featuredImage} alt="AI Music Radio" className="w-full h-full object-cover" />
                ) : (
                  <div className={`${isFeatured ? 'w-6 h-6' : 'w-8 h-8'} bg-slate-800 rounded`} />
                )}
              </div>
              <div>
                <h3 className={`text-foreground font-semibold neon-text ${isFeatured ? 'text-sm' : ''}`}>{currentTrack.title}</h3>
                <p className={`text-muted-foreground ${isFeatured ? 'text-xs' : 'text-sm'}`}>{currentTrack.artist}</p>
              </div>
              </div>
            
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="sm" onClick={onPrevious} className="text-foreground hover:bg-accent neon-glow">
                <SkipBack className="w-4 h-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handlePlayPause} 
                className="text-foreground hover:bg-accent green-neon"
              >
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
              </Button>
              <Button variant="ghost" size="sm" onClick={onNext} className="text-foreground hover:bg-accent neon-glow">
                <SkipForward className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex items-center space-x-2">
              <Volume2 className="w-4 h-4 text-foreground" />
              <Slider
                value={[volume]}
                onValueChange={(value) => onVolumeChange(value[0])}
                max={100}
                step={1}
                className="w-20"
              />
              {onClose && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={onClose}
                  className="text-foreground hover:bg-accent hover:text-red-400 ml-2"
                  title="Close player and return to genre search"
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
          
          <div className={`${isFeatured ? 'mt-2' : 'mt-3'} flex items-center space-x-2`}>
            <span className="text-xs text-muted-foreground">{formatTime(progress)}</span>
            <Slider
              value={[progress]}
              onValueChange={(value) => onSeek(value[0])}
              max={duration}
              step={1}
              className="flex-1"
            />
            <span className="text-xs text-muted-foreground">{formatTime(duration)}</span>
          </div>
        </>
      )}
    </Card>
  );
};

export default MusicPlayer;