import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertTriangle, Home } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';

export default function ContentPolicy() {
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
          <CardTitle>Content Policy</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-6 flex justify-center">
            <img 
              src="https://d64gsuwffb70l.cloudfront.net/6855b7b44152a08ab0b05643_1754464604204_b8048e4c.png" 
              alt="AI Music Radio" 
              className="max-w-xs h-auto rounded-lg"
            />
          </div>
          <ScrollArea className="h-96">
            <div className="space-y-4 text-sm">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  All content must comply with app store guidelines and local laws.
                </AlertDescription>
              </Alert>
              
              <section>
                <h3 className="font-semibold mb-2">Acceptable Content</h3>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Original AI-generated music</li>
                  <li>Music you own or have rights to</li>
                  <li>Creative Commons licensed content</li>
                </ul>
              </section>
              
               <section>
                <h3 className="font-semibold mb-2">Prohibited Content</h3>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Copyrighted material without permission</li>
                  <li>Extreme explicit or adult content</li>
                  <li>Hate speech or discriminatory content</li>
                  <li>Violence or harmful content</li>
                  <li className="text-red-600 font-medium">No Plagiarism of lyrics: All songs will be deleted automatically if plagiarism is in question</li>
                </ul>
              </section>
              
              <section>
                <h3 className="font-semibold mb-2">Reporting</h3>
                <p>Report inappropriate content to mrutter@gmail.com</p>
              </section>
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}