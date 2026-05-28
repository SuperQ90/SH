// src/contexts/AuthContext.tsx
import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { isProfileStatusDeleted, isUserProfileDeleted } from "@/lib/profileDelete";

/** Billing / plan row from `profiles`, shared across the app. */
export type AuthProfile = {
  role: string | null;
  subscription_status: string | null;
  subscription_plan: string | null;
  plan_source: string | null;
  is_grandfathered: boolean | null;
  display_name: string | null;
  email: string | null;
};

interface AuthContextType {
  user: User | null;
  profile: AuthProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, username: string) => Promise<void>;
  signOut: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
};

type ToastFn = (props: {
  title?: string;
  description?: string;
  variant?: "default" | "destructive";
}) => void;

/** If profile is soft-deleted, clear local session and return true. */
async function signOutIfProfileDeleted(u: User, toast?: ToastFn): Promise<boolean> {
  if (!(await isUserProfileDeleted(u))) return false;

  await supabase.auth.signOut({ scope: "local" });
  toast?.({
    title: "Account deleted",
    description: "This profile has been deleted and is no longer accessible.",
    variant: "destructive",
  });
  return true;
}

// this version ONLY inserts columns that exist in your schema right now
async function loadAuthProfile(userId: string): Promise<AuthProfile | null> {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select(
        "role, subscription_status, subscription_plan, plan_source, is_grandfathered, display_name, email"
      )
      .or(`id.eq.${userId},user_id.eq.${userId}`)
      .maybeSingle();

    if (error) {
      console.warn("[auth] loadAuthProfile failed (non-fatal)", error);
      return null;
    }
    return (data as AuthProfile) ?? null;
  } catch (err) {
    console.warn("[auth] loadAuthProfile crashed (non-fatal)", err);
    return null;
  }
}

