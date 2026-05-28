// src/pages/AdminUsers.tsx
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

export default function AdminUsers() {
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    // don't call admin_list_users again here
    // we just standardize on /admin/users
    // if not logged in, send to home (or you can send to /)
    if (!user) {
      navigate("/", { replace: true });
      return;
    }
    navigate("/admin/users", { replace: true });
  }, [navigate, user]);

  return (
    <div className="p-6 text-sm text-muted-foreground">
      Redirecting to admin users…
    </div>
  );
}
