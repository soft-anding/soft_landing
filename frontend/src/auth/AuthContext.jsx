import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { DEMO } from "../demo";

const AuthContext = createContext(null);

// Fake "logged-in" session used only in demo mode so screens are reachable
// without Google sign-in.
const DEMO_SESSION = {
  user: { id: "demo-user", email: "demo@example.com", user_metadata: { full_name: "אורחת (תצוגה)" } },
};

export function AuthProvider({ children }) {
  const [session, setSession] = useState(DEMO ? DEMO_SESSION : null);
  const [loading, setLoading] = useState(!DEMO);

  useEffect(() => {
    if (DEMO) return; // skip real auth entirely
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => subscription.unsubscribe();
  }, []);

  const signInWithGoogle = () => {
    if (DEMO) {
      setSession(DEMO_SESSION);
      return Promise.resolve({ error: null });
    }
    return supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
  };

  const signOut = () => {
    if (DEMO) {
      setSession(null);
      return Promise.resolve({ error: null });
    }
    return supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
