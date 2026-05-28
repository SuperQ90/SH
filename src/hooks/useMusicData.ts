import { useState, useEffect, useCallback } from 'react';
import { Track, UserProfile, Genre } from '@/types/music';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

// Shuffle function to mix genres
const shuffleArray = <T>(array: T[]): T[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

export const useMusicData = () => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [selectedGenre, setSelectedGenre] = useState<Genre | null>(null);
  const [userSongs, setUserSongs] = useState<Track[]>([]);
  const [allSongs, setAllSongs] = useState<Track[]>([]);
  const [artistSearch, setArtistSearch] = useState<string>('');
  const [songSearch, setSongSearch] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialLoadComplete, setInitialLoadComplete] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const SONGS_PER_PAGE = 20; // 20 songs per page, unlimited pages - no database limits
  const { user } = useAuth();
  const { toast } = useToast();

  // Load songs from database with likes_count and shuffle for mixed genres
  const loadAllSongs = async (showLoading = false) => {
    if (showLoading) setLoading(true);
    setError(null);
    
    try {
      // Load ALL songs with optimized database indexes for pagination
      // Supabase has a default 1000 row limit - use range to get ALL songs
      const { data, error } = await supabase
        .from('songs')
        .select('id, title, artist, genre, audio_url, user_id, duration, created_at, brand_url, cover_url, image_url, purchase_url, likes_count')
        .not('audio_url', 'is', null)
        .neq('audio_url', '')
        .order('created_at', { ascending: false })
        .range(0, 9999); // Fetch up to 10,000 songs to ensure we get all
      if (error) {
        console.error('Database error:', error);
        setError(`Error fetching data: ${JSON.stringify(error)}`);
        toast({
          title: "Error",
          description: `Error fetching data: ${error.message}`,
          variant: "destructive"
        });
        setAllSongs([]);
        return;
      }
      
      if (data && data.length > 0) {
        const formattedSongs: Track[] = data.map(song => ({
          id: song.id,
          title: song.title || 'Unknown Title',
          artist: song.artist || 'Unknown Artist',
          genre: (song.genre as Genre) || 'Other',
          duration: song.duration || 0,
          url: song.audio_url || '',
          user_id: song.user_id,
          brand_url: song.brand_url,
          image_url: song.image_url || song.cover_url || '/placeholder.svg',
          purchase_url: song.purchase_url,
          likes_count: (song as any).likes_count ?? 0,
          created_at: song.created_at ?? undefined,
        }));

        
        // Shuffle songs to mix genres
        const shuffledSongs = shuffleArray(formattedSongs);
        setAllSongs(shuffledSongs);
      } else {
        setAllSongs([]);
      }
    } catch (error: any) {
      console.error('Error loading songs:', error);
      setError(`Error fetching data: ${JSON.stringify(error)}`);
      toast({
        title: "Error",
        description: `Error loading songs: ${error.message}`,
        variant: "destructive"
      });
      setAllSongs([]);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const loadUserSongs = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('songs')
        .select('id, title, artist, genre, audio_url, user_id, duration, created_at, brand_url, cover_url, image_url, purchase_url, likes_count')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      const formattedSongs: Track[] = (data || []).map(song => ({
        id: song.id,
        title: song.title || 'Unknown Title',
        artist: song.artist || 'Unknown Artist',
        genre: (song.genre as Genre) || 'Other',
        duration: song.duration || 0,
        url: song.audio_url || '',
        user_id: song.user_id,
        brand_url: song.brand_url,
        image_url: song.image_url || song.cover_url || '/placeholder.svg',
        purchase_url: song.purchase_url,
        likes_count: (song as any).likes_count ?? 0,
        created_at: song.created_at ?? undefined,
      }));

      
      setUserSongs(formattedSongs);
    } catch (error: any) {
      console.error('Error loading user songs:', error);
      setUserSongs([]);
    }
  };

  // Load data on mount
  useEffect(() => {
    const savedProfile = localStorage.getItem('musicProfile');
    if (savedProfile) {
      try {
        const parsedProfile = JSON.parse(savedProfile);
        setProfile(parsedProfile);
      } catch (error) {
        localStorage.removeItem('musicProfile');
      }
    }
    
    // Load database songs
    loadAllSongs();
  }, []);

  useEffect(() => {
    if (user) {
      loadUserSongs();
    }
  }, [user]);

  // Filter tracks with pagination
  useEffect(() => {
    let filteredSongs = allSongs;
    
    if (artistSearch) {
      filteredSongs = filteredSongs.filter(song => 
        song.artist.toLowerCase().includes(artistSearch.toLowerCase())
      );
    }
    
    if (songSearch) {
      filteredSongs = filteredSongs.filter(song => 
        song.title.toLowerCase().includes(songSearch.toLowerCase())
      );
    }
    
    if (selectedGenre) {
      filteredSongs = filteredSongs.filter(song => song.genre === selectedGenre);
    }
    
    // Apply pagination with 20 songs per page, unlimited pages
    const startIndex = (currentPage - 1) * SONGS_PER_PAGE;
    const endIndex = startIndex + SONGS_PER_PAGE;
    const paginatedSongs = filteredSongs.slice(startIndex, endIndex);
    
    setTracks(paginatedSongs);
  }, [selectedGenre, allSongs, artistSearch, songSearch, currentPage]);

  const saveProfile = (profileData: Omit<UserProfile, 'id' | 'createdAt'>) => {
    const newProfile: UserProfile = {
      ...profileData,
      id: profile?.id || Date.now().toString(),
      createdAt: profile?.createdAt || new Date()
    };
    setProfile(newProfile);
    localStorage.setItem('musicProfile', JSON.stringify(newProfile));
  };

  const refreshUserSongs = useCallback(() => {
    setCurrentPage(1);
    loadAllSongs(true);
    if (user) loadUserSongs();
  }, [user]);

  // Get total filtered songs count for pagination
  const getTotalFilteredSongs = () => {
    let filteredSongs = allSongs;
    
    if (artistSearch) {
      filteredSongs = filteredSongs.filter(song => 
        song.artist.toLowerCase().includes(artistSearch.toLowerCase())
      );
    }
    
    if (songSearch) {
      filteredSongs = filteredSongs.filter(song => 
        song.title.toLowerCase().includes(songSearch.toLowerCase())
      );
    }
    
    if (selectedGenre) {
      filteredSongs = filteredSongs.filter(song => song.genre === selectedGenre);
    }
    
    return filteredSongs.length;
  };

  const totalPages = Math.ceil(getTotalFilteredSongs() / SONGS_PER_PAGE);

  return {
    profile,
    tracks,
    likedTracks: [], // Empty array since likes are removed
    selectedGenre,
    userSongs,
    allSongs,
    artistSearch,
    songSearch,
    loading,
    error,
    initialLoadComplete,
    currentPage,
    totalPages,
    SONGS_PER_PAGE,
    setSelectedGenre: (genre: Genre | null) => {
      setSelectedGenre(genre);
      setCurrentPage(1);
    },
    setArtistSearch: (search: string) => {
      setArtistSearch(search);
      setCurrentPage(1);
    },
    setSongSearch: (search: string) => {
      setSongSearch(search);
      setCurrentPage(1);
    },
    setCurrentPage,
    saveProfile,
    toggleLikeTrack: () => {}, // Empty function since likes are removed
    refreshUserSongs,
    getTotalFilteredSongs
  };
};