import { useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import Spinner from "./components/Spinner";
import TaskAgentChat, { TaskAgentFab } from "./components/TaskAgentChat";
import CategoryView from "./pages/CategoryView";
import Dashboard from "./pages/Dashboard";
import ItemDetail from "./pages/ItemDetail";
import Login from "./pages/Login";
import OnboardingLayout from "./pages/OnboardingLayout";
import OnboardingStep1 from "./pages/OnboardingStep1";
import OnboardingStep2 from "./pages/OnboardingStep2";
import OnboardingStep3 from "./pages/OnboardingStep3";

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
  const [agentOpen, setAgentOpen] = useState(false);

  // Lives above <Routes> (not inside Dashboard) so navigating to a category
  // or item-detail page and back doesn't unmount it and lose the conversation —
  // only "סיים שיחה" inside the chat itself should reset it.
  const showAgent = Boolean(session && userProfile);

  return (
    <>
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

      {/* Onboarding — 3-step flow, guard + shared state in OnboardingLayout */}
      <Route path="/onboarding" element={<OnboardingLayout />}>
        <Route index element={<Navigate to="step-1" replace />} />
        <Route path="step-1" element={<OnboardingStep1 />} />
        <Route path="step-2" element={<OnboardingStep2 />} />
        <Route path="step-3" element={<OnboardingStep3 />} />
      </Route>

      {/* Protected app — session + profile required */}
      <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
      <Route path="/category/:slug" element={<RequireAuth><CategoryView /></RequireAuth>} />
      <Route path="/item/:itemType/:itemId" element={<RequireAuth><ItemDetail /></RequireAuth>} />

      {/* Catch-all → landing */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>

    {showAgent && (
      <>
        {!agentOpen && <TaskAgentFab onClick={() => setAgentOpen(true)} />}
        <TaskAgentChat open={agentOpen} onClose={() => setAgentOpen(false)} />
      </>
    )}
    </>
  );
}
