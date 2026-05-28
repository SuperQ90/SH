import React from 'react';
import { Swords } from 'lucide-react';

const AIMusicBattles: React.FC = () => {
  return (
    <div className="mt-6 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <Swords className="w-5 h-5 text-[#39FF14]" />
        <h2 className="text-lg font-bold text-[#39FF14] tracking-wide">AI Music Battles</h2>
      </div>
    </div>
  );
};

export default AIMusicBattles;
