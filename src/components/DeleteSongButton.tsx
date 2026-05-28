import React from 'react';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { Track } from '@/types/music';

interface DeleteSongButtonProps {
  track: Track;
  onDeleted: () => void;
}

export const DeleteSongButton: React.FC<DeleteSongButtonProps> = ({ track, onDeleted }) => {
  const { user } = useAuth();
  const { toast } = useToast();

  const canDelete = () => {
    if (!user) return false;
    // Admin can delete any song
    if (user.email === 'mrutter@gmail.com') return true;
    // Users can delete their own songs
    return track.user_id === user.id;
  };

  const handleDelete = async () => {
    if (!user) {
      toast({ 
        title: 'Sign in required', 
        description: 'Please sign in to delete songs.',
        variant: 'destructive' 
      });
      return;
    }

    if (!canDelete()) {
      toast({ 
        title: 'Permission denied', 
        description: 'You can only delete your own songs.',
        variant: 'destructive' 
      });
      return;
    }
    
    try {
      const { error } = await supabase
        .from('songs')
        .delete()
        .eq('id', track.id);
      
      if (error) throw error;
      
      toast({ 
        title: 'Song deleted', 
        description: 'The song has been successfully deleted.' 
      });
      onDeleted();
    } catch (error: any) {
      toast({ 
        title: 'Error', 
        description: error.message, 
        variant: 'destructive' 
      });
    }
  };

  if (!canDelete()) {
    return null;
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleDelete}
      className="h-8 w-8 p-0 text-red-400 hover:bg-red-500/10"
      title={user?.email === 'mrutter@gmail.com' ? 'Delete song (Admin)' : 'Delete your song'}
    >
      <Trash2 className="w-3 h-3" />
    </Button>
  );
};