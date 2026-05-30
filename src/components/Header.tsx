// src/components/Header.tsx
import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  User,
  Plus,
  LogOut,
  Menu,
  RefreshCw,
  Shield,
  CreditCard,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useAppContext } from "@/contexts/AppContext";
import { AuthModal } from "./AuthModal";
import { AddSongModal } from "./AddSongModal";
import ProfileModal from "./ProfileModal";
import NotificationBell from "./NotificationBell";
import MessagesLink from "./MessagesLink";
import { useToast } from "@/hooks/use-toast";
import { useServiceWorker } from "@/hooks/useServiceWorker";
import { supabase } from "@/lib/supabase";
import { Track } from "@/types/music";

interface HeaderProps {
  onSongAdded: () => void;
}


const LEGACY_ADMIN_EMAIL = "mrutter@gmail.com";
const ADMIN_DOMAIN = "@pledge.ai";

const Header: React.FC<HeaderProps> = ({ onSongAdded }) => {

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showAddSongModal, setShowAddSongModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  // plan/profile state
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);
  const [subscriptionPlan, setSubscriptionPlan] = useState<string | null>(null);
  const [profileRole, setProfileRole] = useState<string | null>(null);
  const [isGrandfatheredDb, setIsGrandfatheredDb] = useState<boolean | null>(null);

  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  // keep SW hook alive
  useServiceWorker();

  // fetch profile → we need subscription + role + is_grandfathered
  useEffect(() => {
    const loadProfile = async () => {
      if (!user) {
        setSubscriptionStatus(null);
        setSubscriptionPlan(null);
        setProfileRole(null);
        setIsGrandfatheredDb(null);
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("subscription_status, subscription_plan, role, is_grandfathered")
        // some rows use id = auth.id, some use user_id = auth.id
        .or(`id.eq.${user.id},user_id.eq.${user.id}`)
        .maybeSingle();

      if (!error && data) {
        setSubscriptionStatus(data.subscription_status ?? null);
        setSubscriptionPlan(data.subscription_plan ?? null);
        setProfileRole(data.role ?? null);
        // if column doesn't exist on some rows → will be undefined → we keep null
        setIsGrandfatheredDb(
          typeof data.is_grandfathered === "boolean" ? data.is_grandfathered : null
        );
      } else {
        // fail-open for old users
        setSubscriptionStatus(null);
        setSubscriptionPlan(null);
        setProfileRole(null);
        setIsGrandfatheredDb(null);
      }
    };

    void loadProfile();
  }, [user]);

  const handleSignOut = async () => {
    try {
      await signOut();
      toast({ title: "Signed out successfully!" });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // derived flags
  const isAdmin =
    !!user &&
    (user.email === LEGACY_ADMIN_EMAIL ||
      user.email?.toLowerCase().endsWith(ADMIN_DOMAIN) ||
      profileRole === "admin");

  const isPremium =
    subscriptionStatus === "active" ||
    profileRole === "admin" ||
    isAdmin;

  // IMPORTANT:
  // - DB column present → use that
  // - DB column missing → treat as legacy → allow
  const isGrandfathered =
    isGrandfatheredDb === true ||
    (isGrandfatheredDb === null && subscriptionStatus === null);

  // single source-of-truth gate
  const canCurrentUserUpload = useCallback(() => {
    // not logged in → no
    if (!user) return false;
    // admins always
    if (isAdmin) return true;
    // premium
    if (isPremium) return true;
    // explicit or legacy grandfathered
    if (isGrandfathered) return true;
    return false;
  }, [user, isAdmin, isPremium, isGrandfathered]);

  const handleAddSongClick = () => {
    // not logged in → login
    if (!user) {
      toast({
        title: "Sign in required",
        description:
          "Please sign in to upload songs. You can still browse and listen to music!",
        variant: "default",
      });
      setShowAuthModal(true);
      return;
    }

    // use unified gate
    if (!canCurrentUserUpload()) {
      toast({
        title: "Premium feature",
        description: "Uploading songs is available on the premium plan.",
      });
      navigate("/pricing");
      return;
    }

    setShowAddSongModal(true);
  };

  // ❶ CLOSE THE BYPASS:
  // guard the global event as well
  useEffect(() => {
    const handler = () => {
      // if user not logged in → open auth
      if (!user) {
        toast({
          title: "Sign in required",
          description: "Please sign in to upload songs.",
        });
        setShowAuthModal(true);
        return;
      }

      if (!canCurrentUserUpload()) {
        toast({
          title: "Premium feature",
          description: "Uploading songs is available on the premium plan.",
        });
        navigate("/pricing");
        return;
      }

      setShowAddSongModal(true);
    };

    window.addEventListener("openAddSongModal", handler);
    return () => {
      window.removeEventListener("openAddSongModal", handler);
    };
  }, [user, canCurrentUserUpload, toast, navigate]);

  const clearCacheAndReload = () => {
    const reload = () => {
      globalThis.location.reload();
    };

    if (typeof caches !== "undefined") {
      void caches.keys().then((names) => {
        void Promise.all(names.map((name) => caches.delete(name))).finally(reload);
      });
      return;
    }

    reload();
  };

  const handleRefresh = () => {
    toast({
      title: "Clearing cache and refreshing...",
      description: "Getting latest updates",
    });
    clearCacheAndReload();
  };

  const handleProfileClick = () => {
    if (!user) {
      setShowAuthModal(true);
    } else {
      setShowProfileModal(true);
    }
  };

  const handleSaveProfile = (profile: any) => {
    toast({ title: "Profile saved successfully!" });
  };

  return (
    <>
      <header className="bg-card/80 backdrop-blur-sm border-b border-border p-6 neon-glow sticky top-0 z-40">
        <div className="flex items-center justify-between">
          <div className="flex items-center justify-center flex-1">
            <div className="flex flex-col items-center">
              <img
                src="https://d64gsuwffb70l.cloudfront.net/6855b7b44152a08ab0b05643_1756180840742_c852d3d4.png"
                alt="AI Music Radio Logo"
                className="h-20 md:h-24 lg:h-32 w-auto object-contain drop-shadow-sm rounded-lg"
              />
              <a
                href="https://aimusicvids.io"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 text-xs md:text-sm tracking-wide font-semibold hover:opacity-80 transition-opacity"
              >
                <span className="text-orange-400">Sister of </span>
                <span className="text-white">ai</span>
                <span style={{ color: '#00e5ff' }}>music</span>
                <span style={{ color: '#39ff14' }}>vids</span>

                <span className="text-white">.io</span>
              </a>

            </div>
          </div>

          <div className="hidden md:flex items-center space-x-4">
            <a
              href="https://www.facebook.com/aimusicradio.io/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-700 transition-colors"
            >
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
            </a>
            <Button
              onClick={handleRefresh}
              variant="outline"
              size="sm"
              className="border-border hover:bg-accent"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
            {isAdmin && (
              <Button
                onClick={() => navigate("/admin")}
                variant="outline"
                size="sm"
                className="border-amber-500 text-amber-600 hover:bg-amber-50"
              >
                <Shield className="w-4 h-4 mr-2" />
                Admin
              </Button>
            )}
            <Button
              onClick={() => navigate("/pricing")}
              variant="outline"
              size="sm"
              className="border-purple-500 text-purple-600 hover:bg-purple-50"
            >
              <CreditCard className="w-4 h-4 mr-2" />
              Upgrade
            </Button>
            <Button
              onClick={handleAddSongClick}
              className="bg-secondary hover:bg-secondary/80 green-neon"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Song
            </Button>
            {user ? (
              <div className="flex items-center space-x-3">
                <MessagesLink />
                <NotificationBell />
                <div className="text-right">
                  <p className="text-foreground font-medium flex items-center gap-2 justify-end">
                    {user.email}
                    {isPremium && (
                      <span className="px-2 py-0.5 text-[0.65rem] rounded bg-purple-600/20 text-purple-100 border border-purple-500/40">
                        Premium
                      </span>
                    )}
                    {!isPremium && isGrandfathered && (
                      <span className="px-2 py-0.5 text-[0.65rem] rounded bg-slate-500/10 text-slate-200 border border-slate-500/30">
                        Legacy
                      </span>
                    )}
                  </p>
                  <p className="text-muted-foreground text-sm">Signed In</p>
                </div>
                <Avatar
                  className="cursor-pointer neon-glow"
                  onClick={handleProfileClick}
                >
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    {user.email?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <Button
                  onClick={handleSignOut}
                  variant="outline"
                  size="sm"
                  className="border-border hover:bg-accent"
                >
                  <LogOut className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <Button
                onClick={() => setShowAuthModal(true)}
                className="bg-primary hover:bg-primary/80 neon-glow"
              >
                <User className="w-4 h-4 mr-2" />
                Sign In
              </Button>
            )}
          </div>

          <div className="md:hidden flex flex-col items-end gap-1 shrink-0 self-start">
            <Button
              variant="ghost"
              size="sm"
              className="h-9 w-9 p-0"
              aria-label={showMobileMenu ? "Close menu" : "Open menu"}
              aria-expanded={showMobileMenu}
              onClick={() => setShowMobileMenu(!showMobileMenu)}
            >
              <Menu className="w-5 h-5" />
            </Button>
            {user && (
              <div className="flex items-center gap-0.5">
                <MessagesLink />
                <NotificationBell />
              </div>
            )}
          </div>
        </div>

        {showMobileMenu && (
          <div className="md:hidden mt-4 pt-4 border-t border-border">
            <div className="space-y-3">
              <a
                href="https://www.facebook.com/aimusicradio.io/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center p-2 text-blue-600 hover:text-blue-700 hover:bg-accent rounded transition-colors"
                onClick={() => setShowMobileMenu(false)}
              >
                <svg
                  className="w-5 h-5 mr-2"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
                Facebook
              </a>
              <Button
                onClick={() => {
                  handleRefresh();
                  setShowMobileMenu(false);
                }}
                variant="outline"
                size="sm"
                className="border-border hover:bg-accent w-full"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Clear Cache & Refresh
              </Button>
              <Button
                onClick={() => {
                  navigate("/pricing");
                  setShowMobileMenu(false);
                }}
                variant="outline"
                size="sm"
                className="border-purple-500 text-purple-600 hover:bg-purple-50 w-full"
              >
                <CreditCard className="w-4 h-4 mr-2" />
                Go Premium
              </Button>
              <Button
                onClick={() => {
                  handleAddSongClick();
                  setShowMobileMenu(false);
                }}
                className="bg-secondary hover:bg-secondary/80 green-neon w-full"
                size="sm"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Song
              </Button>
              {isAdmin && (
                <Button
                  onClick={() => {
                    navigate("/admin");
                    setShowMobileMenu(false);
                  }}
                  variant="outline"
                  size="sm"
                  className="border-amber-500 text-amber-600 hover:bg-amber-50 w-full"
                >
                  <Shield className="w-4 h-4 mr-2" />
                  Admin Dashboard
                </Button>
              )}
              {user ? (
                <>
                  <div
                    className="flex items-center space-x-3 cursor-pointer p-2 rounded hover:bg-accent"
                    onClick={() => {
                      handleProfileClick();
                      setShowMobileMenu(false);
                    }}
                  >
                    <Avatar className="neon-glow">
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {user.email?.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-foreground font-medium text-sm flex items-center gap-2">
                        {user.email}
                        {isPremium && (
                          <span className="px-2 py-0.5 text-[0.6rem] rounded bg-purple-600/20 text-purple-100 border border-purple-500/40">
                            Premium
                          </span>
                        )}
                        {!isPremium && isGrandfathered && (
                          <span className="px-2 py-0.5 text-[0.6rem] rounded bg-slate-500/10 text-slate-200 border border-slate-500/30">
                            Legacy
                          </span>
                        )}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        Tap for Profile & Playlists
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={handleSignOut}
                    variant="outline"
                    size="sm"
                    className="border-border hover:bg-accent w-full"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign Out
                  </Button>
                </>
              ) : (
                <Button
                  onClick={() => {
                    setShowAuthModal(true);
                    setShowMobileMenu(false);
                  }}
                  className="bg-primary hover:bg-primary/80 neon-glow w-full"
                  size="sm"
                >
                  <User className="w-4 h-4 mr-2" />
                  Sign In
                </Button>
              )}
            </div>
          </div>
        )}
      </header>

      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
      {user && (
        <>
          <AddSongModal
            isOpen={showAddSongModal}
            onClose={() => setShowAddSongModal(false)}
            onSongAdded={onSongAdded}
          />
          <ProfileModal
            isOpen={showProfileModal}
            onClose={() => setShowProfileModal(false)}
            profile={null}
            onSaveProfile={handleSaveProfile}
          />
        </>
      )}
    </>
  );
};

export default Header;
