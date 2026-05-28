import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, X } from 'lucide-react';

interface SongSearchProps {
  onSearch: (query: string) => void;
  onClear: () => void;
  searchValue: string;
}

const SongSearch = ({ onSearch, onClear, searchValue }: SongSearchProps) => {
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSearch(e.target.value);
  };

  return (
    <div className="mb-4">
      <div className="flex items-center space-x-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            type="text"
            placeholder="Search by song name..."
            style={{ color: '#FF6B35' }}
            value={searchValue}
            onChange={handleInputChange}
            className="pl-10 border border-orange-500"
          />
        </div>
        {searchValue && (
          <Button
            variant="outline"
            size="sm"
            onClick={onClear}
            className="px-3"
          >
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
};

export default SongSearch;