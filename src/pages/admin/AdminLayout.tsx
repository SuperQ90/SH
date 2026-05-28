// src/pages/admin/AdminLayout.tsx
import { Outlet, NavLink } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

type DBProfile = {
  role: "free" | "paid" | "admin" | null;
  display_name: string | null;
  email: string | null;
};

const LEGACY_ADMIN_EMAIL = "mrutter@gmail.com";
const ADMIN_DOMAIN = "@pledge.ai";

export default function AdminLayout() {
  const { user, loading } = useAuth();
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [displayName, setDisplayName] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      console.log("[admin] check start", { loading, user: user?.email });

      // auth still mounting → effect will re-run when loading changes
      if (loading) return;

      // not signed in → deny, but UNBLOCK
      if (!user) {
        console.log("[admin] no user → deny");
        if (!cancelled) {
          setAllowed(false);
          setChecking(false);
        }
        return;
      }

      const email = user.email?.toLowerCase() ?? "";

      // 1) fast path: hardcoded / domain-based admin
      const emailIsAdmin =
        email === LEGACY_ADMIN_EMAIL ||
        (email && email.endsWith(ADMIN_DOMAIN));

      if (emailIsAdmin) {
        console.log("[admin] allowed via email/domain");
        if (!cancelled) {
          setAllowed(true);
          setDisplayName(email);
          setChecking(false);
        }
        return;
      }

      // 2) slow path: check DB profile
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("role, display_name, email")
          // we’ve had mixed inserts (id vs user_id), so check both
          .or(`id.eq.${user.id},user_id.eq.${user.id}`)
          .maybeSingle();

        if (cancelled) return;

        if (error) {
          console.warn("[admin] profile error → deny but unblock", error);
          setAllowed(false);
          setChecking(false);
          return;
        }

        const isAdmin = data?.role === "admin";
        console.log("[admin] profile result", data, "isAdmin:", isAdmin);

        setAllowed(isAdmin);
        setDisplayName(
          data?.display_name || data?.email || user.email || "Admin"
        );
        setChecking(false);
      } catch (err) {
        if (cancelled) return;
        console.warn("[admin] fatal profile fetch → deny but unblock", err);
        setAllowed(false);
        setChecking(false);
      }
    };

    void run();

    // hard safety: never spin forever
    const safety = setTimeout(() => {
      if (!cancelled) {
        console.warn("[admin] safety timeout fired → forcing UI to unblock");
        setChecking(false);
      }
    }, 5000);

    return () => {
      cancelled = true;
      clearTimeout(safety);
    };
  }, [user, loading]);

  if (checking) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center">
        <p>Checking admin access…</p>
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col items-center justify-center gap-2">
        <h1 className="text-2xl font-bold">Not authorized</h1>
        <p className="text-slate-400">
          Signed in as {user?.email ?? "anonymous"}, but you don&apos;t have
          admin rights.
        </p>
        <p className="text-slate-500 text-sm">
          Set <code>role = 'admin'</code> in <code>public.profiles</code> for
          this user to enable admin.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <header className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">AI Music Radio – Admin</h1>
        <p className="text-sm text-slate-300">
          {displayName || user?.email || "Admin"}
        </p>
      </header>
      <div className="flex">
        <nav className="w-60 border-r border-slate-800 min-h-[calc(100vh-4rem)] bg-slate-950/40">
          <ul className="flex flex-col">
            <li>
              <NavLink
                to="/admin/users"
                className={({ isActive }) =>
                  `block px-5 py-3 text-sm ${
                    isActive ? "bg-slate-800 text-sky-300" : "text-slate-200"
                  }`
                }
              >
                Users
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/admin/songs"
                className={({ isActive }) =>
                  `block px-5 py-3 text-sm ${
                    isActive ? "bg-slate-800 text-sky-300" : "text-slate-200"
                  }`
                }
              >
                Songs
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/admin/featured"
                className={({ isActive }) =>
                  `block px-5 py-3 text-sm ${
                    isActive ? "bg-slate-800 text-sky-300" : "text-slate-200"
                  }`
                }
              >
                Featured Songs
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/admin/payments"
                className={({ isActive }) =>
                  `block px-5 py-3 text-sm ${
                    isActive ? "bg-slate-800 text-sky-300" : "text-slate-200"
                  }`
                }
              >
                Payments
              </NavLink>
            </li>
          </ul>
        </nav>
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
