import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import Spinner from "./components/Spinner";
import CategoryView from "./pages/CategoryView";
import Dashboard from "./pages/Dashboard";
import ItemDetail from "./pages/ItemDetail";
import Login from "./pages/Login";
import Onboarding from "./pages/Onboarding";

/**
 * Guards /dashboard and its nested routes.
 * - No session   → back to landing page (/)
 * - No profile   → /onboarding to complete signup
 * - Loading      → spinner (prevents premature redirects during profile fetch)
 */
function RequireAuth({ children }) {
  const { session, userProfile, loading } = useAuth();
  if (loading) return <Spinner full />;
  if (!session) return <Navigate to="/" replace />;
  if (userProfile === false) return <Navigate to="/onboarding" replace />;
  return children;
}

export default function App() {
  const { session, userProfile, loading } = useAuth();

  return (
    <Routes>
      {/*
       * "/" is the public landing/login page.
       * Authenticated users are bounced to the right place from here:
       *   • has profile → /dashboard
       *   • no profile  → /onboarding
       * While auth state is being resolved, show a spinner so there's no
       * flash of the login form for already-authenticated users.
       */}
      <Route
        path="/"
        element={
          loading
            ? <Spinner full />
            : session && userProfile
              ? <Navigate to="/dashboard" replace />
              : session && userProfile === false
                ? <Navigate to="/onboarding" replace />
                : <Login />
        }
      />

      {/* Legacy /login → same landing page */}
      <Route path="/login" element={<Navigate to="/" replace />} />

      {/* Onboarding — accessible only to authenticated users without a profile */}
      <Route
        path="/onboarding"
        element={
          loading
            ? <Spinner full />
            : !session
              ? <Navigate to="/" replace />
              : userProfile
                ? <Navigate to="/dashboard" replace />
                : <Onboarding />
        }
      />

      {/* Protected app — session + profile required */}
      <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
      <Route path="/category/:slug" element={<RequireAuth><CategoryView /></RequireAuth>} />
      <Route path="/item/:itemType/:itemId" element={<RequireAuth><ItemDetail /></RequireAuth>} />

      {/* Catch-all → landing */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
