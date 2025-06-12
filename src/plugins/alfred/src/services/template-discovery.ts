/**
 * Template Discovery Service
 *
 * Advanced template search and recommendation system with
 * fuzzy matching, AI-powered suggestions, and usage analytics
 */

import { Logger } from '../../../../utils/logger';
import { EventBus } from '../../../../core/event-bus/interfaces';
import { AIService } from '../../../../core/services/ai-service/interfaces';
import { StorageService } from '../../../../core/services/storage/interfaces';
import { TemplateManifest } from './template-engine/interfaces';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface SearchOptions {
  query?: string;
  category?: string;
  tags?: string[];
  projectType?: string;
  language?: string;
  framework?: string;
  includeExperimental?: boolean;
  sortBy?: 'relevance' | 'name' | 'rating' | 'downloads' | 'recent';
  limit?: number;
}

export interface TemplateSearchResult {
  template: TemplateManifest;
  score: number; // 0-1 relevance score
  matchedFields: string[];
  aiRecommendation?: {
    reasoning: string;
    confidence: number;
  };
}

export interface TemplateRecommendation {
  template: TemplateManifest;
  reason: string;
  confidence: number;
  category: 'trending' | 'similar' | 'ai-suggested' | 'user-history';
}

export interface TemplateUsageStats {
  templateId: string;
  downloads: number;
  rating: number;
  lastUsed: Date;
  usageCount: number;
  userFeedback: Array<{
    rating: number;
    comment?: string;
    timestamp: Date;
  }>;
}

export interface ProjectAnalysis {
  projectType: string;
  language: string;
  framework?: string;
  dependencies: string[];
  structure: {
    hasTests: boolean;
    hasTypeScript: boolean;
    hasDocs: boolean;
  };
  suggestedCategories: string[];
}

export class TemplateDiscoveryService {
  private logger: Logger;
  private eventBus: EventBus;
  private aiService?: AIService;
  private storageService?: StorageService;
  private templates: Map<string, TemplateManifest> = new Map();
  private usageStats: Map<string, TemplateUsageStats> = new Map();
  private searchIndex: Map<string, Set<string>> = new Map(); // word -> template IDs
  private userHistory: Array<{ templateId: string; timestamp: Date }> = [];

  // Search weights for relevance scoring
  private searchWeights = {
    name: 3.0,
    description: 2.0,
    tags: 2.5,
    category: 2.0,
    author: 1.0,
    requirements: 1.5
  };

  // Fuzzy matching configuration
  private fuzzyConfig = {
    threshold: 0.6, // Minimum similarity score
    maxDistance: 3, // Maximum Levenshtein distance
    enablePhonetic: true // Enable phonetic matching
  };

  constructor(
    logger: Logger,
    eventBus: EventBus,
    aiService?: AIService,
    storageService?: StorageService
  ) {
    this.logger = logger;
    this.eventBus = eventBus;
    this.aiService = aiService;
    this.storageService = storageService;

    this.setupEventListeners();
  }

  /**
   * Load templates from directory
   */
  async loadTemplates(templatesPath: string): Promise<void> {
    try {
      const templateDirs = await fs.readdir(templatesPath, { withFileTypes: true });

      for (const dir of templateDirs) {
        if (dir.isDirectory()) {
          await this.loadTemplate(path.join(templatesPath, dir.name));
        }
      }

      this.buildSearchIndex();
      this.logger.info('Templates loaded', { count: this.templates.size });
    } catch (error) {
      this.logger.error('Failed to load templates', { error, templatesPath });
      throw error;
    }
  }

  /**
   * Load single template
   */
  private async loadTemplate(templatePath: string): Promise<void> {
    try {
      const manifestPath = path.join(templatePath, 'manifest.json');
      const manifestContent = await fs.readFile(manifestPath, 'utf-8');
      const manifest: TemplateManifest = JSON.parse(manifestContent);

      // Validate manifest
      if (!manifest.id || !manifest.name || !manifest.version) {
        throw new Error('Invalid template manifest');
      }

      this.templates.set(manifest.id, manifest);

      // Initialize usage stats if not exists
      if (!this.usageStats.has(manifest.id)) {
        this.usageStats.set(manifest.id, {
          templateId: manifest.id,
          downloads: 0,
          rating: 0,
          lastUsed: new Date(),
          usageCount: 0,
          userFeedback: []
        });
      }
    } catch (error) {
      this.logger.warn('Failed to load template', { error, templatePath });
    }
  }

