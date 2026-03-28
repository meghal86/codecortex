import { useState, useCallback } from 'react';
import { fetchAnalyticsSubsystems, fetchAnalyticsDeserts } from '../services/backend';

export interface KnowledgeDesert {
  intent: string;
  utility_score: number;
  status: string;
}

export function useAnalytics() {
  const [subsystems, setSubsystems] = useState<Record<string, number> | null>(null);
  const [deserts, setDeserts] = useState<KnowledgeDesert[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshAnalytics = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const qs = await fetchAnalyticsSubsystems();
      const qd = await fetchAnalyticsDeserts();
      
      setSubsystems(qs.subsystems || null);
      setDeserts(qd.knowledge_deserts || null);
    } catch (e: any) {
      setError(e.message || 'Failed to load analytics');
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    subsystems,
    deserts,
    isLoading,
    error,
    refreshAnalytics
  };
}
