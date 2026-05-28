import * as React from "react";
import { Button } from "@/components/ui/button";
import { UserPlus, UserCheck, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  getArtistFollowerCount,
  isFollowingArtist,
  toggleArtistFollow,
} from "@/lib/follows";
import { emitNotificationsChanged } from "@/lib/notifications";

interface FollowArtistButtonProps {
  artistUserId: string;
  /** Hide when viewing your own artist page */
  className?: string;
  onFollowersCountChange?: (count: number) => void;
}

const FollowArtistButton: React.FC<FollowArtistButtonProps> = ({
  artistUserId,
  className,
  onFollowersCountChange,
}) => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [following, setFollowing] = React.useState(false);
  const [followersCount, setFollowersCount] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [toggling, setToggling] = React.useState(false);

  const isOwnProfile = user?.id === artistUserId;

  React.useEffect(() => {
    let active = true;

    (async () => {
      setLoading(true);
      try {
        const [count, isFollowing] = await Promise.all([
          getArtistFollowerCount(artistUserId),
          user ? isFollowingArtist(artistUserId) : Promise.resolve(false),
        ]);
        if (!active) return;
        setFollowersCount(count);
        setFollowing(isFollowing);
        onFollowersCountChange?.(count);
      } catch (err) {
        console.error("[FollowArtistButton] load failed:", err);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [artistUserId, user?.id]);

  const onToggle = async () => {
    if (!user) {
      toast({
        title: "Please sign in",
        description: "You need to be logged in to follow an artist.",
      });
      return;
    }

    if (isOwnProfile || toggling) return;

    setToggling(true);
    const prevFollowing = following;
    const prevCount = followersCount;

    setFollowing(!prevFollowing);
    setFollowersCount(
      prevFollowing ? Math.max(0, prevCount - 1) : prevCount + 1
    );

    try {
      const result = await toggleArtistFollow(artistUserId);
      setFollowing(result.action === "followed");
      setFollowersCount(result.followers_count);
      onFollowersCountChange?.(result.followers_count);
      if (result.action === "followed") {
        emitNotificationsChanged();
      }
    } catch (err: unknown) {
      setFollowing(prevFollowing);
      setFollowersCount(prevCount);
      const message =
        err instanceof Error ? err.message : "Unable to update follow";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setToggling(false);
    }
  };

  if (isOwnProfile) {
    return (
      <div className={className}>
        <span className="text-sm text-muted-foreground tabular-nums">
          {loading ? "…" : `${followersCount.toLocaleString()} followers`}
        </span>
      </div>
    );
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className ?? ""}`}>
      <Button
        type="button"
        variant={following ? "secondary" : "default"}
        size="sm"
        onClick={onToggle}
        disabled={loading || toggling}
        className={
          following
            ? "border-cyan-500/40 bg-cyan-950/40 text-cyan-200"
            : "bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-white"
        }
      >
        {toggling ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : following ? (
          <UserCheck className="w-4 h-4 mr-2" />
        ) : (
          <UserPlus className="w-4 h-4 mr-2" />
        )}
        {following ? "Following" : "Follow"}
      </Button>
      <span className="text-sm text-muted-foreground tabular-nums">
        {loading ? "…" : `${followersCount.toLocaleString()} followers`}
      </span>
    </div>
  );
};

export default FollowArtistButton;
