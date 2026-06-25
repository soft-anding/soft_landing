import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { DEMO } from "../demo";

const AuthContext = createContext(null);

const DEMO_SESSION = {
  user: { id: "demo-user", email: "demo@example.com", user_metadata: { full_name: "אורחת (תצוגה)" } },
};
const DEMO_PROFILE = { id: "demo-user" };

async function loadProfile(userId) {
  const { data } = await supabase
    .from("user_profiles")
    .select("id,move_date,destination_city,interest_categories")
    .eq("id", userId)
    .maybeSingle();
  return data ?? false; // false = authenticated but no profile row (or table error)
}

export function AuthProvider({ children }) {
  const [session, setSession]         = useState(DEMO ? DEMO_SESSION : null);
  const [userProfile, setUserProfile] = useState(DEMO ? DEMO_PROFILE : null);
  const [loading, setLoading]         = useState(!DEMO);

  useEffect(() => {
    if (DEMO) return;

    let active = true;

    // Use onAuthStateChange as the single source of truth for session state.
    // INITIAL_SESSION fires immediately with the current session (null if logged out,
    // or the stored session if logged in). SIGNED_IN fires after OAuth redirects.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (!active) return;

        // While fetching the profile, keep the spinner visible so the router
        // doesn't make a premature redirect based on stale state.
        if (event === "SIGNED_IN" || event === "INITIAL_SESSION") {
          setLoading(true);
        }

        setSession(newSession);

        if (newSession?.user) {
          const profile = await loadProfile(newSession.user.id);
          if (active) setUserProfile(profile);
        } else {
          if (active) setUserProfile(false);
        }

        if (active) setLoading(false);
      }
    );

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const signInWithGoogle = () => {
    if (DEMO) { setSession(DEMO_SESSION); return Promise.resolve({ error: null }); }
    return supabase.auth.signInWithOAuth({
      provider: "google",
      // Redirect back to the root so the post-login routing logic in App.jsx
      // decides where to send the user (dashboard or onboarding).
      options: { redirectTo: window.location.origin + "/" },
    });
  };

  const signOut = () => {
    if (DEMO) {
      setSession(null);
      setUserProfile(false);
      return Promise.resolve({ error: null });
    }
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
