import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Shield, FileText, Info, Music, Mail, Upload, ScrollText, Users } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-card/80 backdrop-blur-sm border-t border-border mt-auto">
      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="flex items-center space-x-2">
            <Music className="h-5 w-5 text-primary" />
            <div>
              <h3 className="font-semibold">AI Music Radio</h3>
              <p className="text-sm text-muted-foreground">Discover AI Music</p>
              <p className="text-xs text-red-600">Intended for Adult Audience 18 and over</p>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <Link to="/featured-artists">
              <Button variant="ghost" size="sm" className="animate-pulse text-xs bg-[#00BFFF]/30 text-[#39FF14] hover:bg-[#00BFFF]/50 hover:text-[#39FF14] shadow-[0_0_10px_rgba(0,191,255,0.4)]">
                <Users className="h-3 w-3 mr-1" />
                Featured Artists
              </Button>
            </Link>

            <Link to="/privacy">
              <Button variant="ghost" size="sm" className="text-xs">
                <Shield className="h-3 w-3 mr-1" />
                Privacy
              </Button>
            </Link>
            <Link to="/terms">
              <Button variant="ghost" size="sm" className="text-xs">
                <FileText className="h-3 w-3 mr-1" />
                Terms
              </Button>
            </Link>
            <Link to="/content-policy">
              <Button variant="ghost" size="sm" className="text-xs">
                <Shield className="h-3 w-3 mr-1" />
                Content Policy
              </Button>
            </Link>
            <Link to="/app-info">
              <Button variant="ghost" size="sm" className="text-xs">
                <Info className="h-3 w-3 mr-1" />
                App Info
              </Button>
            </Link>
            <Link to="/upload-instructions">
              <Button variant="ghost" size="sm" className="text-xs">
                <Upload className="h-3 w-3 mr-1" />
                Upload Guide
              </Button>
            </Link>
            <Link to="/expanded-terms">
              <Button variant="ghost" size="sm" className="text-xs">
                <ScrollText className="h-3 w-3 mr-1" />
                Expanded Terms
              </Button>
            </Link>
          </div>

          
          <div className="text-right">
            <div className="flex items-center justify-end mb-2">
              <Mail className="h-3 w-3 mr-1 text-muted-foreground" />
              <a 
                href="mailto:aimusicradio2025@gmail.com" 
                className="text-xs text-muted-foreground hover:text-primary transition-colors"
              >
                aimusicradio2025@gmail.com
              </a>

            </div>
            <p className="text-xs text-muted-foreground">
              © 2026 AI Music Radio. All rights reserved.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Version 2.0.0
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}