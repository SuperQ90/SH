import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Volume2, 
  Download,
  Heart,
  Radio,
  Shuffle,
  Repeat,
  ListMusic
} from 'lucide-react';

interface AIRadioPlayerProps {
  currentTrack: any;
  isPlaying: boolean;
  onPlayPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
  progress: number;
  duration: number;
  volume: number;
  onVolumeChange: (value: number) => void;
  onSeek: (value: number) => void;
  onDownload: () => void;
  onToggleLike: () => void;
  isLiked: boolean;
}

const AIRadioPlayer: React.FC<AIRadioPlayerProps> = ({
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
  onDownload,
  onToggleLike,
  isLiked
}) => {
  const [showQueue, setShowQueue] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState(false);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!currentTrack) {
    return (
      <Card className="fixed bottom-0 left-0 right-0 bg-black/90 backdrop-blur-xl border-t border-white/10 p-6">
        <div className="flex items-center justify-center gap-4">
          <Radio className="w-8 h-8 text-cyan-400 animate-pulse" />
          <p className="text-gray-400">Select a genre to start your AI radio experience</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="fixed bottom-0 left-0 right-0 bg-black/90 backdrop-blur-xl border-t border-white/10 p-4 z-50">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-3 gap-4 items-center">
          {/* Track Info */}
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-purple-600 to-cyan-600 rounded-lg flex items-center justify-center">
              <Radio className="w-8 h-8 text-white" />
            </div>
            <div>
              <h4 className="text-white font-semibold line-clamp-1">
                {currentTrack.title}
              </h4>
              <p className="text-gray-400 text-sm">
                {currentTrack.artist} • AI Generated
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleLike}
              className={`${isLiked ? 'text-red-500' : 'text-gray-400'} hover:text-red-500`}
            >
              <Heart className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`} />
            </Button>
          </div>

          {/* Player Controls */}
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShuffle(!shuffle)}
                className={`${shuffle ? 'text-cyan-400' : 'text-gray-400'} hover:text-white`}
              >
                <Shuffle className="w-4 h-4" />
              </Button>
              
              <Button
                variant="ghost"
                size="icon"
                onClick={onPrevious}
                className="text-white hover:text-cyan-400"
              >
                <SkipBack className="w-5 h-5" />
              </Button>
              
              <Button
                onClick={onPlayPause}
                size="icon"
                className="w-12 h-12 bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700 text-white"
              >
                {isPlaying ? (
                  <Pause className="w-6 h-6" />
                ) : (
                  <Play className="w-6 h-6 ml-0.5" />
                )}
              </Button>
              
              <Button
                variant="ghost"
                size="icon"
                onClick={onNext}
                className="text-white hover:text-cyan-400"
              >
                <SkipForward className="w-5 h-5" />
              </Button>
              
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setRepeat(!repeat)}
                className={`${repeat ? 'text-cyan-400' : 'text-gray-400'} hover:text-white`}
              >
                <Repeat className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="flex items-center gap-2 w-full max-w-md">
              <span className="text-xs text-gray-400 w-10 text-right">
                {formatTime(progress)}
              </span>
              <Slider
                value={[progress]}
                max={duration || 100}
                step={1}
                onValueChange={(value) => onSeek(value[0])}
                className="flex-1"
              />
              <span className="text-xs text-gray-400 w-10">
                {formatTime(duration)}
              </span>
            </div>
          </div>

          {/* Volume & Actions */}
          <div className="flex items-center justify-end gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowQueue(!showQueue)}
              className="text-gray-400 hover:text-white"
            >
              <ListMusic className="w-5 h-5" />
            </Button>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={onDownload}
              className="text-gray-400 hover:text-cyan-400"
            >
              <Download className="w-5 h-5" />
            </Button>
            
            <div className="flex items-center gap-2">
              <Volume2 className="w-5 h-5 text-gray-400" />
              <Slider
                value={[volume * 100]}
                max={100}
                step={1}
                onValueChange={(value) => onVolumeChange(value[0] / 100)}
                className="w-24"
              />
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default AIRadioPlayer;