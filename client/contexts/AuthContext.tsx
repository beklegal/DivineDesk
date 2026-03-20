import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import {
  AuthResponse,
  User,
  Church,
  ChurchBranch,
  SubscriptionPlanKey,
} from "@shared/api";

interface AuthContextType {
  user: User | null;
  church: Church | null;
  branch: ChurchBranch | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<AuthResponse>;
  signup: (
    churchName: string,
    adminName: string,
    email: string,
    password: string,
    churchSize: "small" | "medium" | "large",
    billingPlanKey: SubscriptionPlanKey,
  ) => Promise<AuthResponse>;
  logout: () => void;
  refreshSession: () => Promise<void>;
  updateChurch: (church: Church | null) => void;
  updateBranch: (branch: ChurchBranch | null) => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [church, setChurch] = useState<Church | null>(null);
  const [branch, setBranch] = useState<ChurchBranch | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const persistSession = (nextSession: {
    token: string;
    user: User;
    church: Church | null;
    branch?: ChurchBranch | null;
  }) => {
    setToken(nextSession.token);
    setUser(nextSession.user);
    setChurch(nextSession.church);
    setBranch(nextSession.branch ?? null);

    localStorage.setItem("divinedesk_token", nextSession.token);
    localStorage.setItem("divinedesk_user", JSON.stringify(nextSession.user));
    localStorage.setItem("divinedesk_church", JSON.stringify(nextSession.church));
    localStorage.setItem("divinedesk_branch", JSON.stringify(nextSession.branch ?? null));
  };

  const clearSession = () => {
    setToken(null);
    setUser(null);
    setChurch(null);
    setBranch(null);
    localStorage.removeItem("divinedesk_token");
    localStorage.removeItem("divinedesk_user");
    localStorage.removeItem("divinedesk_church");
    localStorage.removeItem("divinedesk_branch");
  };

  const refreshSession = async () => {
    const activeToken = token ?? localStorage.getItem("divinedesk_token");

    if (!activeToken) {
      clearSession();
      return;
    }

    const response = await fetch("/api/auth/me", {
      headers: {
        Authorization: `Bearer ${activeToken}`,
      },
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);

      if (response.status === 401) {
        clearSession();
        return;
      }

      throw new Error(data?.error || "Failed to refresh session");
    }

    const data = await response.json();
    persistSession({
      token: activeToken,
      user: data.data.user,
      church: data.data.church,
      branch: data.data.branch ?? null,
    });
  };

  useEffect(() => {
    let isMounted = true;

    const bootstrapSession = async () => {
      const storedToken = localStorage.getItem("divinedesk_token");
      const storedUser = localStorage.getItem("divinedesk_user");
      const storedChurch = localStorage.getItem("divinedesk_church");
      const storedBranch = localStorage.getItem("divinedesk_branch");

      if (!storedToken || !storedUser) {
        if (isMounted) {
          setIsLoading(false);
        }
        return;
      }

      try {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
        setChurch(storedChurch ? JSON.parse(storedChurch) : null);
        setBranch(storedBranch ? JSON.parse(storedBranch) : null);

        await refreshSession();
      } catch (sessionError) {
        if (isMounted) {
          setError(
            sessionError instanceof Error
              ? sessionError.message
              : "Failed to refresh session",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void bootstrapSession();

    return () => {
      isMounted = false;
    };
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Login failed");
      }

      const data = await response.json();
      persistSession({
        token: data.token,
        user: data.user,
        church: data.church,
        branch: data.branch ?? null,
      });

      // Return the auth data for use in login handler
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Login failed";
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (
    churchName: string,
    adminName: string,
    email: string,
    password: string,
    churchSize: "small" | "medium" | "large",
    billingPlanKey: SubscriptionPlanKey,
  ) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          churchName,
          adminName,
          email,
          password,
          churchSize,
          billingPlanKey,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Sign up failed");
      }

      const data = await response.json();
      persistSession({
        token: data.token,
        user: data.user,
        church: data.church,
        branch: data.branch ?? null,
      });

      // Return the auth data for use in signup handler
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sign up failed";
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    clearSession();
  };

  const updateChurch = (nextChurch: Church | null) => {
    setChurch(nextChurch);
    localStorage.setItem("divinedesk_church", JSON.stringify(nextChurch));
  };

  const updateBranch = (nextBranch: ChurchBranch | null) => {
    setBranch(nextBranch);
    localStorage.setItem("divinedesk_branch", JSON.stringify(nextBranch));
  };

  const value: AuthContextType = {
    user,
    church,
    branch,
    token,
    isLoading,
    error,
    login,
    signup,
    logout,
    refreshSession,
    updateChurch,
    updateBranch,
    isAuthenticated: !!user && !!token,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
