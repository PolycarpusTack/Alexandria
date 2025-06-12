import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Search, 
  Filter, 
  X, 
  Calendar,
  Tag as TagIcon
} from 'lucide-react';

interface SearchFilters {
  query?: string;
  type?: string;
  tags?: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
}

interface SearchFiltersProps {
  filters: SearchFilters;
  onFiltersChange: (filters: SearchFilters) => void;
  onSearch: () => void;
  isLoading?: boolean;
}

export const SearchFiltersComponent: React.FC<SearchFiltersProps> = ({
  filters,
  onFiltersChange,
  onSearch,
  isLoading = false
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [newTag, setNewTag] = useState('');

  const handleQueryChange = (query: string) => {
    onFiltersChange({ ...filters, query });
  };

  const handleTypeChange = (type: string) => {
    onFiltersChange({ ...filters, type: type === 'all' ? undefined : type });
  };

  const handleAddTag = () => {
    if (newTag.trim() && (!filters.tags || !filters.tags.includes(newTag.trim()))) {
      onFiltersChange({
        ...filters,
        tags: [...(filters.tags || []), newTag.trim()]
      });
      setNewTag('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    onFiltersChange({
      ...filters,
      tags: filters.tags?.filter(tag => tag !== tagToRemove)
    });
  };

  const handleDateRangeChange = (field: 'start' | 'end', value: string) => {
    const date = new Date(value);
    onFiltersChange({
      ...filters,
      dateRange: {
        ...filters.dateRange,
        start: filters.dateRange?.start || new Date(),
        end: filters.dateRange?.end || new Date(),
        [field]: date
      }
    });
  };

  const clearFilters = () => {
    onFiltersChange({});
  };

  const hasActiveFilters = filters.query || filters.type || filters.tags?.length || filters.dateRange;

  return (
    <div className="search-filters space-y-4">
      {/* Main Search Bar */}
      <div className="flex items-center space-x-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search knowledge base..."
            value={filters.query || ''}
            onChange={(e) => handleQueryChange(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && onSearch()}
            className="pl-10"
          />
        </div>
        <Button onClick={onSearch} disabled={isLoading}>
          {isLoading ? 'Searching...' : 'Search'}
        </Button>
        <Button
          variant="outline"
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center space-x-1"
        >
          <Filter className="h-4 w-4" />
          <span>Filters</span>
          {hasActiveFilters && (
            <Badge variant="secondary" className="ml-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">
              !
            </Badge>
          )}
        </Button>
      </div>

      {/* Expanded Filters */}
      {isExpanded && (
        <div className="border rounded-lg p-4 space-y-4 bg-gray-50">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">Search Filters</h3>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Clear All
              </Button>
            )}
          </div>

          {/* Type Filter */}
          <div>
            <label className="block text-sm font-medium mb-2">Content Type</label>
            <select
              value={filters.type || 'all'}
              onChange={(e) => handleTypeChange(e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
            >
              <option value="all">All Types</option>
              <option value="document">Documents</option>
              <option value="concept">Concepts</option>
              <option value="template">Templates</option>
              <option value="note">Notes</option>
            </select>
          </div>

          {/* Tags Filter */}
          <div>
            <label className="block text-sm font-medium mb-2">Tags</label>
            
            {/* Active Tags */}
            {filters.tags && filters.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {filters.tags.map(tag => (
                  <Badge key={tag} variant="secondary" className="flex items-center space-x-1">
                    <TagIcon className="h-3 w-3" />
                    <span>#{tag}</span>
                    <button
                      onClick={() => handleRemoveTag(tag)}
                      className="ml-1 hover:text-red-500"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}

            {/* Add Tag Input */}
            <div className="flex items-center space-x-2">
              <Input
                placeholder="Add tag filter..."
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
                className="flex-1"
              />
              <Button onClick={handleAddTag} size="sm">
                Add
              </Button>
            </div>
          </div>

          {/* Date Range Filter */}
          <div>
            <label className="block text-sm font-medium mb-2">Date Range</label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-gray-600 mb-1">From</label>
                <Input
                  type="date"
                  value={filters.dateRange?.start.toISOString().split('T')[0] || ''}
                  onChange={(e) => handleDateRangeChange('start', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">To</label>
                <Input
                  type="date"
                  value={filters.dateRange?.end.toISOString().split('T')[0] || ''}
                  onChange={(e) => handleDateRangeChange('end', e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Active Filters Summary */}
      {hasActiveFilters && (
        <div className="flex items-center space-x-2 text-sm">
          <span className="text-gray-600">Active filters:</span>
          {filters.query && (
            <Badge variant="outline">Query: "{filters.query}"</Badge>
          )}
          {filters.type && (
            <Badge variant="outline">Type: {filters.type}</Badge>
          )}
          {filters.tags && filters.tags.length > 0 && (
            <Badge variant="outline">Tags: {filters.tags.length}</Badge>
          )}
          {filters.dateRange && (
            <Badge variant="outline">Date Range</Badge>
          )}
        </div>
      )}
    </div>
  );
};