async function ensureProfileExists(u: User) {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, user_id, email, role, display_name, status")
      .or(`id.eq.${u.id},user_id.eq.${u.id}`)
      .maybeSingle();

    if (error) {
      console.warn("[auth] profile select failed (non-fatal)", error);
      return;
    }
    if (data) {
      if (isProfileStatusDeleted((data as { status?: string | null }).status)) return;
      return;
    }

    const insertPayload = {
      id: u.id,
      user_id: u.id,
      email: u.email,
      display_name: (u.user_metadata && (u.user_metadata as any).username) || null,
      role: "free" as const,
      status: "Active",
    };

    const { error: insertError } = await supabase.from("profiles").insert(insertPayload);

    if (insertError) console.warn("[auth] profile insert failed (non-fatal)", insertError);
    else console.log("[auth] profile CREATED for", u.email);
  } catch (err) {
    console.warn("[auth] ensureProfileExists crashed (non-fatal)", err);
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { toast } = useToast();

  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const initDoneRef = useRef(false);
  const lastSessionRef = useRef<Session | null>(null);

  // Load profiles row when auth user changes
  useEffect(() => {
    let cancelled = false;

    if (!user?.id) {
      setProfile(null);
      return;
    }

    void loadAuthProfile(user.id).then((row) => {
      if (!cancelled) setProfile(row);
    });

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    let cancelled = false;

    const setFromSession = (s: Session | null) => {
      lastSessionRef.current = s;
      setUser(s?.user ?? null);
    };

    const init = async () => {
      setLoading(true);
      try {
        // Bootstrap from persisted session
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          // If tokens are invalid, clear them locally (don’t nuke global sessions)
          if (error.message?.toLowerCase().includes("refresh token")) {
            console.log("[auth] Invalid refresh token, clearing local session");
            await supabase.auth.signOut({ scope: "local" });
            if (!cancelled) setFromSession(null);
          } else {
            console.error("[auth] getSession error", error);
          }
        } else if (data.session?.user) {
          const deleted = await signOutIfProfileDeleted(data.session.user, toast);
          if (!cancelled) setFromSession(deleted ? null : data.session);
          if (!deleted) void ensureProfileExists(data.session.user);
        } else {
          if (!cancelled) setFromSession(null);
        }
      } catch (err) {
        console.error("[auth] init fatal", err);
        if (!cancelled) setFromSession(null);
      } finally {
        if (!cancelled) {
          initDoneRef.current = true;
          setLoading(false);
        }
      }
    };

    void init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;

      // DO NOT treat INITIAL_SESSION(null) as logout.
      // Let init() decide, and keep previous user if we had one.
      if (event === "INITIAL_SESSION") {
        if (session?.user) {
          void signOutIfProfileDeleted(session.user, toast).then((deleted) => {
            if (cancelled) return;
            if (deleted) {
              setFromSession(null);
            } else {
              setFromSession(session);
              void ensureProfileExists(session.user);
            }
          });
        }
        if (initDoneRef.current) setLoading(false);
        return;
      }

      console.log("[auth] state change:", event, session?.user?.email);

      if (event === "SIGNED_OUT") {
        setFromSession(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      if (session?.user) {
        void signOutIfProfileDeleted(session.user, toast).then((deleted) => {
          if (cancelled) return;
          if (deleted) {
            setFromSession(null);
          } else {
            setFromSession(session);
            void ensureProfileExists(session.user);
          }
        });
      } else {
        // Don’t wipe user on token refresh edge cases unless it’s a real sign-out.
        // If we truly lose session later, SIGNED_OUT will fire.
      }

      setLoading(false);
    });

    // Resume keep-alive (mobile / background)
    const refresh = async () => {
      try {
        await supabase.auth.refreshSession();
      } catch {
        // ignore
      }
    };
    const onFocus = () => void refresh();
    const onVis = () => {
      if (!document.hidden) void refresh();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelled = true;
      subscription.unsubscribe();
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [toast]);

  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        console.error("[auth] signIn error:", error);
        toast({
          title: "Sign In Failed",
          description: "Please check your credentials and try again.",
          variant: "destructive",
        });
        return;
      }

      if (data.user) {
        const deleted = await signOutIfProfileDeleted(data.user, toast);
        if (deleted) {
          setUser(null);
          return;
        }
        setUser(data.user);
        void ensureProfileExists(data.user);
        toast({ title: "Welcome back!", description: `Signed in as: ${data.user.email}` });
      }
    } catch (err) {
      console.error("[auth] signIn fatal:", err);
      toast({
        title: "Sign In Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string, username: string) => {
    try {
      setLoading(true);

      const cleanEmail = email.trim().toLowerCase();
      const cleanUsername = username.trim();

      if (!cleanEmail || !cleanUsername || !password) {
        toast({
          title: "Missing Information",
          description: "Please fill in all fields.",
          variant: "destructive",
        });
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: { data: { username: cleanUsername } },
      });

      if (error) {
        console.error("[auth] signUp error:", error);
        toast({
          title: "Sign Up Failed",
          description: "Please try again with different credentials.",
          variant: "destructive",
        });
        return;
      }

      if (data.user) {
        void ensureProfileExists(data.user);
        toast({
          title: "Account Created!",
          description: "Please check your email to verify your account.",
          duration: 5000,
        });
      }
    } catch (err) {
      console.error("[auth] signUp fatal:", err);
      toast({
        title: "Sign Up Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setLoading(true);
      await supabase.auth.signOut({ scope: "local" });
      setUser(null);
      setProfile(null);
    } catch (err) {
      console.error("[auth] signOut fatal:", err);
      setUser(null);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  const sendPasswordReset = async (email: string) => {
    const clean = email.trim().toLowerCase();
    if (!clean) {
      toast({
        title: "Email required",
        description: "Enter your email to receive a reset link.",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase.auth.resetPasswordForEmail(clean, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;

      toast({ title: "Reset link sent", description: `Check ${clean} for a password reset email.` });
    } catch (err: any) {
      console.error("[auth] resetPassword error:", err);
      toast({
        title: "Could not send reset link",
        description: err?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, profile, loading, signIn, signUp, signOut, sendPasswordReset }}
    >
      {children}
    </AuthContext.Provider>
  );
};
