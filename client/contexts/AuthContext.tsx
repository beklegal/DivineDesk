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

async function readJsonResponse<T>(response: Response): Promise<T | null> {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Unexpected server response (${response.status})`);
  }
}

function isAuthResponse(value: AuthResponse | { error?: string } | null): value is AuthResponse {
  return Boolean(
    value &&
      typeof value === "object" &&
      "token" in value &&
      "user" in value,
  );
}

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

    localStorage.setItem("divinedesk_user", JSON.stringify(nextSession.user));
    localStorage.setItem("divinedesk_church", JSON.stringify(nextSession.church));
    localStorage.setItem("divinedesk_branch", JSON.stringify(nextSession.branch ?? null));
  };

  const clearSession = () => {
    setToken(null);
    setUser(null);
    setChurch(null);
    setBranch(null);
    localStorage.removeItem("divinedesk_user");
    localStorage.removeItem("divinedesk_church");
    localStorage.removeItem("divinedesk_branch");
  };

  const refreshSession = async () => {
    const response = await fetch("/api/auth/me", {
      credentials: "include",
    });
    const data = await readJsonResponse<{
      error?: string;
      token?: string;
      data?: {
        user: User;
        church: Church | null;
        branch?: ChurchBranch | null;
      };
    }>(response);

    if (!response.ok) {
      if (response.status === 401) {
        clearSession();
        return;
      }

      throw new Error(data?.error || "Failed to refresh session");
    }

    if (!data?.data?.user) {
      throw new Error("Unexpected session response from server");
    }

    persistSession({
      token: data.token ?? token ?? "",
      user: data.data.user,
      church: data?.data?.church ?? null,
      branch: data?.data?.branch ?? null,
    });
  };

  useEffect(() => {
    let isMounted = true;

    const bootstrapSession = async () => {
      localStorage.removeItem("divinedesk_token");
      const storedUser = localStorage.getItem("divinedesk_user");
      const storedChurch = localStorage.getItem("divinedesk_church");
      const storedBranch = localStorage.getItem("divinedesk_branch");

      try {
        if (storedUser) {
          setUser(JSON.parse(storedUser));
          setChurch(storedChurch ? JSON.parse(storedChurch) : null);
          setBranch(storedBranch ? JSON.parse(storedBranch) : null);
        }

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
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await readJsonResponse<AuthResponse & { error?: string }>(response);

      if (!response.ok) {
        throw new Error(data?.error || "Login failed");
      }

      if (!isAuthResponse(data)) {
        throw new Error("Unexpected login response from server");
      }

      persistSession({
        token: data.token,
        user: data.user,
        church: data.church ?? null,
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
        credentials: "include",
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
      const data = await readJsonResponse<AuthResponse & { error?: string }>(response);

      if (!response.ok) {
        throw new Error(data?.error || "Sign up failed");
      }

      if (!isAuthResponse(data)) {
        throw new Error("Unexpected sign up response from server");
      }

      persistSession({
        token: data.token,
        user: data.user,
        church: data.church ?? null,
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
    void fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    }).catch(() => undefined);
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
    isAuthenticated: !!user,
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
