import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, X } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface UnifiedSearchProps {
  onArtistSearch: (artist: string) => void;
  onSongSearch: (song: string) => void;
  onClear: () => void;
  artistSearchValue: string;
  songSearchValue: string;
}

const UnifiedSearch: React.FC<UnifiedSearchProps> = ({
  onArtistSearch,
  onSongSearch,
  onClear,
  artistSearchValue,
  songSearchValue
}) => {
  const [searchType, setSearchType] = useState<'artist' | 'song'>('artist');
  const [localSearch, setLocalSearch] = useState('');

  const currentValue = searchType === 'artist' ? artistSearchValue : songSearchValue;
  const placeholder = searchType === 'artist' ? 'Search by artist name...' : 'Search by song name...';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchType === 'artist') {
      onArtistSearch(localSearch.trim());
    } else {
      onSongSearch(localSearch.trim());
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalSearch(e.target.value);
    if (searchType === 'song') {
      onSongSearch(e.target.value);
    }
  };

  const handleClear = () => {
    setLocalSearch('');
    onClear();
  };

  React.useEffect(() => {
    setLocalSearch(currentValue);
  }, [currentValue]);

  return (
    <div className="mb-6">
      <form onSubmit={handleSubmit} className="flex gap-2 mb-2">
        <Select value={searchType} onValueChange={(value: 'artist' | 'song') => setSearchType(value)}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="artist">Artist</SelectItem>
            <SelectItem value="song">Song</SelectItem>
          </SelectContent>
        </Select>
        <div className="relative flex-1">
          <Input
            type="text"
            placeholder={placeholder}
            style={{ color: '#FF6B35' }}
            value={localSearch}
            onChange={handleInputChange}
            className="pr-10 border border-orange-500"
          />
          {localSearch && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
        {searchType === 'artist' && (
          <Button type="submit" className="bg-primary hover:bg-primary/80">
            <Search className="w-4 h-4 mr-2" />
            Search
          </Button>
        )}
      </form>
      {currentValue && (
        <p className="text-sm text-muted-foreground">
          Showing results for: <span className="font-medium">{currentValue}</span>
        </p>
      )}
    </div>
  );
};

export default UnifiedSearch;