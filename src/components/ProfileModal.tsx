import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlaylistSelector } from "@/components/PlaylistSelector";
import { Track } from "@/types/music";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { formatUnderscores } from "@/lib/utils";
import { Crown, Users, Music2 } from "lucide-react";

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: any | null;
  onSaveProfile: (profile: any) => void;
  onPlayPlaylist?: (tracks: Track[]) => void;
}

const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  profile,
  onSaveProfile,
  onPlayPlaylist,
}) => {
  const navigate = useNavigate();
  const { user, profile: authProfile } = useAuth();

  const [name, setName] = useState(profile?.name || "");
  const [email, setEmail] = useState(profile?.email || "");

  const plan = authProfile?.subscription_status || "free_legacy";
  const isNewFree =
    plan === "free_new" || authProfile?.plan_source === "auth_bootstrap";
  const emailStr = (authProfile?.email || user?.email || "").toLowerCase();
  const isPledge = emailStr.endsWith("@pledge.ai");
  const isAdmin =
    emailStr === "mrutter@gmail.com" ||
    isPledge ||
    authProfile?.role === "admin";

  const handleSave = () => {
    if (name.trim() && email.trim()) {
      onSaveProfile({
        name: name.trim(),
        email: email.trim(),
        likedTracks: profile?.likedTracks || [],
      });
      onClose();
    }
  };

  const handlePlayPlaylist = (tracks: Track[]) => {
    if (onPlayPlaylist) {
      onPlayPlaylist(tracks);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-cyan-400">My Profile</DialogTitle>
        </DialogHeader>

        {/* plan status */}
        <div className="mb-3 rounded bg-slate-800/50 border border-slate-700/70 p-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm text-slate-100">
              Plan:{" "}
              <span className="font-semibold uppercase tracking-tight">
                {formatUnderscores(plan)}
              </span>
              {isAdmin && " (admin override)"}
            </p>
            {isNewFree && !isAdmin && (
              <p className="text-xs text-amber-100/90 mt-1">
                Uploads are limited on this plan.
              </p>
            )}
          </div>
          {isNewFree && !isAdmin && (
            <Button
              size="sm"
              className="bg-amber-500 text-amber-950 hover:bg-amber-600"
              onClick={() => {
                navigate("/pricing");
                onClose();
              }}
            >
              <Crown className="w-4 h-4 mr-1" />
              Upgrade
            </Button>
          )}
        </div>

        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="stats">Engagement</TabsTrigger>
          </TabsList>



          <TabsContent value="profile" className="space-y-4">
            <div className="grid gap-4">
              <Button
                onClick={() => {
                  navigate("/profile");
                  onClose();
                }}
                variant="outline"
                className="w-full justify-start"
              >
                Edit My Profile
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="stats" className="space-y-4">
            <div className="grid gap-4">
              <Button
                onClick={() => {
                  navigate("/my-likes");
                  onClose();
                }}
                variant="outline"
                className="w-full justify-start"
              >
                View My Liked Songs
              </Button>
              <Button
                onClick={() => {
                  navigate("/top-liked");
                  onClose();
                }}
                variant="outline"
                className="w-full justify-start"
              >
                View Top Liked Songs
              </Button>
              <Button
                onClick={() => {
                  navigate("/top-played");
                  onClose();
                }}
                variant="outline"
                className="w-full justify-start"
              >
                View Top Played Songs
              </Button>
              <Button
                onClick={() => {
                  navigate("/following-artists");
                  onClose();
                }}
                variant="outline"
                className="w-full justify-start"
              >
                <Users className="w-4 h-4 mr-2 shrink-0" />
                Followed Artists
              </Button>
              <Button
                onClick={() => {
                  navigate("/hire-requests");
                  onClose();
                }}
                variant="outline"
                className="w-full justify-start"
              >
                <Music2 className="w-4 h-4 mr-2 shrink-0" />
                Hire Requests
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default ProfileModal;
