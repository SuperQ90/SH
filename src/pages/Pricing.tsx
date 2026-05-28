// src/pages/Pricing.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import StripeCheckout from "@/components/StripeCheckout";
import { Music, ShieldCheck, Crown, AlertCircle, Zap } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";

type ProfileRow = {
  subscription_status: string | null;
  subscription_plan: string | null;
  role: "free" | "paid" | "admin" | null;
  is_grandfathered?: boolean | null;
};

export default function Pricing() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<ProfileRow | null>(null);

  // derive flags
  const isLoggedIn = !!user;
  const email = user?.email?.toLowerCase() ?? "";
  const isAdminEmail =
    email === "mrutter@gmail.com" || email.endsWith("@pledge.ai");

  const subscriptionStatus = profile?.subscription_status ?? null;
  const subscriptionPlan = profile?.subscription_plan ?? null;
  const isAdminRole = profile?.role === "admin" || isAdminEmail;
  const isLegacy =
    profile?.is_grandfathered === true || subscriptionStatus === null;
  const isPremium =
    subscriptionStatus === "active" || profile?.role === "paid" || isAdminRole;

  useEffect(() => {
    const loadProfile = async () => {
      if (!user) {
        setProfile(null);
        return;
      }
      setLoading(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("subscription_status, subscription_plan, role, is_grandfathered")
        .or(`id.eq.${user.id},user_id.eq.${user.id}`)
        .maybeSingle();

      if (error) {
        console.warn("[pricing] profile load error", error);
        setProfile(null);
      } else {
        setProfile(data as ProfileRow);
      }
      setLoading(false);
    };

    void loadProfile();
  }, [user]);

  const handleSignInRequired = () => {
    // Navigate to home page with state to open auth modal
    navigate('/', { state: { openAuthModal: true } });
  };


  return (
    <div className="min-h-screen bg-slate-950 relative overflow-hidden">
      {/* ambient neon glows */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 -left-24 h-64 w-64 rounded-full bg-emerald-500/15 blur-3xl" />
        <div className="absolute -bottom-24 -right-24 h-64 w-64 rounded-full bg-cyan-500/15 blur-3xl" />
      </div>

      {/* Hero Section */}
      <div className="relative max-w-7xl mx-auto px-6 py-16 md:py-24 text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-xl border border-cyan-400/30 bg-slate-900/40 shadow-[0_0_20px_rgba(34,211,238,0.35)]">
          <Music className="w-8 h-8 text-cyan-300" />
        </div>

        <h1 className="text-4xl md:text-6xl font-extrabold mb-4 md:mb-6 bg-gradient-to-r from-emerald-300 via-cyan-300 to-emerald-300 bg-clip-text text-transparent drop-shadow-[0_0_20px_rgba(16,185,129,0.25)]">
          Upgrade Your Music Experience
        </h1>

        <p className="text-lg md:text-xl text-slate-300 max-w-3xl mx-auto">
          Upload more music, stay featured, and unlock premium tools. Legacy
          users keep their perks unless they choose to upgrade.
        </p>

        {/* STATE BANNER */}
        <div className="mt-6 flex justify-center">
          {loading ? (
            <div className="px-4 py-2 rounded bg-slate-900/60 border border-slate-700 text-slate-200 text-sm">
              Checking your plan...
            </div>
          ) : !isLoggedIn ? (
            <div className="px-4 py-2 rounded bg-amber-900/40 border border-amber-500/40 text-amber-100 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              You&apos;re not signed in. Sign in to see if you&apos;re legacy or
              premium.
            </div>
          ) : isAdminRole ? (
            <div className="px-4 py-2 rounded bg-emerald-900/40 border border-emerald-500/40 text-emerald-100 text-sm flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" />
              You are an admin. You already have full access.
            </div>
          ) : isLegacy ? (
            <div className="px-4 py-2 rounded bg-cyan-900/40 border border-cyan-500/40 text-cyan-100 text-sm flex items-center gap-2">
              <Crown className="w-4 h-4" />
              You&apos;re on the legacy plan. You can keep using premium
              features.
            </div>
          ) : isPremium ? (
            <div className="px-4 py-2 rounded bg-emerald-900/40 border border-emerald-500/40 text-emerald-100 text-sm flex items-center gap-2">
              <Crown className="w-4 h-4" />
              You already have an active subscription
              {subscriptionPlan ? ` (${subscriptionPlan})` : ""}.
            </div>
          ) : (
            <div className="px-4 py-2 rounded bg-slate-900/60 border border-slate-700 text-slate-100 text-sm">
              You&apos;re on the free plan. Upgrade below.
            </div>
          )}
        </div>
      </div>

      {/* Pricing / Stripe */}
      <div className="relative pb-24">
        <div className="max-w-3xl mx-auto px-6">
          {!isLoggedIn ? (
            <div className="bg-slate-900/70 border border-cyan-400/20 rounded-xl p-6 text-center space-y-3 shadow-[0_0_20px_rgba(34,211,238,0.15)]">
              <h2 className="text-xl font-semibold text-slate-100">
                Sign in to upgrade
              </h2>
              <p className="text-slate-300 text-sm">
                We need to link the payment to your account.
              </p>
              <Button
                onClick={handleSignInRequired}
                className="h-9 px-4 bg-emerald-500 hover:bg-emerald-600 text-black font-semibold shadow-[0_0_18px_rgba(16,185,129,0.45)]"
              >
                <Zap className="w-4 h-4 mr-2" />
                Go to Sign In
              </Button>
            </div>
          ) : isAdminRole || isLegacy || isPremium ? (
            <div className="bg-slate-900/70 border border-emerald-400/20 rounded-xl p-6 text-center space-y-3 shadow-[0_0_20px_rgba(16,185,129,0.15)]">
              <h2 className="text-xl font-semibold text-slate-100">
                You don&apos;t need to upgrade
              </h2>
              <p className="text-slate-300 text-sm">
                Your account already has the level of access we give to older or
                privileged users.
              </p>
            </div>
          ) : (
            // Only branch that renders Stripe
            <div className="rounded-xl border border-cyan-400/20 bg-slate-900/70 p-4 shadow-[0_0_20px_rgba(34,211,238,0.12)]">
              <StripeCheckout />
            </div>
          )}
        </div>
      </div>

      {/* Features Grid */}
      <div className="bg-slate-900/60 py-24 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-12 bg-gradient-to-r from-emerald-300 to-cyan-300 bg-clip-text text-transparent">
            Why Go Premium?
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center bg-emerald-500/15 border border-emerald-400/30 shadow-[0_0_18px_rgba(16,185,129,0.35)]">
                <Music className="w-8 h-8 text-emerald-300" />
              </div>
              <h3 className="text-lg font-semibold mb-1.5">No Ads</h3>
              <p className="text-slate-400 text-sm">
                Enjoy uninterrupted music without any advertisements.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center bg-cyan-500/15 border border-cyan-400/30 shadow-[0_0_18px_rgba(34,211,238,0.35)]">
                <Crown className="w-8 h-8 text-cyan-300" />
              </div>
              <h3 className="text-lg font-semibold mb-1.5">Creator Priority</h3>
              <p className="text-slate-400 text-sm">
                Upload more tracks and get them into playlists faster.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center bg-blue-500/15 border border-blue-400/30 shadow-[0_0_18px_rgba(59,130,246,0.35)]">
                <ShieldCheck className="w-8 h-8 text-blue-300" />
              </div>
              <h3 className="text-lg font-semibold mb-1.5">Better Placement</h3>
              <p className="text-slate-400 text-sm">
                We can prioritize premium uploads in discovery sections.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