  /**
   * Search templates with advanced filtering and ranking
   */
  async searchTemplates(options: SearchOptions = {}): Promise<TemplateSearchResult[]> {
    const {
      query = '',
      category,
      tags = [],
      projectType,
      language,
      framework,
      includeExperimental = false,
      sortBy = 'relevance',
      limit = 50
    } = options;

    let results: TemplateSearchResult[] = [];

    // Get base templates
    let candidates = Array.from(this.templates.values());

    // Apply filters
    candidates = this.applyFilters(candidates, {
      category,
      tags,
      projectType,
      language,
      framework,
      includeExperimental
    });

    // Perform search and scoring
    if (query.trim()) {
      results = this.performTextSearch(candidates, query);
    } else {
      results = candidates.map((template) => ({
        template,
        score: 1.0,
        matchedFields: []
      }));
    }

    // Add AI recommendations if enabled
    if (this.aiService && query.trim()) {
      await this.addAIRecommendations(results, query, options);
    }

    // Sort results
    this.sortResults(results, sortBy);

    // Apply limit
    results = results.slice(0, limit);

    this.logger.debug('Template search completed', {
      query,
      candidateCount: candidates.length,
      resultCount: results.length,
      sortBy
    });

    return results;
  }

  /**
   * Get AI-powered template recommendations
   */
  async getRecommendations(
    projectPath?: string,
    userPreferences?: any
  ): Promise<TemplateRecommendation[]> {
    const recommendations: TemplateRecommendation[] = [];

    try {
      // Analyze project if path provided
      let projectAnalysis: ProjectAnalysis | undefined;
      if (projectPath) {
        projectAnalysis = await this.analyzeProject(projectPath);
      }

      // Get trending templates
      const trending = this.getTrendingTemplates();
      recommendations.push(
        ...trending.map((template) => ({
          template,
          reason: 'Currently trending in the community',
          confidence: 0.7,
          category: 'trending' as const
        }))
      );

      // Get AI suggestions if available
      if (this.aiService && projectAnalysis) {
        const aiSuggestions = await this.getAISuggestions(projectAnalysis);
        recommendations.push(...aiSuggestions);
      }

      // Get user history-based recommendations
      const historyBased = this.getHistoryBasedRecommendations();
      recommendations.push(...historyBased);

      // Sort by confidence and limit
      recommendations.sort((a, b) => b.confidence - a.confidence);
      return recommendations.slice(0, 10);
    } catch (error) {
      this.logger.error('Failed to generate recommendations', { error });
      return [];
    }
  }

