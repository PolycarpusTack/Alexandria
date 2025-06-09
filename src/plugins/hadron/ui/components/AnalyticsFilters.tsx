import React from 'react';
import { Card } from '../../../../ui/components';
import { Filter } from 'lucide-react';

interface AnalyticsFiltersProps {
  selectedPlatform: string;
  selectedSeverity: string;
  selectedModel: string;
  onPlatformChange: (platform: string) => void;
  onSeverityChange: (severity: string) => void;
  onModelChange: (model: string) => void;
}

export const AnalyticsFilters: React.FC<AnalyticsFiltersProps> = ({
  selectedPlatform,
  selectedSeverity,
  selectedModel,
  onPlatformChange,
  onSeverityChange,
  onModelChange
}) => {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Filters:</span>
        </div>
        
        <div className="flex gap-4 flex-1">
          {/* Platform Filter */}
          <div className="flex items-center gap-2">
            <label htmlFor="platform-filter" className="text-sm text-muted-foreground">
              Platform:
            </label>
            <select
              id="platform-filter"
              value={selectedPlatform}
              onChange={(e) => onPlatformChange(e.target.value)}
              className="text-sm px-3 py-1 rounded-md border border-input bg-background"
            >
              <option value="all">All Platforms</option>
              <option value="windows">Windows</option>
              <option value="macos">macOS</option>
              <option value="linux">Linux</option>
              <option value="android">Android</option>
              <option value="ios">iOS</option>
            </select>
          </div>

          {/* Severity Filter */}
          <div className="flex items-center gap-2">
            <label htmlFor="severity-filter" className="text-sm text-muted-foreground">
              Severity:
            </label>
            <select
              id="severity-filter"
              value={selectedSeverity}
              onChange={(e) => onSeverityChange(e.target.value)}
              className="text-sm px-3 py-1 rounded-md border border-input bg-background"
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          {/* Model Filter */}
          <div className="flex items-center gap-2">
            <label htmlFor="model-filter" className="text-sm text-muted-foreground">
              AI Model:
            </label>
            <select
              id="model-filter"
              value={selectedModel}
              onChange={(e) => onModelChange(e.target.value)}
              className="text-sm px-3 py-1 rounded-md border border-input bg-background"
            >
              <option value="all">All Models</option>
              <option value="gpt-4">GPT-4</option>
              <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
              <option value="claude-3">Claude 3</option>
              <option value="llama-2-70b">Llama 2 70B</option>
              <option value="mixtral-8x7b">Mixtral 8x7B</option>
            </select>
          </div>
        </div>

        {/* Clear Filters */}
        {(selectedPlatform !== 'all' || selectedSeverity !== 'all' || selectedModel !== 'all') && (
          <button
            onClick={() => {
              onPlatformChange('all');
              onSeverityChange('all');
              onModelChange('all');
            }}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            Clear Filters
          </button>
        )}
      </div>
    </Card>
  );
};