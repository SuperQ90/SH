import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Home } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';

export default function ExpandedTerms() {
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
          <CardTitle>Expanded Terms and Agreements</CardTitle>
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
                <h3 className="font-semibold mb-2">Social Media Promotion Clause</h3>
              </section>
              
              <section>
                <h3 className="font-semibold mb-2">Social Media Distribution & Promotional Rights</h3>
                <p>By uploading content to AI Music Radio.io, you (the "Artist") grant AI Music Radio.io and its affiliates (the "Platform") the irrevocable, non-exclusive, royalty-free, worldwide right to use, reproduce, distribute, display, and promote your content across all digital and social media platforms for promotional purposes, including but not limited to:</p>
                <ul className="list-disc ml-6 mt-2 space-y-1">
                  <li>YouTube</li>
                  <li>TikTok</li>
                  <li>Instagram (Feed, Reels, Stories)</li>
                  <li>Snapchat (Spotlight, Stories)</li>
                  <li>Facebook</li>
                  <li>X (formerly Twitter)</li>
                  <li>Threads</li>
                  <li>LinkedIn</li>
                  <li>Pinterest</li>
                  <li>Other emerging or established content-sharing platforms</li>
                </ul>
                <p className="mt-2">This includes, without limitation, the use of your content in Social Stage videos, artist highlight reels, promotional montages, behind-the-scenes content, and interactive features designed to expand audience reach and increase artist visibility.</p>
              </section>
              
              <section>
                <h3 className="font-semibold mb-2">Scope of Use</h3>
                <p><strong>Content Types:</strong> Audio tracks, album covers, music videos, visualizer loops, artist photos, lyrics, live performance footage, or any media submitted or created in collaboration with the Platform.</p>
                <p className="mt-2"><strong>Modifications:</strong> Content may be edited, formatted, captioned, or adapted for optimization on each platform (e.g., vertical formats, caption overlays, intro/outro branding).</p>
                <p className="mt-2"><strong>Attribution:</strong> The Platform will make reasonable efforts to credit the Artist where appropriate, but this is not a contractual requirement for every instance of use.</p>
              </section>
              
              <section>
                <h3 className="font-semibold mb-2">Social Stage Specifics</h3>
                <p>The Social Stage Initiative is a promotional program where artists' content is featured in live or pre-recorded videos showcasing their music with animated, AI-generated, or live-action visuals. By participating, you consent to the inclusion of your material in collaborative media alongside other creators or the Platform's branded assets.</p>
                <ul className="list-disc ml-6 mt-2 space-y-1">
                  <li>Live Band or DJ Performance Clips</li>
                  <li>Crowd engagement animations</li>
                  <li>Digital DJ/host avatars (e.g., BeatByte, Rex Valor)</li>
                  <li>Holographic and futuristic concert environments</li>
                </ul>
                <p className="mt-2">These materials may be distributed through the channels above to drive engagement, attract listeners, and promote your music to wider audiences.</p>
              </section>
              
              <section>
                <h3 className="font-semibold mb-2">Duration and Revocability</h3>
                <p>This license remains in effect as long as your content is active on the Platform. Should you remove your content or request its removal, the Platform will cease future promotional use within a commercially reasonable time frame. However, any promotional content already published on social platforms prior to the removal date may remain available publicly unless legally required to be taken down.</p>
              </section>
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}