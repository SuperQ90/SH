import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Heart } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

type ToggleLikeResult = {
  action: 'liked' | 'unliked';
  likes_count: number;
};

interface LikeButtonProps {
  songId: string;
  initialCount: number;
}

const LikeButton: React.FC<LikeButtonProps> = ({ songId, initialCount }) => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [count, setCount] = React.useState<number>(initialCount ?? 0);
  const [liked, setLiked] = React.useState<boolean>(false);
  const [loading, setLoading] = React.useState<boolean>(false);

  // On mount, check if this user already liked the song
  React.useEffect(() => {
    let active = true;
    (async () => {
      if (!user) {
        setLiked(false);
        return;
      }
      const { data, error, status } = await supabase
        .from('likes')
        .select('id')
        .eq('song_id', songId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (!active) return;

      // status 406 (no rows) is not an error for maybeSingle
      if (error && status !== 406) {
        // We'll silently ignore here to avoid noisy UI
        return;
      }
      setLiked(!!data);
    })();
    return () => {
      active = false;
    };
  }, [songId, user]);

  const onToggle = async () => {
    if (!user) {
      toast({
        title: 'Please sign in',
        description: 'You need to be logged in to like a song.',
      });
      return;
    }

    if (loading) return;
    setLoading(true);

    try {
      const { data, error } = await supabase
        .rpc('toggle_like', { p_song_id: songId }) as unknown as {
          data: ToggleLikeResult[] | null;
          error: any;
        };

      if (error) throw error;

      // The function returns one row with action + likes_count
      const result = data?.[0];
      if (result) {
        setCount(Number(result.likes_count) || 0);
        setLiked(result.action === 'liked');
      }
    } catch (err: any) {
      const message =
        err?.message || (typeof err === 'string' ? err : 'Unable to update like');
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0 text-foreground hover:bg-accent neon-glow"
        onClick={onToggle}
        disabled={loading}
        aria-label={liked ? 'Unlike' : 'Like'}
      >
        <Heart
          className={`w-3 h-3 transition-colors ${
            liked ? 'text-red-500' : 'text-foreground'
          }`}
          // simple fill when liked
          fill={liked ? 'currentColor' : 'none'}
        />
      </Button>
      <span className="text-xs text-muted-foreground tabular-nums">{count}</span>
    </div>
  );
};

export default LikeButton;
