// src/App.tsx
import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/contexts/AuthContext";
import { useServiceWorker } from "@/hooks/useServiceWorker";

// pages
import Index from "./pages/Index";
import UploadInstructions from "./pages/UploadInstructions";
import TopLiked from "./pages/TopLiked";
import TopPlayed from "./pages/TopPlayed";
import MyLikes from "./pages/MyLikes";
import Playlists from "./pages/Playlists";
import PlaylistDetail from "@/pages/PlaylistDetail";
import Search from "./pages/Search";
import NotFound from "./pages/NotFound";
import AdminDashboard from "@/pages/AdminDashboard";
import Profile from "@/pages/Profile";
import AdminUsers from "@/pages/AdminUsers";

import AdminLayout from "@/pages/admin/AdminLayout";
import UsersAdmin from "@/pages/admin/UsersAdmin";
import SongsAdmin from "@/pages/admin/SongsAdmin";
import FeaturedAdmin from "@/pages/admin/FeaturedAdmin";
import PaymentsAdmin from "@/pages/admin/PaymentsAdmin";
import Pricing from "@/pages/Pricing";
import PaymentSuccess from "@/pages/PaymentSuccess";
import ArtistPage from "@/pages/ArtistPage";
import FeaturedArtists from "@/pages/FeaturedArtists";
import ResetPassword from "@/pages/ResetPassword";
import SongPage from "@/pages/SongPage";
import AllArtists from "@/pages/AllArtists";
import FollowingArtists from "@/pages/FollowingArtists";
import Notifications from "@/pages/Notifications";





// static
import PrivacyPolicy from "@/components/PrivacyPolicy";
import TermsOfService from "@/components/TermsOfService";
import ContentPolicy from "@/components/ContentPolicy";
import MusicBackground from "@/components/MusicBackground";
import AppInfo from "@/components/AppInfo";
import ExpandedTerms from "@/components/ExpandedTerms";
import Footer from "@/components/Footer";

const queryClient = new QueryClient();

const AppContent: React.FC = () => {
  useServiceWorker();

  return (
    <div className="min-h-screen flex flex-col relative">
      <MusicBackground />

      <Routes>
        {/* public */}
        <Route path="/" element={<Index />} />
        <Route path="/featuredsongs" element={<Index />} />
        <Route path="/top20bygenre" element={<Index />} />
        <Route path="/search" element={<Search />} />

        <Route path="/top-liked" element={<TopLiked />} />
        <Route path="/top-played" element={<TopPlayed />} />
        <Route path="/my-likes" element={<MyLikes />} />
        <Route path="/following-artists" element={<FollowingArtists />} />
        <Route path="/notifications" element={<Notifications />} />

        {/* playlists */}
        <Route path="/playlists" element={<Playlists />} />
        <Route path="/playlist/:id" element={<PlaylistDetail />} />
        <Route path="/p/:playlistId" element={<PlaylistDetail />} />

        {/* upload */}
        <Route path="/upload-instructions" element={<UploadInstructions />} />

        {/* profile */}

        <Route path="/profile" element={<Profile />} />
        
        {/* password reset */}
        <Route path="/reset-password" element={<ResetPassword />} />


        {/* pricing / payments */}
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/payment-success" element={<PaymentSuccess />} />

        {/* NEW: public artist page */}
        <Route path="/artist/:slug" element={<ArtistPage />} />
        
        {/* Song page for shared links */}
        <Route path="/song/:id" element={<SongPage />} />
        
        {/* Featured Artists */}
        <Route path="/featured-artists" element={<FeaturedArtists />} />

        {/* All Music Artists */}
        <Route path="/all-artists" element={<AllArtists />} />



        {/* ADMIN (nested) */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboard />} />
          <Route path="users" element={<UsersAdmin />} />
          <Route path="songs" element={<SongsAdmin />} />
          <Route path="featured" element={<FeaturedAdmin />} />
          <Route path="payments" element={<PaymentsAdmin />} />
        </Route>

        {/* legacy admin route */}
        <Route path="/admin-users" element={<AdminUsers />} />

        {/* static */}
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<TermsOfService />} />
        <Route path="/content-policy" element={<ContentPolicy />} />
        <Route path="/app-info" element={<AppInfo />} />
        <Route path="/expanded-terms" element={<ExpandedTerms />} />

        {/* 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>

      <Footer />
    </div>
  );
};

const App: React.FC = () => (
  <ThemeProvider defaultTheme="light">
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AppContent />
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
