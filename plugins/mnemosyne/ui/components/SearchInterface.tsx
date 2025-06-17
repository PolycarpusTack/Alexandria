import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, Calendar, Tag, FileText, Clock, Loader2 } from 'lucide-react';
import { useSearch, useSearchSuggestions } from '../hooks/useSearch';
import { useMnemosyneStore } from '../store';

const SearchInterface: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const { results, loading: isSearching, search } = useSearch();
  const { suggestions } = useSearchSuggestions(searchQuery);
  const { setSearchQuery: setGlobalSearchQuery, setSearchResults } = useMnemosyneStore();

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    try {
      const searchResults = await search({
        query: searchQuery,
        limit: 20
      });
      
      // Save to global store
      setGlobalSearchQuery(searchQuery);
      setSearchResults(searchResults);
    } catch (error) {
      console.error('Search failed:', error);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Search Header */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          Search Knowledge Base
        </h1>
        
        {/* Search Bar */}
        <div className="flex gap-4 mb-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search nodes, tags, content..."
              className="w-full pl-12 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-lg"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={isSearching || !searchQuery.trim()}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSearching ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Searching...
              </>
            ) : (
              'Search'
            )}
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-4">
          <button className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filters
          </button>
          <button className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Date Range
          </button>
          <button className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-2">
            <Tag className="h-4 w-4" />
            Tags
          </button>
        </div>
      </div>

      {/* Search Results */}
      <div className="flex-1 overflow-auto">
        {!results ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">
                Enter a search query to find nodes
              </p>
              {suggestions.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm text-gray-500 mb-2">Suggestions:</p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {suggestions.slice(0, 5).map(suggestion => (
                      <button
                        key={suggestion}
                        onClick={() => {
                          setSearchQuery(suggestion);
                          handleSearch();
                        }}
                        className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-800 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : results.nodes.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">
                No results found for "{searchQuery}"
              </p>
              <p className="text-sm text-gray-500 mt-2">
                Try different keywords or check your spelling
              </p>
            </div>
          </div>
        ) : (
          <div className="p-6">
            <div className="mb-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Found {results.total} results for "{searchQuery}"
              </p>
              {results.facets && (
                <div className="mt-2 flex gap-4 text-xs">
                  {Object.entries(results.facets.tags).slice(0, 5).map(([tag, count]) => (
                    <span key={tag} className="text-gray-500">
                      {tag} ({count})
                    </span>
                  ))}
                </div>
              )}
            </div>
            
            <div className="space-y-4">
              {results.nodes.map(({ node, relevance, highlights }) => (
                <div
                  key={node.id}
                  className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => navigate(`/mnemosyne/nodes/${node.id}`)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-gray-500" />
                      <h3 className="font-medium text-gray-900 dark:text-gray-100">
                        {node.title}
                      </h3>
                    </div>
                    <span className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                      {Math.round(relevance * 100)}% match
                    </span>
                  </div>
                  
                  {highlights.length > 0 && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                      ...{highlights[0]}...
                    </p>
                  )}
                  
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(node.metadata.updatedAt).toLocaleDateString()}
                    </span>
                    {node.metadata.tags?.map((tag: string) => (
                      <span key={tag} className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchInterface;