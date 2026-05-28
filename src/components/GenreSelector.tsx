import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { GENRES, Genre } from '@/types/music';
import { Users } from 'lucide-react';
import AddMusicButton from './AddMusicButton';
import { AddSongModal } from './AddSongModal';
import { AuthModal } from './AuthModal';

interface GenreSelectorProps {
  selectedGenre: Genre | null;
  onGenreSelect: (genre: Genre) => void;
  onSongAdded?: () => void;
  compact?: boolean;
}

const GenreSelector: React.FC<GenreSelectorProps> = ({ selectedGenre, onGenreSelect, onSongAdded, compact = false }) => {
  const [showAddSongModal, setShowAddSongModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const navigate = useNavigate();

  const handleAddMusic = () => {
    setShowAddSongModal(true);
  };

  const handleShowAuth = () => {
    setShowAuthModal(true);
  };

  const handleSongAdded = () => {
    setShowAddSongModal(false);
    onSongAdded?.();
  };

  const handleFeaturedArtists = () => {
    navigate('/featured-artists');
  };

  if (compact) {
    return (
      <>
        <Select
          value={selectedGenre || ''}
          onValueChange={(value) => {
            if (value && GENRES.includes(value as Genre)) {
              onGenreSelect(value as Genre);
            }
          }}
        >
          <SelectTrigger className="bg-white/10 text-white border-white/20 hover:bg-white/20 hover:border-cyan-400 focus:border-cyan-400 px-2 py-1 h-6 w-20 text-xs">
            <SelectValue placeholder="Genre" />
          </SelectTrigger>
          <SelectContent className="bg-gray-900 border-gray-700">
            {GENRES.map((genre) => (
              <SelectItem
                key={genre}
                value={genre}
                className="text-white hover:bg-white/10 focus:bg-white/10"
              >
                {genre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <AddMusicButton 
            onAddMusic={handleAddMusic}
            onShowAuth={handleShowAuth}
          />
          <Button
            onClick={handleFeaturedArtists}
            variant="outline"
            size="sm"
            className="animate-pulse bg-[#00BFFF]/30 text-[#39FF14] border-[#00BFFF] hover:bg-[#00BFFF]/50 hover:border-[#00BFFF] hover:text-[#39FF14] text-xs shadow-[0_0_10px_rgba(0,191,255,0.4)]"
          >
            <Users className="w-3 h-3 mr-1" />
            Featured Artists
          </Button>

        </div>
        <h2 className="text-sm font-normal text-orange-400">Select Genre</h2>
      </div>

      
      <div className="w-full max-w-xs">
        <Select
          value={selectedGenre || ''}
          onValueChange={(value) => {
            if (value && GENRES.includes(value as Genre)) {
              onGenreSelect(value as Genre);
            }
          }}
        >
          <SelectTrigger className="bg-white/10 text-white border-white/20 hover:bg-white/20 hover:border-cyan-400 focus:border-cyan-400 px-2 py-1 h-8">
            <SelectValue placeholder="Choose a genre..." />
          </SelectTrigger>
          <SelectContent className="bg-gray-900 border-gray-700">
            {GENRES.map((genre) => (
              <SelectItem
                key={genre}
                value={genre}
                className="text-white hover:bg-white/10 focus:bg-white/10"
              >
                {genre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      {selectedGenre && (
        <div className="flex items-center space-x-2">
          <span className="text-cyan-200 text-sm">Selected:</span>
          <Badge variant="secondary" className="bg-cyan-500/20 text-cyan-200 text-xs px-2 py-1">
            {selectedGenre}
          </Badge>
        </div>
      )}

      <AddSongModal
        isOpen={showAddSongModal}
        onClose={() => setShowAddSongModal(false)}
        onSongAdded={handleSongAdded}
      />

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
      />
    </div>
  );
};

export default GenreSelector;