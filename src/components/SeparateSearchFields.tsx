import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, X } from 'lucide-react';

interface SeparateSearchFieldsProps {
  onArtistSearch: (artist: string) => void;
  onSongSearch: (song: string) => void;
  onClear: () => void;
  artistSearchValue: string;
  songSearchValue: string;
}

const SeparateSearchFields: React.FC<SeparateSearchFieldsProps> = ({
  onArtistSearch,
  onSongSearch,
  onClear,
  artistSearchValue,
  songSearchValue
}) => {
  const [artistInput, setArtistInput] = useState(artistSearchValue);
  const [songInput, setSongInput] = useState(songSearchValue);

  const handleArtistSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onArtistSearch(artistInput.trim());
  };

  const handleArtistChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setArtistInput(e.target.value);
  };

  const handleSongChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSongInput(e.target.value);
    onSongSearch(e.target.value);
  };

  const handleClearArtist = () => {
    setArtistInput('');
    onClear();
  };

  const handleClearSong = () => {
    setSongInput('');
    onClear();
  };

  React.useEffect(() => {
    setArtistInput(artistSearchValue);
  }, [artistSearchValue]);

  React.useEffect(() => {
    setSongInput(songSearchValue);
  }, [songSearchValue]);

  return (
    <div className="space-y-2">
      <form onSubmit={handleArtistSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <Input
            type="text"
            placeholder="Search by artist name..."
            style={{ color: '#FF6B35' }}
            value={artistInput}
            onChange={handleArtistChange}
            className="pr-10 border border-orange-500"
          />
          {artistInput && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClearArtist}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
        <Button type="submit" className="bg-primary hover:bg-primary/80">
          <Search className="w-4 h-4 mr-2" />
          Search
        </Button>
      </form>
      
      <div className="relative">
        <Input
          type="text"
          placeholder="Search by song name..."
          style={{ color: '#FF6B35' }}
          value={songInput}
          onChange={handleSongChange}
          className="pr-10 border border-orange-500"
        />
        {songInput && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClearSong}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
          >
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>
      
      {(artistSearchValue || songSearchValue) && (
        <p className="text-sm text-muted-foreground">
          Showing results for: 
          <span className="font-medium">
            {artistSearchValue && `Artist: ${artistSearchValue}`}
            {artistSearchValue && songSearchValue && ' | '}
            {songSearchValue && `Song: ${songSearchValue}`}
          </span>
        </p>
      )}
    </div>
  );
};

export default SeparateSearchFields;