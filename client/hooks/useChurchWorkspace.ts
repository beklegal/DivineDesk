import { useEffect, useState } from "react";
import { ChurchWorkspace } from "@shared/api";
import { useAuth } from "@/contexts/AuthContext";

interface UseChurchWorkspaceOptions {
  enabled?: boolean;
}

export function useChurchWorkspace(options: UseChurchWorkspaceOptions = {}) {
  const { enabled = true } = options;
  const { isAuthenticated, token } = useAuth();
  const [workspace, setWorkspace] = useState<ChurchWorkspace | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchWorkspace = async () => {
    if (!enabled || !isAuthenticated || !token) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/church/workspace", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || "Failed to load church workspace");
      }

      const payload = await response.json();
      setWorkspace(payload.data);
    } catch (workspaceError) {
      setError(
        workspaceError instanceof Error
          ? workspaceError.message
          : "Failed to load church workspace",
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkspace();
  }, [enabled, isAuthenticated, token]);

  return {
    workspace,
    branches: workspace?.branches ?? [],
    branchAdmins: workspace?.branchAdmins ?? [],
    currentBranch: workspace?.currentBranch ?? null,
    isLoading,
    error,
    refetch: fetchWorkspace,
  };
}
