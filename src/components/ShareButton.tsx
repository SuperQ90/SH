// src/components/ShareButton.tsx
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Share2, Check, Copy, Link } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface ShareButtonProps {
  songId: string;
  title: string;
  artist: string;
  variant?: "ghost" | "outline" | "default";
  size?: "sm" | "default" | "lg" | "icon";
  className?: string;
  shareContext?: "featured" | "general"; // Kept for backwards compatibility but not used
}

const ShareButton: React.FC<ShareButtonProps> = ({
  songId,
  title,
  artist,
  variant = "ghost",
  size = "sm",
  className = "",
}) => {
  const [copied, setCopied] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();

  // Generate the shareable URL - always use the dedicated song page for reliability
  const getShareUrl = () => {
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
    if (ogBase) {
      const joiner = ogBase.includes("?") ? "&" : "?";
      return `${ogBase}${joiner}song_id=${encodeURIComponent(songId)}`;
    }

    const baseUrl = window.location.origin;
    return `${baseUrl}/song/${songId}`;
  };

  const handleCopyLink = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    
    const shareUrl = getShareUrl();

    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast({
        title: "Link copied!",
        description: "The song link has been copied to your clipboard",
      });
      
      // Reset copied state after 2 seconds
      setTimeout(() => {
        setCopied(false);
        setIsOpen(false);
      }, 1500);
    } catch (error) {
      toast({
        title: "Unable to copy",
        description: "Could not copy the link to clipboard",
        variant: "destructive",
      });
    }
  };

  const handleNativeShare = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    
    const shareUrl = getShareUrl();

    try {
      await navigator.share({
        title: `${title} by ${artist}`,
        text: `Listen to "${title}" by ${artist} on aimusicradio.io`,
        url: shareUrl,
      });
      toast({
        title: "Shared successfully!",
        description: "The song link has been shared",
      });
      setIsOpen(false);
    } catch (error: any) {
      // If share was cancelled, don't show error
      if (error.name !== 'AbortError') {
        // Fall back to copy
        handleCopyLink();
      }
    }
  };

  const handleQuickShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    // On mobile with native share support, use that
    if (navigator.share) {
      handleNativeShare(e);
    } else {
      // On desktop, show the popover with copy option
      setIsOpen(true);
    }
  };

  const shareUrl = getShareUrl();

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={variant}
          size={size}
          onClick={handleQuickShare}
          className={`transition-all duration-300 ${
            copied 
              ? 'text-green-400 bg-green-500/20 hover:bg-green-500/30' 
              : 'text-cyan-400 hover:text-green-400 hover:bg-cyan-500/20'
          } ${className}`}
          title="Share this song"
        >
          {copied ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-80 p-4 bg-slate-900/95 border-cyan-500/30 backdrop-blur-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <h4 className="font-medium text-white flex items-center gap-2">
              <Link className="w-4 h-4 text-cyan-400" />
              Share Song
            </h4>
            <p className="text-sm text-gray-400">
              Share "{title}" by {artist}
            </p>
          </div>
          
          {/* URL Display */}
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-slate-800/80 rounded-lg px-3 py-2 text-sm text-gray-300 truncate border border-slate-700">
              {shareUrl}
            </div>
            <Button
              size="sm"
              onClick={handleCopyLink}
              className={`shrink-0 transition-all ${
                copied 
                  ? 'bg-green-500 hover:bg-green-600 text-white' 
                  : 'bg-cyan-500 hover:bg-cyan-600 text-white'
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 mr-1" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-1" />
                  Copy
                </>
              )}
            </Button>
          </div>

          {/* Native Share Button (if available) */}
          {navigator.share && (
            <Button
              variant="outline"
              className="w-full border-purple-500/30 hover:border-purple-500/50 text-purple-400 hover:text-purple-300"
              onClick={handleNativeShare}
            >
              <Share2 className="w-4 h-4 mr-2" />
              Share via...
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default ShareButton;
