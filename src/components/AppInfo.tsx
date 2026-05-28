import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Music, Users, Shield, Zap, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';

export default function AppInfo() {
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);


  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <div className="mb-4">
        <Button 
          onClick={() => navigate('/')} 
          variant="outline" 
          className="flex items-center gap-2"
        >
          <Home className="h-4 w-4" />
          Home
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Music className="h-5 w-5" />
            AI Music Radio
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="mb-6 flex justify-center">
            <img 
              src="https://d64gsuwffb70l.cloudfront.net/6855b7b44152a08ab0b05643_1754464604204_b8048e4c.png" 
              alt="AI Music Radio" 
              className="max-w-xs h-auto rounded-lg"
            />
          </div>
          <div>
            <h3 className="font-semibold mb-2">About This App</h3>
            <p className="text-sm text-muted-foreground mb-2">
              AI Music Radio is a platform for discovering and sharing AI-generated music. 
              Connect with artists, explore new genres, and enjoy a personalized music experience.
            </p>
            <p className="text-sm text-orange-600 font-medium">
              Intended for 18 years of age and older.
            </p>
          </div>
          <div>
            <h3 className="font-semibold mb-3">Key Features</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <Music className="h-4 w-4 text-primary" />
                <span className="text-sm">AI Music Discovery</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                <span className="text-sm">Artist Profiles (Coming Soon)</span>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                <span className="text-sm">Many Genres of Music</span>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                <span className="text-sm">Fast Streaming</span>
              </div>
            </div>
          </div>
          
          <div>
            <h3 className="font-semibold mb-2">Version</h3>
            <Badge variant="outline">1.0.0</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}