import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Home } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';

export default function TermsOfService() {
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
          <CardTitle>Terms of Service</CardTitle>
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
                <h3 className="font-semibold mb-2">User Content</h3>
                <p>You retain rights to your uploaded music but grant us license to distribute it through our platform. By uploading content, you confirm it is royalty-free AI-generated music and you have the right to share it.</p>
                <p className="mt-2 font-medium">*We do not sell, license, distribute, or share your uploaded music or personal data with any third parties, advertisers, or external platforms. Your content stays yours, and remains on our platform only for the purposes you intended.*</p>
              </section>
              
              <section>
                <h3 className="font-semibold mb-2">Prohibited Content</h3>
                <p>No copyrighted material, extreme explicit content, or harmful material may be uploaded. Only royalty-free AI-generated music is permitted. Please do not upload tracks to genres that they should not be in.</p>
                <p className="mt-2 font-medium text-red-600">No Plagiarism of lyrics: All songs will be deleted automatically if plagiarism is in question.</p>
              </section>
              
              <section>
                <h3 className="font-semibold mb-2">Account Termination</h3>
                <p>We reserve the right to terminate accounts that violate these terms.</p>
              </section>
              
              <section>
                <h3 className="font-semibold mb-2">Contact</h3>
                <p>For questions about these terms, contact mrutter@gmail.com</p>
              </section>
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}