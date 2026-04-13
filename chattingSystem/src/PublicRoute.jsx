import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

// Redirects authenticated users away from login/signup pages
function PublicRoute({ children }) {
  const { session, loading } = useAuth();

  if (loading) return null;

  if (session) {
    return <Navigate to="/chat" replace />;
  }

  return children;
}

export default PublicRoute;
