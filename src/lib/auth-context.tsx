import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

const GUEST_ID_KEY = "untapt-guest-id:v1";
const GUEST_ACTIVE_KEY = "untapt-guest-active:v1";
const GUEST_EMAIL_KEY = "untapt-guest-email:v1";

function createGuestId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function readGuestState() {
  if (typeof window === "undefined") {
    return { guestId: null, guestEmail: null, isGuest: false };
  }

  const isGuest = window.localStorage.getItem(GUEST_ACTIVE_KEY) === "true";
  let guestId = window.localStorage.getItem(GUEST_ID_KEY);
  if (isGuest && !guestId) {
    guestId = createGuestId();
    window.localStorage.setItem(GUEST_ID_KEY, guestId);
  }

  return {
    guestId,
    guestEmail: window.localStorage.getItem(GUEST_EMAIL_KEY),
    isGuest,
  };
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  guestId: string | null;
  guestEmail: string | null;
  isGuest: boolean;
  loading: boolean;
  continueAsGuest: (email?: string) => void;
  setGuestEmail: (email: string) => void;
  clearGuest: () => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [guestState, setGuestState] = useState(readGuestState);
  const [loading, setLoading] = useState(true);

  const clearGuest = () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(GUEST_ACTIVE_KEY);
      window.localStorage.removeItem(GUEST_EMAIL_KEY);
    }
    setGuestState((current) => ({ ...current, guestEmail: null, isGuest: false }));
  };

  const continueAsGuest = (email?: string) => {
    if (typeof window === "undefined") return;
    const guestId = window.localStorage.getItem(GUEST_ID_KEY) ?? createGuestId();
    window.localStorage.setItem(GUEST_ID_KEY, guestId);
    window.localStorage.setItem(GUEST_ACTIVE_KEY, "true");
    const trimmedEmail = email?.trim().toLowerCase();
    if (trimmedEmail) window.localStorage.setItem(GUEST_EMAIL_KEY, trimmedEmail);
    setGuestState({
      guestId,
      guestEmail: trimmedEmail || window.localStorage.getItem(GUEST_EMAIL_KEY),
      isGuest: true,
    });
  };

  const setGuestEmail = (email: string) => {
    if (typeof window === "undefined") return;
    const trimmedEmail = email.trim().toLowerCase();
    window.localStorage.setItem(GUEST_EMAIL_KEY, trimmedEmail);
    continueAsGuest(trimmedEmail);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session) clearGuest();
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_, s) => {
      setSession(s);
      if (s) clearGuest();
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        guestId: guestState.guestId,
        guestEmail: guestState.guestEmail,
        isGuest: !session && guestState.isGuest,
        loading,
        continueAsGuest,
        setGuestEmail,
        clearGuest,
        signOut: async () => {
          clearGuest();
          await supabase.auth.signOut();
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
