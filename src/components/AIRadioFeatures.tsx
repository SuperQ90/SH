import React from 'react';
import { Card } from '@/components/ui/card';
import { Brain, Download, Music, Users, Zap, Shield } from 'lucide-react';

const features = [
  {
    icon: Brain,
    title: 'AI-Powered Curation',
    description: 'Smart algorithms learn your taste and create perfect playlists',
    color: 'from-purple-500 to-purple-600'
  },
  {
    icon: Music,
    title: 'Unlimited Genres',
    description: 'Explore every genre from Electronic to Classical, Rock to Jazz',
    color: 'from-blue-500 to-blue-600'
  },
  {
    icon: Download,
    title: 'Download & Offline',
    description: 'Download your favorite AI tracks for offline listening',
    color: 'from-cyan-500 to-cyan-600'
  },
  {
    icon: Users,
    title: 'Personal Profiles',
    description: 'Create your profile and get personalized recommendations',
    color: 'from-green-500 to-green-600'
  },
  {
    icon: Zap,
    title: 'Instant Discovery',
    description: 'Discover new AI-generated music tailored to your mood',
    color: 'from-yellow-500 to-yellow-600'
  },
  {
    icon: Shield,
    title: 'Safe & Secure',
    description: 'Your data and preferences are always protected',
    color: 'from-red-500 to-red-600'
  }
];

const AIRadioFeatures: React.FC = () => {
  return (
    <div className="py-12">
      <div className="text-center mb-10">
        <h2 className="text-4xl font-bold text-white mb-4">
          Why Choose Hey it's Music?
        </h2>
        <p className="text-xl text-gray-300 max-w-2xl mx-auto">
          Experience the next generation of radio powered by artificial intelligence
        </p>
      </div>
      
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {features.map((feature, index) => {
          const Icon = feature.icon;
          return (
            <Card 
              key={index}
              className="bg-white/5 backdrop-blur-sm border-white/10 p-6 hover:bg-white/10 transition-all duration-300 group cursor-pointer"
            >
              <div className={`w-12 h-12 rounded-lg bg-gradient-to-r ${feature.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                <Icon className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">
                {feature.title}
              </h3>
              <p className="text-gray-300">
                {feature.description}
              </p>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default AIRadioFeatures;