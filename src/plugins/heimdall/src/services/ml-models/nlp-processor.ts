/**
 * NLP Processor
 * Processes natural language queries and converts them to structured queries
 */

import { 
  HeimdallQuery,
  StructuredQuery,
  LogLevel,
  FilterOperator,
  AggregationType
} from '../../interfaces';

interface ParsedIntent {
  action: 'search' | 'aggregate' | 'alert' | 'compare';
  entities: Map<string, string[]>;
  timeRange?: { from: Date; to: Date };
  confidence: number;
}

interface TokenPattern {
  pattern: RegExp;
  type: string;
  extractor?: (match: RegExpMatchArray) => any;
}

export class NLPProcessor {
  private readonly tokenPatterns: TokenPattern[] = [
    // Time patterns
    {
      pattern: /last\s+(\d+)\s+(minute|hour|day|week|month)s?/i,
      type: 'relative_time',
      extractor: (match) => {
        const value = parseInt(match[1]);
        const unit = match[2].toLowerCase();
        return { value, unit };
      }
    },
    {
      pattern: /between\s+(.+?)\s+and\s+(.+?)(?:\s|$)/i,
      type: 'time_range',
      extractor: (match) => ({
        from: this.parseDate(match[1]),
        to: this.parseDate(match[2])
      })
    },
    {
      pattern: /(today|yesterday|this week|last week)/i,
      type: 'named_time'
    },
    
    // Level patterns
    {
      pattern: /\b(error|warn|warning|info|debug|fatal|critical)\b/gi,
      type: 'log_level'
    },
    
    // Service patterns
    {
      pattern: /(?:from|in|service)\s+["']?(\w+)["']?/i,
      type: 'service',
      extractor: (match) => match[1]
    },
    
    // Action patterns
    {
      pattern: /\b(show|find|search|get|list|count|aggregate|group by)\b/i,
      type: 'action'
    },
    
    // Aggregation patterns
    {
      pattern: /\b(average|avg|sum|count|min|max|percentile)\b/i,
      type: 'aggregation'
    },
    
    // Comparison patterns
    {
      pattern: /\b(greater than|more than|less than|equal to|contains)\b/i,
      type: 'comparison'
    },
    
    // Entity patterns
    {
      pattern: /user\s+["']?(\w+)["']?/i,
      type: 'user',
      extractor: (match) => match[1]
    },
    {
      pattern: /trace\s+id\s+["']?([\w-]+)["']?/i,
      type: 'trace_id',
      extractor: (match) => match[1]
    }
  ];

  /**
   * Process natural language query and convert to structured query
   */
  async processQuery(naturalLanguage: string): Promise<HeimdallQuery> {
    const intent = this.parseIntent(naturalLanguage);
    const structuredQuery = this.buildStructuredQuery(naturalLanguage, intent);
    
    const query: HeimdallQuery = {
      timeRange: intent.timeRange || this.getDefaultTimeRange(),
      naturalLanguage,
      structured: structuredQuery,
      mlFeatures: {
        similaritySearch: {
          referenceText: naturalLanguage,
          threshold: 0.7
        }
      }
    };
    
    return query;
  }

  /**
   * Extract key phrases from log messages
   */
  extractKeyPhrases(message: string): string[] {
    const phrases: string[] = [];
    
    // Extract quoted strings
    const quotedMatches = message.match(/"([^"]+)"|'([^']+)'/g);
    if (quotedMatches) {
      phrases.push(...quotedMatches.map(m => m.slice(1, -1)));
    }
    
    // Extract error messages
    const errorMatch = message.match(/error[:\s]+(.+?)(?:\.|$)/i);
    if (errorMatch) {
      phrases.push(errorMatch[1].trim());
    }
    
    // Extract technical terms
    const technicalTerms = message.match(/\b(?:exception|timeout|connection|database|api|service|request|response)\b/gi);
    if (technicalTerms) {
      phrases.push(...technicalTerms);
    }
    
    return [...new Set(phrases)]; // Remove duplicates
  }

  /**
   * Generate query suggestions based on partial input
   */
  generateSuggestions(partialQuery: string): string[] {
    const suggestions: string[] = [];
    
    const lastWord = partialQuery.split(' ').pop()?.toLowerCase() || '';
    
    // Time suggestions
    if (lastWord === 'last') {
      suggestions.push('last hour', 'last 24 hours', 'last week');
    }
    
    // Level suggestions
    if (lastWord === 'error' || lastWord === 'errors') {
      suggestions.push('errors in the last hour', 'errors from auth service');
    }
    
    // Service suggestions
    if (lastWord === 'from' || lastWord === 'service') {
      suggestions.push('from auth service', 'from api service', 'from all services');
    }
    
    // Action suggestions
    if (partialQuery.length < 5) {
      suggestions.push(
        'Show me all errors',
        'Count logs by service',
        'Find slow requests',
        'List recent warnings'
      );
    }
    
    return suggestions;
  }

  /**
   * Private helper methods
   */
  
  private parseIntent(query: string): ParsedIntent {
    const entities = new Map<string, string[]>();
    let action: ParsedIntent['action'] = 'search';
    let timeRange: { from: Date; to: Date } | undefined;
    
    // Extract tokens
    for (const tokenPattern of this.tokenPatterns) {
      const matches = Array.from(query.matchAll(new RegExp(tokenPattern.pattern, 'gi')));
      
      for (const match of matches) {
        const value = tokenPattern.extractor ? tokenPattern.extractor(match) : match[0];
        
        switch (tokenPattern.type) {
          case 'relative_time':
            timeRange = this.parseRelativeTime(value);
            break;
          
          case 'time_range':
            timeRange = value;
            break;
          
          case 'named_time':
            timeRange = this.parseNamedTime(match[0]);
            break;
          
          case 'log_level':
            const levels = entities.get('levels') || [];
            levels.push(this.normalizeLogLevel(match[0]));
            entities.set('levels', levels);
            break;
          
          case 'service':
            const services = entities.get('services') || [];
            services.push(value);
            entities.set('services', services);
            break;
          
          case 'action':
            action = this.parseAction(match[0]);
            break;
          
          case 'user':
            entities.set('userId', [value]);
            break;
          
          case 'trace_id':
            entities.set('traceId', [value]);
            break;
        }
      }
    }
    
    // Calculate confidence based on matched tokens
    const confidence = Math.min(entities.size * 0.2 + 0.3, 0.9);
    
    return { action, entities, timeRange, confidence };
  }

  private buildStructuredQuery(
    naturalLanguage: string,
    intent: ParsedIntent
  ): StructuredQuery {
    const query: StructuredQuery = {
      filters: []
    };
    
    // Add level filters
    const levels = intent.entities.get('levels');
    if (levels && levels.length > 0) {
      query.levels = levels as LogLevel[];
    }
    
    // Add service filters
    const services = intent.entities.get('services');
    if (services && services.length > 0) {
      query.sources = services;
    }
    
    // Add user filter
    const userId = intent.entities.get('userId');
    if (userId && userId.length > 0) {
      query.filters!.push({
        field: 'entities.userId',
        operator: FilterOperator.EQ,
        value: userId[0]
      });
    }
    
    // Add trace filter
    const traceId = intent.entities.get('traceId');
    if (traceId && traceId.length > 0) {
      query.filters!.push({
        field: 'trace.traceId',
        operator: FilterOperator.EQ,
        value: traceId[0]
      });
    }
    
    // Add text search
    const searchTerms = this.extractSearchTerms(naturalLanguage, intent);
    if (searchTerms) {
      query.search = searchTerms;
    }
    
    // Add aggregations based on action
    if (intent.action === 'aggregate' || naturalLanguage.includes('count')) {
      query.aggregations = [
        {
          type: AggregationType.COUNT,
          field: '_id',
          name: 'total_count'
        }
      ];
      
      if (naturalLanguage.includes('by service')) {
        query.aggregations.push({
          type: AggregationType.TERMS,
          field: 'source.service',
          name: 'count_by_service',
          options: { size: 10 }
        });
      }
      
      if (naturalLanguage.includes('over time')) {
        query.aggregations.push({
          type: AggregationType.DATE_HISTOGRAM,
          field: 'timestamp',
          name: 'logs_over_time',
          options: { interval: '5m' }
        });
      }
    }
    
    // Add sorting
    query.sort = [{ field: 'timestamp', order: 'desc' }];
    
    // Add limit
    query.limit = 100;
    
    return query;
  }

  private parseRelativeTime(value: { value: number; unit: string }): { from: Date; to: Date } {
    const now = new Date();
    const from = new Date(now);
    
    switch (value.unit) {
      case 'minute':
        from.setMinutes(from.getMinutes() - value.value);
        break;
      case 'hour':
        from.setHours(from.getHours() - value.value);
        break;
      case 'day':
        from.setDate(from.getDate() - value.value);
        break;
      case 'week':
        from.setDate(from.getDate() - value.value * 7);
        break;
      case 'month':
        from.setMonth(from.getMonth() - value.value);
        break;
    }
    
    return { from, to: now };
  }

  private parseNamedTime(name: string): { from: Date; to: Date } {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (name.toLowerCase()) {
      case 'today':
        return { from: today, to: now };
      
      case 'yesterday':
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        return { from: yesterday, to: today };
      
      case 'this week':
        const weekStart = new Date(today);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        return { from: weekStart, to: now };
      
      case 'last week':
        const lastWeekEnd = new Date(today);
        lastWeekEnd.setDate(lastWeekEnd.getDate() - lastWeekEnd.getDay());
        const lastWeekStart = new Date(lastWeekEnd);
        lastWeekStart.setDate(lastWeekStart.getDate() - 7);
        return { from: lastWeekStart, to: lastWeekEnd };
      
      default:
        return this.getDefaultTimeRange();
    }
  }

  private parseDate(dateStr: string): Date {
    // Try to parse various date formats
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date;
    }
    
    // Default to current time
    return new Date();
  }

  private normalizeLogLevel(level: string): LogLevel {
    const normalized = level.toUpperCase();
    
    switch (normalized) {
      case 'WARN':
      case 'WARNING':
        return LogLevel.WARN;
      case 'CRITICAL':
        return LogLevel.FATAL;
      default:
        return normalized as LogLevel;
    }
  }

  private parseAction(action: string): ParsedIntent['action'] {
    const normalized = action.toLowerCase();
    
    if (['count', 'aggregate', 'group by'].includes(normalized)) {
      return 'aggregate';
    }
    
    if (['alert', 'notify'].includes(normalized)) {
      return 'alert';
    }
    
    if (['compare', 'diff'].includes(normalized)) {
      return 'compare';
    }
    
    return 'search';
  }

  private extractSearchTerms(query: string, intent: ParsedIntent): string | undefined {
    // Remove already parsed entities from the query
    let searchTerms = query;
    
    // Remove time expressions
    searchTerms = searchTerms.replace(/last\s+\d+\s+\w+s?/gi, '');
    searchTerms = searchTerms.replace(/between\s+.+?\s+and\s+.+?(?:\s|$)/gi, '');
    searchTerms = searchTerms.replace(/(today|yesterday|this week|last week)/gi, '');
    
    // Remove level mentions
    searchTerms = searchTerms.replace(/\b(error|warn|warning|info|debug|fatal|critical)s?\b/gi, '');
    
    // Remove service mentions
    searchTerms = searchTerms.replace(/(?:from|in|service)\s+["']?\w+["']?/gi, '');
    
    // Remove action words
    searchTerms = searchTerms.replace(/\b(show|find|search|get|list|count|aggregate|group by)\s+me\s+/gi, '');
    searchTerms = searchTerms.replace(/\b(show|find|search|get|list|count|aggregate|group by)\b/gi, '');
    
    // Clean up
    searchTerms = searchTerms.trim();
    
    return searchTerms.length > 2 ? searchTerms : undefined;
  }

  private getDefaultTimeRange(): { from: Date; to: Date } {
    const now = new Date();
    const from = new Date(now);
    from.setHours(from.getHours() - 1); // Default to last hour
    
    return { from, to: now };
  }
}