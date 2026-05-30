import React from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface AddMusicButtonProps {
  onAddMusic: () => void;
  onShowAuth: () => void;
  className?: string;
}

const AddMusicButton: React.FC<AddMusicButtonProps> = ({ onAddMusic, onShowAuth, className }) => {
  const { user } = useAuth();

  const handleClick = () => {
    if (user) {
      onAddMusic();
    } else {
      onShowAuth();
    }
  };

  return (
    <Button
      onClick={handleClick}
      variant="outline"
      size="sm"
      className={`bg-cyan-500/20 text-cyan-200 border-cyan-400 hover:bg-cyan-500/30 hover:border-cyan-300 text-xs ${className ?? ""}`}
    >
      <Plus className="w-3 h-3 mr-1" />
      Add Music
    </Button>
  );
};

export default AddMusicButton;