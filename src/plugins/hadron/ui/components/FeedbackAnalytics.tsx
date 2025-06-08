/**
 * Feedback Analytics Dashboard Component
 * 
 * Displays analytics and insights from user feedback on AI analyses
 */

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../../client/components/ui/card';
import { Button } from '../../../../client/components/ui/button';
import { Badge } from '../../../../client/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../../client/components/ui/tabs';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import {
  Star,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle,
  XCircle,
  Download,
  RefreshCw,
  Calendar
} from 'lucide-react';
import { apiClient } from '@/utils/api-client';
import { FeedbackStats, FeedbackAnalysis } from '../../src/services/feedback/feedback-service';
import { createClientLogger } from '@/client/utils/client-logger';

const logger = createClientLogger({ serviceName: 'feedback-analytics' });

interface FeedbackAnalyticsProps {
  crashType?: string;
  dateRange?: {
    startDate: Date;
    endDate: Date;
  };
}

export const FeedbackAnalytics: React.FC<FeedbackAnalyticsProps> = ({
  crashType,
  dateRange
}) => {
  const [stats, setStats] = useState<FeedbackStats | null>(null);
  const [analysis, setAnalysis] = useState<FeedbackAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);

  useEffect(() => {
    loadAnalytics();
  }, [crashType, dateRange]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch feedback statistics
      const statsParams = new URLSearchParams();
      if (dateRange) {
        statsParams.append('startDate', dateRange.startDate.toISOString());
        statsParams.append('endDate', dateRange.endDate.toISOString());
      }
      if (selectedModel) {
        statsParams.append('llmModel', selectedModel);
      }

      const [statsResponse, analysisResponse] = await Promise.all([
        apiClient.get(`/api/crash-analyzer/feedback/stats?${statsParams}`),
        apiClient.get('/api/crash-analyzer/feedback/patterns')
      ]);

      setStats(statsResponse.data.data);
      setAnalysis(analysisResponse.data.data);
    } catch (err) {
      logger.error('Failed to load analytics', { error: err });
      setError('Failed to load feedback analytics');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format: 'json' | 'csv') => {
    try {
      const response = await apiClient.get(`/api/crash-analyzer/feedback/export?format=${format}`, {
        responseType: 'blob'
      });
      
      const url = URL.createObjectURL(response.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `feedback-export-${new Date().toISOString()}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      logger.error('Failed to export data', { error: err });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-md">
        {error || 'No data available'}
      </div>
    );
  }

  // Prepare chart data
  const ratingDistribution = [
    { rating: 'Very Poor', count: 0 },
    { rating: 'Poor', count: 0 },
    { rating: 'Neutral', count: 0 },
    { rating: 'Good', count: 0 },
    { rating: 'Excellent', count: 0 }
  ];

  // Calculate rating distribution (would need actual data from API)
  const avgRating = stats.averageRating;
  const totalFeedback = stats.totalFeedback;

  const COLORS = ['#ef4444', '#f59e0b', '#6b7280', '#10b981', '#3b82f6'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Feedback Analytics</h2>
          <p className="text-muted-foreground">
            Insights from {stats.totalFeedback} feedback submissions
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport('csv')}
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport('json')}
          >
            <Download className="h-4 w-4 mr-2" />
            Export JSON
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={loadAnalytics}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Average Rating</p>
                <div className="flex items-center gap-2 mt-2">
                  <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                  <span className="text-2xl font-bold">
                    {stats.averageRating.toFixed(1)}
                  </span>
                  <span className="text-sm text-muted-foreground">/ 5</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Accuracy Score</p>
                <div className="flex items-center gap-2 mt-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span className="text-2xl font-bold">
                    {(stats.accuracyScore * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Usefulness Score</p>
                <div className="flex items-center gap-2 mt-2">
                  <TrendingUp className="h-5 w-5 text-blue-500" />
                  <span className="text-2xl font-bold">
                    {(stats.usefulnessScore * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Feedback</p>
                <div className="flex items-center gap-2 mt-2">
                  <AlertCircle className="h-5 w-5 text-purple-500" />
                  <span className="text-2xl font-bold">{stats.totalFeedback}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Analytics */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="models">Model Performance</TabsTrigger>
          <TabsTrigger value="issues">Common Issues</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {analysis && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Strengths</CardTitle>
                  <CardDescription>What's working well</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {analysis.strengths.map((strength, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                        <span className="text-sm">{strength}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Areas for Improvement</CardTitle>
                  <CardDescription>What needs attention</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {analysis.weaknesses.map((weakness, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <XCircle className="h-5 w-5 text-red-500 mt-0.5" />
                        <span className="text-sm">{weakness}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle>Recommendations</CardTitle>
                  <CardDescription>Suggested improvements</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {analysis.recommendations.map((rec, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <AlertCircle className="h-5 w-5 text-blue-500 mt-0.5" />
                        <span className="text-sm">{rec}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="models" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Model Performance Comparison</CardTitle>
              <CardDescription>
                Performance metrics across different LLM models
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={Object.entries(stats.modelPerformance).map(([model, perf]) => ({
                      model,
                      rating: perf.avgRating,
                      accuracy: perf.avgAccuracy * 100,
                      count: perf.count
                    }))}
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="model" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="rating" fill="#3b82f6" name="Avg Rating" />
                    <Bar dataKey="accuracy" fill="#10b981" name="Accuracy %" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="issues" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Common Issues</CardTitle>
              <CardDescription>
                Most frequently reported problems
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats.commonIssues.map((issue, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <span className="text-sm">{issue.issue}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">
                        {issue.count} reports
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {issue.percentage.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Performance Trends</CardTitle>
              <CardDescription>
                Rating and accuracy trends over time
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={stats.improvementTrends}
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(date) => new Date(date).toLocaleDateString()}
                    />
                    <YAxis />
                    <Tooltip 
                      labelFormatter={(date) => new Date(date).toLocaleDateString()}
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="rating" 
                      stroke="#3b82f6" 
                      name="Average Rating"
                    />
                    <Line 
                      type="monotone" 
                      dataKey={(d) => d.accuracy * 100} 
                      stroke="#10b981" 
                      name="Accuracy %"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};