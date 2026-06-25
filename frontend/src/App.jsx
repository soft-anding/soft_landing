import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import Spinner from "./components/Spinner";
import CategoryView from "./pages/CategoryView";
import Dashboard from "./pages/Dashboard";
import ItemDetail from "./pages/ItemDetail";
import Login from "./pages/Login";

function RequireAuth({ children }) {
  const { session, loading } = useAuth();
  if (loading) return <Spinner full />;
  if (!session) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const { session, loading } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={loading ? <Spinner full /> : session ? <Navigate to="/" replace /> : <Login />}
      />
      <Route
        path="/"
        element={
          <RequireAuth>
            <Dashboard />
          </RequireAuth>
        }
      />
      <Route
        path="/category/:slug"
        element={
          <RequireAuth>
            <CategoryView />
          </RequireAuth>
        }
      />
      <Route
        path="/item/:itemType/:itemId"
        element={
          <RequireAuth>
            <ItemDetail />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
