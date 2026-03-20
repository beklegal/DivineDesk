import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { isChurchWorkspaceLocked } from "@/lib/billing";
import { Loader } from "lucide-react";

interface ProtectedRouteProps {
  children: ReactNode;
  requireSuperAdmin?: boolean;
}

export function ProtectedRoute({ children, requireSuperAdmin }: ProtectedRouteProps) {
  const { church, isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();
  const isSubscriptionRoute = location.pathname === "/subscription";
  const isLockedChurchWorkspace =
    user?.role !== "super_admin" && isChurchWorkspaceLocked(church);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <Loader className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // If the page requires super admin and user isn't one, redirect to dashboard
  if (requireSuperAdmin && user?.role !== "super_admin") {
    return <Navigate to="/dashboard" replace />;
  }

  // If user is super admin trying to access regular church dashboard, redirect to admin dashboard
  if (user?.role === "super_admin" && location.pathname === "/dashboard") {
    return <Navigate to="/admin-dashboard" replace />;
  }

  // If user is not super admin trying to access admin pages, redirect to dashboard
  if (user?.role !== "super_admin" && location.pathname.startsWith("/admin")) {
    return <Navigate to="/dashboard" replace />;
  }

  if (isLockedChurchWorkspace && !isSubscriptionRoute) {
    return <Navigate to="/subscription" replace />;
  }

  if (!isLockedChurchWorkspace && isSubscriptionRoute) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
