import { useState, useEffect } from 'react';
import { mnemosyneAPI, DashboardStats, KnowledgeNode } from '../api/client';

export const useDashboard = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentNodes, setRecentNodes] = useState<KnowledgeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        
        // Fetch both stats and recent nodes in parallel
        const [statsData, recentData] = await Promise.all([
          mnemosyneAPI.getDashboardStats(),
          mnemosyneAPI.getRecentNodes(5)
        ]);
        
        setStats(statsData);
        setRecentNodes(recentData);
        setError(null);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  return {
    stats,
    recentNodes,
    loading,
    error
  };
};