  /**
   * Analyze project to determine suitable templates
   */
  async analyzeProject(projectPath: string): Promise<ProjectAnalysis> {
    try {
      const files = await fs.readdir(projectPath);

      // Detect project type and language
      let projectType = 'unknown';
      let language = 'unknown';
      let framework: string | undefined;
      const dependencies: string[] = [];

      const structure = {
        hasTests: false,
        hasTypeScript: false,
        hasDocs: false
      };

      // Check for common files
      if (files.includes('package.json')) {
        projectType = 'node';
        language = 'javascript';

        // Analyze package.json
        try {
          const packageContent = await fs.readFile(path.join(projectPath, 'package.json'), 'utf-8');
          const packageJson = JSON.parse(packageContent);

          dependencies.push(...Object.keys(packageJson.dependencies || {}));
          dependencies.push(...Object.keys(packageJson.devDependencies || {}));

          // Detect framework
          if (dependencies.includes('react')) framework = 'react';
          else if (dependencies.includes('vue')) framework = 'vue';
          else if (dependencies.includes('@angular/core')) framework = 'angular';
          else if (dependencies.includes('express')) framework = 'express';

          // Check for TypeScript
          if (dependencies.includes('typescript') || files.some((f) => f.endsWith('.ts'))) {
            structure.hasTypeScript = true;
            language = 'typescript';
          }
        } catch (error) {
          this.logger.debug('Failed to parse package.json', { error });
        }
      } else if (files.includes('requirements.txt') || files.includes('setup.py')) {
        projectType = 'python';
        language = 'python';
      } else if (files.includes('Cargo.toml')) {
        projectType = 'rust';
        language = 'rust';
      } else if (files.includes('go.mod')) {
        projectType = 'go';
        language = 'go';
      }

      // Check for tests
      structure.hasTests = files.some(
        (f) => f.includes('test') || f.includes('spec') || f === '__tests__'
      );

      // Check for docs
      structure.hasDocs = files.some((f) => f.toLowerCase().includes('readme') || f === 'docs');

      // Suggest categories based on analysis
      const suggestedCategories: string[] = [];
      if (framework) suggestedCategories.push(framework);
      if (language !== 'unknown') suggestedCategories.push(language);
      if (structure.hasTests) suggestedCategories.push('testing');
      if (projectType !== 'unknown') suggestedCategories.push(projectType);

      return {
        projectType,
        language,
        framework,
        dependencies,
        structure,
        suggestedCategories
      };
    } catch (error) {
      this.logger.error('Project analysis failed', { error, projectPath });
      throw error;
    }
  }

  /**
   * Get autocomplete suggestions for search
   */
  getAutocompleteSuggestions(query: string, limit = 10): string[] {
    if (!query.trim()) return [];

    const suggestions = new Set<string>();
    const queryLower = query.toLowerCase();

    // Search template names
    for (const template of this.templates.values()) {
      if (template.name.toLowerCase().includes(queryLower)) {
        suggestions.add(template.name);
      }

      // Search tags
      template.tags?.forEach((tag) => {
        if (tag.toLowerCase().includes(queryLower)) {
          suggestions.add(tag);
        }
      });

      // Search categories
      if (template.category.toLowerCase().includes(queryLower)) {
        suggestions.add(template.category);
      }
    }

    return Array.from(suggestions).slice(0, limit);
  }

  /**
   * Record template usage
   */
  recordUsage(templateId: string, feedback?: { rating: number; comment?: string }): void {
    const stats = this.usageStats.get(templateId);
    if (!stats) return;

    stats.usageCount++;
    stats.lastUsed = new Date();
    stats.downloads++;

    if (feedback) {
      stats.userFeedback.push({
        ...feedback,
        timestamp: new Date()
      });

      // Recalculate average rating
      const totalRating = stats.userFeedback.reduce((sum, f) => sum + f.rating, 0);
      stats.rating = totalRating / stats.userFeedback.length;
    }

    // Add to user history
    this.userHistory.unshift({
      templateId,
      timestamp: new Date()
    });

    // Keep only last 50 entries
    this.userHistory = this.userHistory.slice(0, 50);

    this.eventBus.publish('alfred:template:usage:recorded', { templateId, stats });
  }

