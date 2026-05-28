import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Home } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';

export default function PrivacyPolicy() {
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
          <CardTitle>Privacy Policy</CardTitle>
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
              <section>
                <h3 className="font-semibold mb-2">Information We Collect</h3>
                <p>We collect information you provide when creating an account, uploading music, and using our services.</p>
              </section>
              
              <section>
                <h3 className="font-semibold mb-2">How We Use Information</h3>
                <p>We use your information to provide music streaming services, manage your account, and improve our platform.</p>
              </section>
              
              <section>
                <h3 className="font-semibold mb-2">Data Security</h3>
                <p>We implement security measures to protect your personal information and music content.</p>
              </section>
              
              <section>
                <h3 className="font-semibold mb-2">Contact Us</h3>
                <p>For privacy concerns, contact us at mrutter@gmail.com</p>
              </section>
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}