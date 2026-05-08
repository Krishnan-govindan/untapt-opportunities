import { redirect } from "@tanstack/react-router";
import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export async function requireAuth(currentPath: string) {
  if (typeof window === "undefined") return;
  const { data } = await supabase.auth.getSession();
  if (!data.session) {
    throw redirect({ to: "/auth", search: { redirect: currentPath } });
  }
  return data.session;
}

export function useRequireAuth(currentPath: string) {
  const { loading, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate({ to: "/auth", search: { redirect: currentPath }, replace: true });
    }
  }, [currentPath, loading, navigate, user]);

  return { loading, user };
}
