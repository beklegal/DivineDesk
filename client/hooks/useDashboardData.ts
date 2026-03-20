import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardData } from "@shared/api";

interface UseDataOptions {
  refetchInterval?: number; // ms between refetches
  enabled?: boolean;
}

export function useDashboardData(options: UseDataOptions = {}) {
  const { refetchInterval = 5000, enabled = true } = options;
  const { token, isAuthenticated } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !isAuthenticated || !token) return;

    let isMounted = true;
    let interval: NodeJS.Timeout;

    const fetchData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/dashboard", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error("Failed to fetch dashboard data");
        }

        const result = await response.json();

        if (isMounted) {
          setData(result.data);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Unknown error");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    // Fetch immediately
    fetchData();

    // Set up interval for real-time updates
    interval = setInterval(fetchData, refetchInterval);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [token, isAuthenticated, enabled, refetchInterval]);

  const refetch = async () => {
    if (!isAuthenticated || !token) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/dashboard", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch dashboard data");
      }

      const result = await response.json();
      setData(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  };

  return { data, isLoading, error, refetch };
}
