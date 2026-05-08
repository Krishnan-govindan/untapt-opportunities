import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

const GUEST_ID_KEY = "untapt-guest-id:v1";
const GUEST_ACTIVE_KEY = "untapt-guest-active:v1";

function createGuestId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function ensureGuestMode() {
  if (typeof window === "undefined") return;
  const guestId = window.localStorage.getItem(GUEST_ID_KEY) ?? createGuestId();
  window.localStorage.setItem(GUEST_ID_KEY, guestId);
  window.localStorage.setItem(GUEST_ACTIVE_KEY, "true");
}

export async function requireAuth(currentPath: string) {
  if (typeof window === "undefined") return;
  if (window.localStorage.getItem("untapt-guest-active:v1") === "true") return;
  const { data } = await supabase.auth.getSession();
  if (!data.session) ensureGuestMode();
  return data.session;
}

export function useRequireAuth(currentPath: string) {
  const { loading, user, isGuest, guestId, guestEmail, setGuestEmail, continueAsGuest } = useAuth();

  useEffect(() => {
    if (!loading && !user && !isGuest) {
      continueAsGuest();
    }
  }, [continueAsGuest, currentPath, isGuest, loading, user]);

  return { loading, user, isGuest, guestId, guestEmail, setGuestEmail };
}
