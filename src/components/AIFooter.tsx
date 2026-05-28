import React from 'react';
import { Radio, Mail, Github, Twitter, Heart, Headphones } from 'lucide-react';
import { Button } from '@/components/ui/button';

const AIFooter: React.FC = () => {
  const currentYear = new Date().getFullYear();

  const footerLinks = {
    product: [
      { name: 'Features', href: '#features' },
      { name: 'Genres', href: '#genres' },
      { name: 'Download', href: '#download' },
      { name: 'API', href: '#api' }
    ],
    company: [
      { name: 'About', href: '#about' },
      { name: 'Blog', href: '#blog' },
      { name: 'Careers', href: '#careers' },
      { name: 'Press', href: '#press' }
    ],
    support: [
      { name: 'Help Center', href: '#help' },
      { name: 'Contact', href: '#contact' },
      { name: 'Status', href: '#status' },
      { name: 'Terms', href: '#terms' }
    ],
    community: [
      { name: 'Discord', href: '#discord' },
      { name: 'Twitter', href: '#twitter' },
      { name: 'GitHub', href: '#github' },
      { name: 'Facebook', href: '#facebook' }
    ]
  };

  return (
    <footer className="bg-black/50 backdrop-blur-xl border-t border-white/10 mt-20">
      <div className="container mx-auto px-4 py-12">
        {/* Top Section */}
        <div className="grid md:grid-cols-5 gap-8 mb-8">
          {/* Brand */}
          <div className="md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <Radio className="w-8 h-8 text-cyan-400" />
              <div>
                <h3 className="text-xl font-bold text-white">Hey it's Music</h3>
                <p className="text-xs text-cyan-400">The AI Radio Station</p>
              </div>
            </div>
            <p className="text-gray-400 text-sm mb-4">
              Experience the future of music with AI-powered radio stations.
            </p>
            <div className="flex gap-3">
              <Button variant="ghost" size="icon" className="text-gray-400 hover:text-cyan-400">
                <Twitter className="w-5 h-5" />
              </Button>
              <Button variant="ghost" size="icon" className="text-gray-400 hover:text-cyan-400">
                <Github className="w-5 h-5" />
              </Button>
              <Button variant="ghost" size="icon" className="text-gray-400 hover:text-cyan-400">
                <Mail className="w-5 h-5" />
              </Button>
            </div>
          </div>

          {/* Links */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h4 className="text-white font-semibold mb-4 capitalize">{category}</h4>
              <ul className="space-y-2">
                {links.map((link) => (
                  <li key={link.name}>
                    <a 
                      href={link.href}
                      className="text-gray-400 hover:text-cyan-400 text-sm transition-colors"
                    >
                      {link.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Newsletter */}
        <div className="border-t border-white/10 pt-8 mb-8">
          <div className="max-w-md mx-auto text-center">
            <h3 className="text-xl font-bold text-white mb-2">
              Stay tuned for AI music updates
            </h3>
            <p className="text-gray-400 text-sm mb-4">
              Get the latest AI-generated tracks and features delivered to your inbox.
            </p>
            <div className="flex gap-2">
              <input
                type="email"
                placeholder="Enter your email"
                className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400"
              />
              <Button className="bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700">
                Subscribe
              </Button>
            </div>
          </div>
        </div>

        {/* Bottom */}
        <div className="border-t border-white/10 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-gray-400 text-sm">
              © {currentYear} Hey it's Music. All rights reserved.
            </p>
            <div className="flex items-center gap-6 text-sm text-gray-400">
              <a href="#privacy" className="hover:text-cyan-400">Privacy Policy</a>
              <a href="#terms" className="hover:text-cyan-400">Terms of Service</a>
              <a href="#cookies" className="hover:text-cyan-400">Cookie Policy</a>
            </div>
            <div className="flex items-center gap-2 text-gray-400">
              <span className="text-sm">Made with</span>
              <Heart className="w-4 h-4 text-red-500 fill-current" />
              <span className="text-sm">and</span>
              <Headphones className="w-4 h-4 text-cyan-400" />
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default AIFooter;