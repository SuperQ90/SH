import React, { createContext, useContext, useEffect, useState } from "react";
import type { Track, UserProfile } from "@/types/music";

interface AppContextType {
  sidebarOpen: boolean;
  toggleSidebar: () => void;

  profile: UserProfile | null;
  setProfile: (profile: UserProfile | null) => void;

  currentTrack: Track | null;
  setCurrentTrack: (track: Track | null) => void;

  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;

  resetToHome: () => void;

  likedSongs: Set<string>;
  addLikedSong: (songId: string) => void;

  songLikeCounts: Record<string, number>;
  updateSongLikeCount: (songId: string, count: number) => void;
}

const defaultAppContext: AppContextType = {
  sidebarOpen: false,
  toggleSidebar: () => {},

  profile: null,
  setProfile: () => {},

  currentTrack: null,
  setCurrentTrack: () => {},

  isPlaying: false,
  setIsPlaying: () => {},

  resetToHome: () => {},

  likedSongs: new Set(),
  addLikedSong: () => {},

  songLikeCounts: {},
  updateSongLikeCount: () => {},
};

const AppContext = createContext<AppContextType>(defaultAppContext);

export const useAppContext = () => useContext(AppContext);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [likedSongs, setLikedSongs] = useState<Set<string>>(new Set());
  const [songLikeCounts, setSongLikeCounts] = useState<Record<string, number>>({});

  const toggleSidebar = () => setSidebarOpen((p) => !p);

  const addLikedSong = (songId: string) => {
    setLikedSongs((prev) => {
      const next = new Set(prev);
      next.add(songId);
      localStorage.setItem("likedSongs", JSON.stringify([...next]));
      return next;
    });
  };

  const updateSongLikeCount = (songId: string, count: number) => {
    setSongLikeCounts((prev) => {
      const updated = { ...prev, [songId]: count };
      localStorage.setItem("songLikeCounts", JSON.stringify(updated));
      return updated;
    });
  };

  const resetToHome = () => {
    setSidebarOpen(false);
    setCurrentTrack(null);
    setIsPlaying(false);
    window.dispatchEvent(new CustomEvent("resetToHome"));
  };

  useEffect(() => {
    const savedProfile = localStorage.getItem("musicProfile");
    if (savedProfile) {
      try {
        setProfile(JSON.parse(savedProfile));
      } catch (e) {
        console.error("Error loading profile:", e);
      }
    }

    const savedLikedSongs = localStorage.getItem("likedSongs");
    if (savedLikedSongs) {
      try {
        const likedArray = JSON.parse(savedLikedSongs);
        setLikedSongs(new Set(likedArray));
      } catch (e) {
        console.error("Error loading liked songs:", e);
      }
    }

    const savedLikeCounts = localStorage.getItem("songLikeCounts");
    if (savedLikeCounts) {
      try {
        setSongLikeCounts(JSON.parse(savedLikeCounts));
      } catch (e) {
        console.error("Error loading like counts:", e);
      }
    }
  }, []);

  return (
    <AppContext.Provider
      value={{
        sidebarOpen,
        toggleSidebar,
        profile,
        setProfile,
        currentTrack,
        setCurrentTrack,
        isPlaying,
        setIsPlaying,
        resetToHome,
        likedSongs,
        addLikedSong,
        songLikeCounts,
        updateSongLikeCount,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

// Compatibility re-exports (so any old imports from "@/contexts/AppContext" keep working)
export { AuthProvider, useAuth } from "./AuthContext";
