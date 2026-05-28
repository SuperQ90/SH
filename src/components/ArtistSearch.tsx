import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, X } from 'lucide-react';

interface ArtistSearchProps {
  onSearch: (artist: string) => void;
  onClear: () => void;
  searchValue: string;
}

const ArtistSearch: React.FC<ArtistSearchProps> = ({ onSearch, onClear, searchValue }) => {
  const [localSearch, setLocalSearch] = useState(searchValue);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(localSearch.trim());
  };

  const handleClear = () => {
    setLocalSearch('');
    onClear();
  };

  return (
    <div className="mb-6">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <Input
            type="text"
            placeholder="Search by artist name..."
            style={{ color: '#FF6B35' }}
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
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
        <Button type="submit" className="bg-primary hover:bg-primary/80">
          <Search className="w-4 h-4 mr-2" />
          Search
        </Button>
      </form>
      {searchValue && (
        <p className="text-sm text-muted-foreground mt-2">
          Showing results for: <span className="font-medium">{searchValue}</span>
        </p>
      )}
    </div>
  );
};

export default ArtistSearch;