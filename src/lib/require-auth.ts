import { redirect } from "@tanstack/react-router";
import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export async function requireAuth(currentPath: string) {
  if (typeof window === "undefined") return;
  if (window.localStorage.getItem("untapt-guest-active:v1") === "true") return;
  const { data } = await supabase.auth.getSession();
  if (!data.session) {
    throw redirect({ to: "/auth", search: { redirect: currentPath } });
  }
  return data.session;
}

export function useRequireAuth(currentPath: string) {
  const { loading, user, isGuest, guestId, guestEmail, setGuestEmail } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user && !isGuest) {
      navigate({ to: "/auth", search: { redirect: currentPath }, replace: true });
    }
  }, [currentPath, isGuest, loading, navigate, user]);

  return { loading, user, isGuest, guestId, guestEmail, setGuestEmail };
}
