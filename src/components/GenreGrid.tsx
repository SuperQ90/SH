import React from 'react';
import { Card } from '@/components/ui/card';
import { Play, Radio } from 'lucide-react';

interface Genre {
  id: string;
  name: string;
  image: string;
  description: string;
  trackCount: number;
  color: string;
}

interface GenreGridProps {
  selectedGenre: string | null;
  onGenreSelect: (genre: string) => void;
}

const genres: Genre[] = [
  {
    id: 'electronic',
    name: 'Electronic',
    image: 'https://d64gsuwffb70l.cloudfront.net/68e68f5d71ba149dddd30364_1760034485784_5d33ac30.webp',
    description: 'Synthesized beats and digital soundscapes',
    trackCount: 245,
    color: 'from-blue-600 to-purple-600'
  },
  {
    id: 'rock',
    name: 'Rock',
    image: 'https://d64gsuwffb70l.cloudfront.net/68e68f5d71ba149dddd30364_1760034493497_44938c9b.webp',
    description: 'Electric guitars and powerful vocals',
    trackCount: 189,
    color: 'from-red-600 to-orange-600'
  },
  {
    id: 'hip-hop',
    name: 'Hip Hop',
    image: 'https://d64gsuwffb70l.cloudfront.net/68e68f5d71ba149dddd30364_1760034499934_15ad0a81.webp',
    description: 'Beats, rhymes, and urban culture',
    trackCount: 312,
    color: 'from-yellow-600 to-amber-600'
  },
  {
    id: 'jazz',
    name: 'Jazz',
    image: 'https://d64gsuwffb70l.cloudfront.net/68e68f5d71ba149dddd30364_1760034506670_8d0c132d.webp',
    description: 'Smooth improvisation and complex harmonies',
    trackCount: 156,
    color: 'from-indigo-600 to-blue-600'
  },
  {
    id: 'pop',
    name: 'Pop',
    image: 'https://d64gsuwffb70l.cloudfront.net/68e68f5d71ba149dddd30364_1760034514071_7a3c64b9.webp',
    description: 'Catchy melodies and mainstream appeal',
    trackCount: 423,
    color: 'from-pink-600 to-purple-600'
  },
  {
    id: 'classical',
    name: 'Classical',
    image: 'https://d64gsuwffb70l.cloudfront.net/68e68f5d71ba149dddd30364_1760034520099_4fc4c520.webp',
    description: 'Orchestral masterpieces and timeless compositions',
    trackCount: 98,
    color: 'from-amber-700 to-red-700'
  }
];

const GenreGrid: React.FC<GenreGridProps> = ({ selectedGenre, onGenreSelect }) => {
  return (
    <div className="py-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-3xl font-bold text-white flex items-center gap-3">
          <Radio className="w-8 h-8 text-cyan-400" />
          Choose Your Station
        </h2>
        <p className="text-gray-300">
          {genres.reduce((sum, g) => sum + g.trackCount, 0)}+ AI Tracks Available
        </p>
      </div>
      
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {genres.map((genre) => (
          <Card
            key={genre.id}
            onClick={() => onGenreSelect(genre.name)}
            className={`relative overflow-hidden cursor-pointer transition-all duration-300 group ${
              selectedGenre === genre.name 
                ? 'ring-4 ring-cyan-400 scale-105' 
                : 'hover:scale-105'
            }`}
          >
            <div className="relative h-48">
              <img 
                src={genre.image} 
                alt={genre.name}
                className="w-full h-full object-cover"
              />
              <div className={`absolute inset-0 bg-gradient-to-t ${genre.color} opacity-60`}></div>
              <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition-colors"></div>
              
              {selectedGenre === genre.name && (
                <div className="absolute top-4 right-4 bg-cyan-400 text-black px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1">
                  <Radio className="w-3 h-3" />
                  ON AIR
                </div>
              )}
            </div>
            
            <div className="relative p-6 bg-gradient-to-b from-transparent to-black/80">
              <div className="flex items-start justify-between mb-2">
                <h3 className="text-2xl font-bold text-white">{genre.name}</h3>
                <Play className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <p className="text-gray-300 text-sm mb-3">{genre.description}</p>
              <div className="flex items-center justify-between">
                <span className="text-cyan-400 text-sm font-semibold">
                  {genre.trackCount} tracks
                </span>
                <div className="flex gap-1">
                  {[1,2,3,4].map((bar) => (
                    <div 
                      key={bar}
                      className={`w-1 bg-cyan-400 rounded-full animate-pulse`}
                      style={{
                        height: `${bar * 4}px`,
                        animationDelay: `${bar * 100}ms`
                      }}
                    ></div>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default GenreGrid;