  /**
   * Apply filters to template candidates
   */
  private applyFilters(
    templates: TemplateManifest[],
    filters: Omit<SearchOptions, 'query' | 'sortBy' | 'limit'>
  ): TemplateManifest[] {
    return templates.filter((template) => {
      // Category filter
      if (filters.category && template.category !== filters.category) {
        return false;
      }

      // Tags filter
      if (filters.tags && filters.tags.length > 0) {
        const hasAllTags = filters.tags.every((tag) => template.tags?.includes(tag));
        if (!hasAllTags) return false;
      }

      // Project type filter
      if (filters.projectType) {
        const supportedTypes = template.requirements?.projectTypes || [];
        if (!supportedTypes.includes(filters.projectType)) {
          return false;
        }
      }

      // Language filter
      if (filters.language) {
        const supportedTypes = template.requirements?.projectTypes || [];
        if (!supportedTypes.includes(filters.language)) {
          return false;
        }
      }

      // Framework filter (check in project types and dependencies)
      if (filters.framework) {
        const projectTypes = template.requirements?.projectTypes || [];
        const dependencies = template.requirements?.dependencies || [];

        const hasFramework =
          projectTypes.includes(filters.framework) ||
          dependencies.some((dep) => dep.includes(filters.framework));

        if (!hasFramework) return false;
      }

      // Experimental filter
      if (!filters.includeExperimental) {
        // Check if template is marked as experimental
        if (template.tags?.includes('experimental')) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Perform text search with fuzzy matching
   */
  private performTextSearch(templates: TemplateManifest[], query: string): TemplateSearchResult[] {
    const results: TemplateSearchResult[] = [];
    const queryWords = this.tokenizeQuery(query);

    for (const template of templates) {
      const score = this.calculateRelevanceScore(template, queryWords);

      if (score > 0) {
        const matchedFields = this.getMatchedFields(template, queryWords);

        results.push({
          template,
          score,
          matchedFields
        });
      }
    }

    return results;
  }

  /**
   * Calculate relevance score for template
   */
  private calculateRelevanceScore(template: TemplateManifest, queryWords: string[]): number {
    let totalScore = 0;

    // Name matching
    const nameScore = this.calculateFieldScore(template.name, queryWords);
    totalScore += nameScore * this.searchWeights.name;

    // Description matching
    const descScore = this.calculateFieldScore(template.description, queryWords);
    totalScore += descScore * this.searchWeights.description;

    // Tags matching
    const tagsText = template.tags?.join(' ') || '';
    const tagsScore = this.calculateFieldScore(tagsText, queryWords);
    totalScore += tagsScore * this.searchWeights.tags;

    // Category matching
    const categoryScore = this.calculateFieldScore(template.category, queryWords);
    totalScore += categoryScore * this.searchWeights.category;

    // Author matching
    const authorScore = this.calculateFieldScore(template.author, queryWords);
    totalScore += authorScore * this.searchWeights.author;

    // Requirements matching
    const reqText = template.requirements?.projectTypes?.join(' ') || '';
    const reqScore = this.calculateFieldScore(reqText, queryWords);
    totalScore += reqScore * this.searchWeights.requirements;

    // Normalize score
    const maxPossibleScore = Object.values(this.searchWeights).reduce((a, b) => a + b, 0);
    return Math.min(totalScore / maxPossibleScore, 1.0);
  }

  /**
   * Calculate score for specific field
   */
  private calculateFieldScore(fieldText: string, queryWords: string[]): number {
    if (!fieldText) return 0;

    const fieldWords = this.tokenizeText(fieldText.toLowerCase());
    let matchCount = 0;
    let exactMatches = 0;

    for (const queryWord of queryWords) {
      let bestMatch = 0;

      for (const fieldWord of fieldWords) {
        if (fieldWord === queryWord) {
          exactMatches++;
          bestMatch = 1.0;
          break;
        } else if (fieldWord.includes(queryWord) || queryWord.includes(fieldWord)) {
          bestMatch = Math.max(bestMatch, 0.8);
        } else {
          const similarity = this.calculateSimilarity(queryWord, fieldWord);
          if (similarity >= this.fuzzyConfig.threshold) {
            bestMatch = Math.max(bestMatch, similarity * 0.6);
          }
        }
      }

      if (bestMatch > 0) {
        matchCount += bestMatch;
      }
    }

    // Boost exact matches
    const exactBoost = exactMatches * 0.5;
    return Math.min((matchCount + exactBoost) / queryWords.length, 1.0);
  }

  /**
   * Calculate string similarity (Jaro-Winkler)
   */
  private calculateSimilarity(str1: string, str2: string): number {
    if (str1 === str2) return 1.0;
    if (str1.length === 0 || str2.length === 0) return 0.0;

    // Simple Levenshtein-based similarity
    const maxLen = Math.max(str1.length, str2.length);
    const distance = this.levenshteinDistance(str1, str2);

    return Math.max(0, (maxLen - distance) / maxLen);
  }

  /**
   * Calculate Levenshtein distance
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Tokenize search query
   */
  private tokenizeQuery(query: string): string[] {
    return this.tokenizeText(query.toLowerCase());
  }

  /**
   * Tokenize text into words
   */
  private tokenizeText(text: string): string[] {
    return text
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 0);
  }

  /**
   * Get matched fields for result
   */
  private getMatchedFields(template: TemplateManifest, queryWords: string[]): string[] {
    const fields: string[] = [];

    if (this.calculateFieldScore(template.name, queryWords) > 0) {
      fields.push('name');
    }
    if (this.calculateFieldScore(template.description, queryWords) > 0) {
      fields.push('description');
    }
    if (this.calculateFieldScore(template.tags?.join(' ') || '', queryWords) > 0) {
      fields.push('tags');
    }
    if (this.calculateFieldScore(template.category, queryWords) > 0) {
      fields.push('category');
    }

    return fields;
  }

  /**
   * Sort search results
   */
  private sortResults(results: TemplateSearchResult[], sortBy: string): void {
    switch (sortBy) {
      case 'name':
        results.sort((a, b) => a.template.name.localeCompare(b.template.name));
        break;
      case 'rating':
        results.sort((a, b) => {
          const ratingA = this.usageStats.get(a.template.id)?.rating || 0;
          const ratingB = this.usageStats.get(b.template.id)?.rating || 0;
          return ratingB - ratingA;
        });
        break;
      case 'downloads':
        results.sort((a, b) => {
          const downloadsA = this.usageStats.get(a.template.id)?.downloads || 0;
          const downloadsB = this.usageStats.get(b.template.id)?.downloads || 0;
          return downloadsB - downloadsA;
        });
        break;
      case 'recent':
        results.sort((a, b) => {
          const lastUsedA = this.usageStats.get(a.template.id)?.lastUsed || new Date(0);
          const lastUsedB = this.usageStats.get(b.template.id)?.lastUsed || new Date(0);
          return lastUsedB.getTime() - lastUsedA.getTime();
        });
        break;
      default: // relevance
        results.sort((a, b) => b.score - a.score);
    }
  }

  /**
   * Build search index for faster lookups
   */
  private buildSearchIndex(): void {
    this.searchIndex.clear();

    for (const template of this.templates.values()) {
      const words = new Set<string>();

      // Index name
      this.tokenizeText(template.name.toLowerCase()).forEach((word) => words.add(word));

      // Index description
      this.tokenizeText(template.description.toLowerCase()).forEach((word) => words.add(word));

      // Index tags
      template.tags?.forEach((tag) => {
        this.tokenizeText(tag.toLowerCase()).forEach((word) => words.add(word));
      });

      // Index category
      this.tokenizeText(template.category.toLowerCase()).forEach((word) => words.add(word));

      // Add to search index
      for (const word of words) {
        if (!this.searchIndex.has(word)) {
          this.searchIndex.set(word, new Set());
        }
        this.searchIndex.get(word)!.add(template.id);
      }
    }
  }

  /**
   * Add AI recommendations to search results
   */
  private async addAIRecommendations(
    results: TemplateSearchResult[],
    query: string,
    options: SearchOptions
  ): Promise<void> {
    if (!this.aiService) return;

    try {
      const prompt = this.buildAIRecommendationPrompt(query, options);
      const response = await this.aiService.query(prompt, {
        model: 'default',
        maxTokens: 200,
        temperature: 0.3
      });

      // Parse AI response and enhance results
      // This would be more sophisticated in practice
      for (const result of results.slice(0, 5)) {
        if (response.includes(result.template.name.toLowerCase())) {
          result.aiRecommendation = {
            reasoning: 'AI identified this template as highly relevant',
            confidence: 0.8
          };
        }
      }
    } catch (error) {
      this.logger.debug('Failed to add AI recommendations', { error });
    }
  }

  /**
   * Build AI recommendation prompt
   */
  private buildAIRecommendationPrompt(query: string, options: SearchOptions): string {
    const parts = [
      'You are helping select the most relevant code templates.',
      '',
      `User query: "${query}"`,
      `Project type: ${options.projectType || 'unknown'}`,
      `Language: ${options.language || 'unknown'}`,
      `Framework: ${options.framework || 'none'}`,
      '',
      "Consider the user's intent and recommend templates that would be most helpful.",
      'Focus on practical utility and common development needs.'
    ];

    return parts.join('\n');
  }

  /**
   * Get trending templates
   */
  private getTrendingTemplates(): TemplateManifest[] {
    const recentlyUsed = Array.from(this.usageStats.entries())
      .filter(([_, stats]) => {
        const daysSinceUsed = (Date.now() - stats.lastUsed.getTime()) / (1000 * 60 * 60 * 24);
        return daysSinceUsed <= 7; // Used in last week
      })
      .sort((a, b) => b[1].usageCount - a[1].usageCount)
      .slice(0, 5)
      .map(([templateId]) => this.templates.get(templateId)!)
      .filter(Boolean);

    return recentlyUsed;
  }

  /**
   * Get AI suggestions based on project analysis
   */
  private async getAISuggestions(analysis: ProjectAnalysis): Promise<TemplateRecommendation[]> {
    if (!this.aiService) return [];

    try {
      const prompt = `Based on this project analysis:
Project Type: ${analysis.projectType}
Language: ${analysis.language}
Framework: ${analysis.framework || 'none'}
Has TypeScript: ${analysis.structure.hasTypeScript}
Has Tests: ${analysis.structure.hasTests}

Recommend the most suitable code templates for this project.`;

      const response = await this.aiService.query(prompt, {
        model: 'default',
        maxTokens: 300,
        temperature: 0.3
      });

      // This would parse the AI response and match to actual templates
      // For now, return framework-specific suggestions
      const suggestions: TemplateRecommendation[] = [];

      if (analysis.framework) {
        const frameworkTemplates = Array.from(this.templates.values())
          .filter(
            (t) =>
              t.category === analysis.framework ||
              t.tags?.includes(analysis.framework) ||
              t.requirements?.projectTypes?.includes(analysis.framework)
          )
          .slice(0, 3);

        suggestions.push(
          ...frameworkTemplates.map((template) => ({
            template,
            reason: `Perfect for ${analysis.framework} projects`,
            confidence: 0.9,
            category: 'ai-suggested' as const
          }))
        );
      }

      return suggestions;
    } catch (error) {
      this.logger.debug('Failed to get AI suggestions', { error });
      return [];
    }
  }

  /**
   * Get recommendations based on user history
   */
  private getHistoryBasedRecommendations(): TemplateRecommendation[] {
    const recommendations: TemplateRecommendation[] = [];

    // Get templates similar to recently used ones
    const recentTemplateIds = this.userHistory.slice(0, 5).map((entry) => entry.templateId);

    for (const templateId of recentTemplateIds) {
      const template = this.templates.get(templateId);
      if (!template) continue;

      // Find similar templates
      const similar = Array.from(this.templates.values())
        .filter(
          (t) =>
            t.id !== templateId &&
            (t.category === template.category ||
              t.tags?.some((tag) => template.tags?.includes(tag)))
        )
        .slice(0, 2);

      recommendations.push(
        ...similar.map((similarTemplate) => ({
          template: similarTemplate,
          reason: `Similar to ${template.name} you used recently`,
          confidence: 0.6,
          category: 'similar' as const
        }))
      );
    }

    return recommendations;
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    this.eventBus.subscribe('alfred:template:installed', (event) => {
      const data = event.data;
      this.loadTemplate(data.path);
    });

    this.eventBus.subscribe('alfred:template:uninstalled', (event) => {
      const data = event.data;
      this.templates.delete(data.templateId);
      this.usageStats.delete(data.templateId);
      this.buildSearchIndex();
    });
  }

  /**
   * Get all templates
   */
  getAllTemplates(): TemplateManifest[] {
    return Array.from(this.templates.values());
  }

  /**
   * Get template by ID
   */
  getTemplate(templateId: string): TemplateManifest | undefined {
    return this.templates.get(templateId);
  }

  /**
   * Get usage statistics
   */
  getUsageStats(templateId: string): TemplateUsageStats | undefined {
    return this.usageStats.get(templateId);
  }
}
