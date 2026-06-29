import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { dashboardCacheKey, prefetchDashboard, readDashboardCache } from "../dashboardCache";

const AuthContext = createContext(null);

async function loadProfile(userId) {
  const { data } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  return data ?? false; // false = authenticated but no profile row (or table error)
}

export function AuthProvider({ children }) {
  const [session, setSession]         = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading]         = useState(true);

  useEffect(() => {
    let active = true;
    let initialized = false;
    let currentUserId = null;

    // Use onAuthStateChange as the single source of truth for session state.
    // INITIAL_SESSION fires immediately with the current session (null if logged out,
    // or the stored session if logged in). Supabase-js ALSO silently re-validates the
    // stored session every time the tab regains focus, and re-fires SIGNED_IN even
    // though the user never actually signed in again — confirmed via console logging
    // (event=SIGNED_IN, initialized=true, fired within ~1ms of a visibilitychange to
    // "visible"). Treating every SIGNED_IN/SIGNED_OUT as a real transition made the
    // whole app unmount to a loading spinner and refetch on every tab switch. Only
    // react to it when the signed-in user id actually changed.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (!active) return;

        const newUserId = newSession?.user?.id ?? null;
        const isRealTransition =
          (event === "SIGNED_IN" && newUserId !== currentUserId) ||
          (event === "SIGNED_OUT" && currentUserId !== null);

        if (initialized && !isRealTransition) return;

        setLoading(true);
        setSession(newSession);
        currentUserId = newUserId;

        if (newSession?.user) {
          const profile = await loadProfile(newSession.user.id);
          if (active) {
            // Prefetch dashboard data before navigating so the user doesn't see a loading spinner.
            // Only wait when the cache is empty (fresh login / new tab) — on page refreshes the
            // cache already exists so we skip the await to keep auth fast.
            if (profile && profile.destination_city) {
              const cacheKey = dashboardCacheKey(profile.destination_city);
              if (!readDashboardCache(cacheKey)) {
                await prefetchDashboard(profile.destination_city).catch(() => {});
              }
            }
            setUserProfile(profile);
          }
        } else {
          if (active) setUserProfile(false);
        }

        initialized = true;
        if (active) setLoading(false);
      }
    );

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const signInWithGoogle = () => {
    return supabase.auth.signInWithOAuth({
      provider: "google",
      // Redirect back to the root so the post-login routing logic in App.jsx
      // decides where to send the user (dashboard or onboarding).
      options: { redirectTo: window.location.origin + "/" },
    });
  };

  const signOut = () => {
    return supabase.auth.signOut();
  };

  // Call after the onboarding form inserts the user_profiles row so the router
  // re-evaluates without a full page reload.
  const refreshProfile = async () => {
    if (!session?.user) return;
    setUserProfile(await loadProfile(session.user.id));
  };

  return (
    <AuthContext.Provider value={{
      session,
      user: session?.user ?? null,
      userProfile,   // null = loading, false = no row, object = profile exists
      loading,
      signInWithGoogle,
      signOut,
      refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
