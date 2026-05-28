// src/components/InlineAudioPlayer.tsx
import React, { useRef, useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Play, Pause, Volume2, VolumeX, Share2, Check, SkipForward } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";

interface InlineAudioPlayerProps {
  audioUrl: string;
  title: string;
  artist: string;
  songId?: string;
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
  autoPlay?: boolean;
  hasNextTrack?: boolean;
  onSkipNext?: () => void;
}

const InlineAudioPlayer: React.FC<InlineAudioPlayerProps> = ({
  audioUrl,
  title,
  artist,
  songId,
  onPlay,
  onPause,
  onEnded,
  autoPlay = false,
  hasNextTrack = false,
  onSkipNext,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const animationRef = useRef<number | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const [isMuted, setIsMuted] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [copied, setCopied] = useState(false);

  const { toast } = useToast();

  // Format time as mm:ss
  const formatTime = (time: number) => {
    if (isNaN(time) || !isFinite(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  // Handle share button click
  const handleShare = async () => {
    if (!songId) {
      toast({
        title: "Unable to share",
        description: "Song ID is not available",
        variant: "destructive",
      });
      return;
    }

// Generate the shareable URL
// IMPORTANT:
// Social / chat link preview bots generally DO NOT execute JS.
// That means a Vite SPA route like /song/:id will not produce OG meta tags for previews
// unless you serve a server-rendered HTML page at that URL.
//
// Fast, non-breaking approach:
// - If VITE_SONG_SHARE_URL_BASE is set, we assume it points to a small HTML endpoint
//   (e.g., a Supabase Edge Function) that returns OG meta tags + redirects humans to the SPA.
// - Otherwise, fall back to the current SPA route.
const ogBase = (import.meta as any).env?.VITE_SONG_SHARE_URL_BASE as string | undefined;
const shareUrl = ogBase
  ? `${ogBase}${ogBase.includes('?') ? '&' : '?'}song_id=${encodeURIComponent(songId)}`
  : `${window.location.origin}/song/${songId}`;


    try {
      // Try to use the Web Share API first (mobile-friendly)
      if (navigator.share) {
        await navigator.share({
          title: `${title} by ${artist}`,
          text: `Listen to "${title}" by ${artist} on aimusicradio.io`,
          url: shareUrl,
        });
        toast({
          title: "Shared successfully!",
          description: "The song link has been shared",
        });
      } else {
        // Fall back to clipboard copy
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        toast({
          title: "Link copied!",
          description: "The song link has been copied to your clipboard",
        });
        
        // Reset copied state after 2 seconds
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (error: any) {
      // If share was cancelled or failed, try clipboard
      if (error.name !== 'AbortError') {
        try {
          await navigator.clipboard.writeText(shareUrl);
          setCopied(true);
          toast({
            title: "Link copied!",
            description: "The song link has been copied to your clipboard",
          });
          setTimeout(() => setCopied(false), 2000);
        } catch (clipboardError) {
          toast({
            title: "Unable to share",
            description: "Could not copy the link to clipboard",
            variant: "destructive",
          });
        }
      }
    }
  };


  // Initialize audio context and analyser
  const initializeAudio = useCallback(() => {
    if (isInitialized || !audioRef.current) return;

    try {
      // Create audio context
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;

      const audioContext = new AudioContextClass();
      audioContextRef.current = audioContext;

      // Create analyser node
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      analyserRef.current = analyser;

      // Connect audio element to analyser
      const source = audioContext.createMediaElementSource(audioRef.current);
      sourceRef.current = source;
      source.connect(analyser);
      analyser.connect(audioContext.destination);

      setIsInitialized(true);
    } catch (error) {
      console.error("Failed to initialize audio context:", error);
    }
  }, [isInitialized]);

  // Draw waveform visualization
  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      if (!isPlaying) {
        // Draw static waveform when paused
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawStaticWaveform(ctx, canvas.width, canvas.height);
        return;
      }

      animationRef.current = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);

      // Clear canvas with transparent background
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / bufferLength) * 2.5;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height * 0.9;

        // Create gradient from neon blue to neon green
        const gradient = ctx.createLinearGradient(0, canvas.height, 0, canvas.height - barHeight);
        gradient.addColorStop(0, "rgba(0, 212, 255, 0.9)"); // Neon blue
        gradient.addColorStop(0.5, "rgba(0, 255, 136, 0.9)"); // Neon green
        gradient.addColorStop(1, "rgba(0, 255, 200, 0.9)"); // Cyan-green

        ctx.fillStyle = gradient;

        // Draw bar with rounded top
        const barX = x;
        const barY = canvas.height - barHeight;
        const radius = Math.min(barWidth / 2, 3);

        ctx.beginPath();
        ctx.moveTo(barX + radius, barY);
        ctx.lineTo(barX + barWidth - radius, barY);
        ctx.quadraticCurveTo(barX + barWidth, barY, barX + barWidth, barY + radius);
        ctx.lineTo(barX + barWidth, canvas.height);
        ctx.lineTo(barX, canvas.height);
        ctx.lineTo(barX, barY + radius);
        ctx.quadraticCurveTo(barX, barY, barX + radius, barY);
        ctx.closePath();
        ctx.fill();

        // Add glow effect
        ctx.shadowColor = "rgba(0, 255, 136, 0.5)";
        ctx.shadowBlur = 10;

        x += barWidth + 1;
      }

      // Reset shadow
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
    };

    draw();
  }, [isPlaying]);

  // Draw static waveform when paused
  const drawStaticWaveform = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const bars = 64;
    const barWidth = (width / bars) * 0.8;
    const gap = (width / bars) * 0.2;

    for (let i = 0; i < bars; i++) {
      // Create a wave pattern
      const normalizedPosition = i / bars;
      const waveHeight = Math.sin(normalizedPosition * Math.PI * 3) * 0.3 + 0.2;
      const barHeight = height * waveHeight;

      // Create gradient
      const gradient = ctx.createLinearGradient(0, height, 0, height - barHeight);
      gradient.addColorStop(0, "rgba(0, 212, 255, 0.4)"); // Neon blue (dimmed)
      gradient.addColorStop(1, "rgba(0, 255, 136, 0.4)"); // Neon green (dimmed)

      ctx.fillStyle = gradient;

      const x = i * (barWidth + gap);
      ctx.fillRect(x, height - barHeight, barWidth, barHeight);
    }
  };

  // Handle play/pause
  const togglePlayPause = async () => {
    if (!audioRef.current) return;

    // Initialize audio context on first interaction
    if (!isInitialized) {
      initializeAudio();
    }

    // Resume audio context if suspended
    if (audioContextRef.current?.state === "suspended") {
      await audioContextRef.current.resume();
    }

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      onPause?.();
    } else {
      try {
        await audioRef.current.play();
        setIsPlaying(true);
        onPlay?.();
      } catch (error) {
        console.error("Playback failed:", error);
      }
    }
  };

  // Handle seek
  const handleSeek = (value: number[]) => {
    if (!audioRef.current) return;
    const newTime = (value[0] / 100) * duration;
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  // Handle volume change
  const handleVolumeChange = (value: number[]) => {
    if (!audioRef.current) return;
    const newVolume = value[0] / 100;
    setVolume(newVolume);
    audioRef.current.volume = newVolume;
    setIsMuted(newVolume === 0);
  };

  // Toggle mute
  const toggleMute = () => {
    if (!audioRef.current) return;
    if (isMuted) {
      audioRef.current.volume = volume || 0.7;
      setIsMuted(false);
    } else {
      audioRef.current.volume = 0;
      setIsMuted(true);
    }
  };

  // Update time display
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => setDuration(audio.duration);
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      // Call the onEnded callback to trigger next track
      onEnded?.();
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [onEnded]);

  // Start/stop waveform animation
  useEffect(() => {
    if (isPlaying && isInitialized) {
      drawWaveform();
    } else if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      // Draw static waveform when paused
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          drawStaticWaveform(ctx, canvas.width, canvas.height);
        }
      }
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, isInitialized, drawWaveform]);

  // Draw initial static waveform
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        drawStaticWaveform(ctx, canvas.width, canvas.height);
      }
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        // Don't close the context as it may be shared
      }
    };
  }, []);

  // Auto-play if requested
  useEffect(() => {
    if (autoPlay && audioRef.current) {
      togglePlayPause();
    }
  }, [autoPlay]);

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="w-full bg-gradient-to-r from-slate-900/80 to-slate-800/80 rounded-lg p-3 border border-cyan-500/20 shadow-[0_0_15px_rgba(0,212,255,0.15)]">
      {/* Hidden audio element */}
      <audio ref={audioRef} src={audioUrl} preload="metadata" crossOrigin="anonymous" />

      {/* Waveform visualization */}
      <div className="relative w-full h-16 mb-3 rounded-md overflow-hidden bg-slate-900/50">
        <canvas
          ref={canvasRef}
          width={400}
          height={64}
          className="w-full h-full"
          style={{ imageRendering: "pixelated" }}
        />
        {/* Glow overlay */}
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-cyan-500/5 to-transparent" />
      </div>

      {/* Controls row */}
      <div className="flex items-center gap-3">
        {/* Play/Pause button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={togglePlayPause}
          className="h-10 w-10 p-0 rounded-full bg-gradient-to-r from-cyan-500 to-green-500 hover:from-cyan-400 hover:to-green-400 text-white shadow-[0_0_20px_rgba(0,255,136,0.4)]"
        >
          {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
        </Button>

        {/* Skip to next track button */}
        {hasNextTrack && onSkipNext && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onSkipNext}
            className="h-8 w-8 p-0 rounded-full text-cyan-400 hover:text-green-400 hover:bg-cyan-500/20 transition-all"
            title="Skip to next track"
          >
            <SkipForward className="w-4 h-4" />
          </Button>
        )}

        {/* Progress section */}
        <div className="flex-1 min-w-0">
          {/* Time display */}
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-cyan-400 font-mono">{formatTime(currentTime)}</span>
            <span className="text-green-400 font-mono">{formatTime(duration)}</span>
          </div>

          {/* Progress bar */}
          <Slider
            value={[progressPercent]}
            onValueChange={handleSeek}
            max={100}
            step={0.1}
            className="w-full cursor-pointer [&_[role=slider]]:bg-gradient-to-r [&_[role=slider]]:from-cyan-400 [&_[role=slider]]:to-green-400 [&_[role=slider]]:border-0 [&_[role=slider]]:shadow-[0_0_10px_rgba(0,255,136,0.6)] [&_.bg-primary]:bg-gradient-to-r [&_.bg-primary]:from-cyan-500 [&_.bg-primary]:to-green-500"
          />
        </div>

        {/* Share button */}
        {songId && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleShare}
            className={`h-8 w-8 p-0 rounded-full transition-all duration-300 ${
              copied 
                ? 'text-green-400 bg-green-500/20 hover:bg-green-500/30' 
                : 'text-cyan-400 hover:text-green-400 hover:bg-cyan-500/20'
            }`}
            title="Share this song"
          >
            {copied ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
          </Button>
        )}

        {/* Volume controls */}
        <div className="hidden sm:flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleMute}
            className="h-8 w-8 p-0 text-cyan-400 hover:text-green-400 hover:bg-transparent"
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </Button>
          <Slider
            value={[isMuted ? 0 : volume * 100]}
            onValueChange={handleVolumeChange}
            max={100}
            step={1}
            className="w-20 cursor-pointer [&_[role=slider]]:bg-cyan-400 [&_[role=slider]]:border-0 [&_.bg-primary]:bg-cyan-500/50"
          />
        </div>
      </div>
    </div>
  );
};

export default InlineAudioPlayer;
