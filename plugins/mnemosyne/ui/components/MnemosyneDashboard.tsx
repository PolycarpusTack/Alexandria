import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, 
  FileText, 
  GitBranch, 
  Tag, 
  Clock, 
  TrendingUp,
  Upload,
  Download,
  Plus,
  BookOpen,
  Brain,
  Database,
  AlertCircle
} from 'lucide-react';
import { useDashboard } from '../hooks/useDashboard';

const MnemosyneDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { stats, recentNodes, loading: isLoading, error } = useDashboard();

  const QuickAction = ({ icon: Icon, label, path }: any) => (
    <button
      onClick={() => navigate(path)}
      className="flex flex-col items-center p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
    >
      <Icon className="h-6 w-6 mb-2 text-gray-600 dark:text-gray-400" />
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
    </button>
  );

  const StatCard = ({ icon: Icon, label, value, trend }: any) => (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <Icon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
        {trend && (
          <span className="text-sm text-green-600 dark:text-green-400 flex items-center">
            <TrendingUp className="h-3 w-3 mr-1" />
            {trend}
          </span>
        )}
      </div>
      <div className="space-y-1">
        <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value || 0}</p>
        <p className="text-sm text-gray-600 dark:text-gray-400">{label}</p>
      </div>
    </div>
  );

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-900 dark:text-gray-100 font-semibold mb-2">Failed to load dashboard</p>
          <p className="text-gray-600 dark:text-gray-400 text-sm">{error.message}</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Brain className="h-12 w-12 text-gray-400 animate-pulse mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading knowledge base...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Mnemosyne Knowledge Base
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Your personal knowledge management system
        </p>
      </div>

      {/* Quick Actions */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Quick Actions
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <QuickAction 
            icon={Plus} 
            label="New Node" 
            path="/mnemosyne/nodes/new"
          />
          <QuickAction 
            icon={Search} 
            label="Search" 
            path="/mnemosyne/search"
          />
          <QuickAction 
            icon={Upload} 
            label="Import" 
            path="/mnemosyne/import-export"
          />
          <QuickAction 
            icon={BookOpen} 
            label="Templates" 
            path="/mnemosyne/templates"
          />
        </div>
      </div>

      {/* Statistics */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Overview
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard 
            icon={FileText} 
            label="Total Nodes" 
            value={stats?.totalNodes?.toLocaleString()} 
            trend="+12%"
          />
          <StatCard 
            icon={Tag} 
            label="Tags" 
            value={stats?.totalTags} 
          />
          <StatCard 
            icon={GitBranch} 
            label="Connections" 
            value={stats?.totalConnections?.toLocaleString()} 
            trend="+23%"
          />
          <StatCard 
            icon={Clock} 
            label="Recently Updated" 
            value={stats?.recentlyUpdated} 
          />
        </div>
      </div>

      {/* Recent Nodes */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Recent Nodes
        </h2>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="p-4">
            {recentNodes.map((node) => (
              <div 
                key={node.id}
                className="py-3 border-b border-gray-200 dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
                onClick={() => navigate(`/mnemosyne/nodes/${node.id}`)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900 dark:text-gray-100">
                      {node.title}
                    </h3>
                    <div className="flex items-center gap-4 mt-1">
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {new Date(node.metadata.updatedAt).toLocaleDateString()}
                      </span>
                      <div className="flex gap-1">
                        {node.metadata.tags?.slice(0, 3).map((tag: string) => (
                          <span 
                            key={tag}
                            className="text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <FileText className="h-4 w-4 text-gray-400" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MnemosyneDashboard;