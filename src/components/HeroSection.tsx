import React from 'react';
import { Button } from '@/components/ui/button';
import { Play, Radio, Sparkles, Headphones } from 'lucide-react';

interface HeroSectionProps {
  onStartListening: () => void;
  onOpenAuth: () => void;
  isAuthenticated: boolean;
}

const HeroSection: React.FC<HeroSectionProps> = ({ onStartListening, onOpenAuth, isAuthenticated }) => {
  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-purple-900 via-blue-900 to-cyan-900 rounded-3xl p-12 mb-8">
      <div className="absolute inset-0 bg-black/20"></div>
      <div className="absolute -top-20 -right-20 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl"></div>
      <div className="absolute -bottom-20 -left-20 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl"></div>
      
      <div className="relative z-10 grid md:grid-cols-2 gap-8 items-center">
        <div className="space-y-6">
          <div className="flex items-center gap-2 mb-4">
            <Radio className="w-8 h-8 text-cyan-400 animate-pulse" />
            <span className="text-cyan-400 font-bold text-lg">LIVE NOW</span>
          </div>
          
          <h1 className="text-5xl md:text-6xl font-bold text-white leading-tight">
            Hey it's Music
            <span className="block text-3xl md:text-4xl text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400 mt-2">
              The AI Radio Station
            </span>
          </h1>
          
          <p className="text-xl text-gray-200">
            Experience the future of music with AI-curated playlists, personalized radio stations, and endless discovery. Your music, powered by artificial intelligence.
          </p>
          
          <div className="flex flex-wrap gap-4">
            <Button 
              size="lg" 
              onClick={onStartListening}
              className="bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700 text-white px-8 py-6 text-lg"
            >
              <Play className="w-5 h-5 mr-2" />
              Start Listening
            </Button>
            
            {!isAuthenticated && (
              <Button 
                size="lg" 
                variant="outline"
                onClick={onOpenAuth}
                className="border-2 border-white/30 text-white hover:bg-white/10 px-8 py-6 text-lg"
              >
                <Sparkles className="w-5 h-5 mr-2" />
                Create Profile
              </Button>
            )}
          </div>
          
          <div className="flex items-center gap-6 text-sm text-gray-300">
            <div className="flex items-center gap-2">
              <Headphones className="w-4 h-4" />
              <span>24/7 AI Radio</span>
            </div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              <span>Personalized Stations</span>
            </div>
          </div>
        </div>
        
        <div className="relative">
          <img 
            src="https://d64gsuwffb70l.cloudfront.net/68e68f5d71ba149dddd30364_1760034477688_e77faf8c.webp"
            alt="AI DJ"
            className="w-full max-w-md mx-auto rounded-2xl shadow-2xl"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-purple-900/50 to-transparent rounded-2xl"></div>
        </div>
      </div>
    </div>
  );
};

export default HeroSection;