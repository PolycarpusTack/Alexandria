/**
 * Response Parser
 * Handles parsing and validation of LLM responses
 */

import { Logger } from '@utils/logger';
import {
  CrashAnalysisResult,
  RootCause,
  Evidence,
  CodeAnalysisResult
} from '../../interfaces';
import { ParsedAnalysisResult } from './types';

export class ResponseParser {
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Parse crash analysis response from LLM
   */
  parseCrashAnalysisResponse(
    response: string,
    model: string,
    promptTokens: number,
    responseTokens: number,
    analysisTime: number
  ): CrashAnalysisResult {
    try {
      const parsed = this.parseStructuredResponse(response);
      
      return {
        rootCause: this.extractRootCause(parsed),
        evidence: this.extractEvidence(parsed),
        recommendations: this.extractRecommendations(parsed),
        confidence: this.extractConfidence(parsed),
        metadata: {
          modelUsed: model,
          analysisTime,
          promptTokens,
          responseTokens,
          responseLength: response.length,
          timestamp: new Date()
        }
      };

    } catch (error) {
      this.logger.error('Failed to parse crash analysis response', { error, response: response.substring(0, 500) });
      
      // Return fallback result
      return this.createFallbackAnalysisResult(response, model, analysisTime);
    }
  }

  /**
   * Parse code analysis response from LLM
   */
  parseCodeAnalysisResponse(
    response: string,
    model: string,
    analysisTime: number
  ): CodeAnalysisResult {
    try {
      const parsed = this.parseStructuredResponse(response);
      
      return {
        issues: this.extractCodeIssues(parsed),
        suggestions: this.extractCodeSuggestions(parsed),
        metrics: this.extractCodeMetrics(parsed),
        confidence: this.extractConfidence(parsed),
        metadata: {
          modelUsed: model,
          analysisTime,
          timestamp: new Date()
        }
      };

    } catch (error) {
      this.logger.error('Failed to parse code analysis response', { error });
      
      return {
        issues: [],
        suggestions: [],
        metrics: {},
        confidence: 0.1,
        metadata: {
          modelUsed: model,
          analysisTime,
          timestamp: new Date(),
          parseError: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  /**
   * Parse structured response (JSON or markdown)
   */
  private parseStructuredResponse(response: string): any {
    // Try to parse as JSON first
    const jsonMatch = this.extractJsonFromResponse(response);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch);
      } catch (error) {
        this.logger.debug('Failed to parse extracted JSON', { error });
      }
    }

    // Fallback to markdown parsing
    return this.parseMarkdownResponse(response);
  }

  /**
   * Extract JSON from response text
   */
  private extractJsonFromResponse(response: string): string | null {
    // Look for JSON blocks
    const jsonBlockMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonBlockMatch) {
      return jsonBlockMatch[1].trim();
    }

    // Look for JSON-like structures
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return jsonMatch[0];
    }

    return null;
  }

  /**
   * Parse markdown-formatted response
   */
  private parseMarkdownResponse(response: string): any {
    const result: any = {
      rootCause: {},
      evidence: [],
      recommendations: [],
      confidence: 0.5
    };

    // Extract sections using markdown headers
    const sections = this.extractMarkdownSections(response);
    
    // Parse root cause
    if (sections['root cause'] || sections['cause'] || sections['problem']) {
      const causeText = sections['root cause'] || sections['cause'] || sections['problem'];
      result.rootCause = {
        primary: this.extractFirstSentence(causeText),
        description: causeText,
        confidence: this.extractConfidenceFromText(causeText)
      };
    }

    // Parse evidence
    if (sections['evidence'] || sections['symptoms'] || sections['indicators']) {
      const evidenceText = sections['evidence'] || sections['symptoms'] || sections['indicators'];
      result.evidence = this.parseListItems(evidenceText).map((item, index) => ({
        type: 'observation',
        description: item,
        relevance: 0.8,
        line: null
      }));
    }

    // Parse recommendations
    if (sections['recommendations'] || sections['solutions'] || sections['fixes']) {
      const recommendationsText = sections['recommendations'] || sections['solutions'] || sections['fixes'];
      result.recommendations = this.parseListItems(recommendationsText).map((item, index) => ({
        action: item,
        priority: this.inferPriority(item, index),
        description: item
      }));
    }

    // Extract confidence if mentioned
    const confidenceMatch = response.match(/confidence[:\s]*(\d+(?:\.\d+)?)[%\s]/i);
    if (confidenceMatch) {
      result.confidence = parseFloat(confidenceMatch[1]) / (confidenceMatch[0].includes('%') ? 100 : 1);
    }

    return result;
  }

  /**
   * Extract markdown sections
   */
  private extractMarkdownSections(text: string): Record<string, string> {
    const sections: Record<string, string> = {};
    const lines = text.split('\n');
    let currentSection = '';
    let currentContent: string[] = [];

    for (const line of lines) {
      const headerMatch = line.match(/^#+\s*(.+)$/);
      
      if (headerMatch) {
        // Save previous section
        if (currentSection && currentContent.length > 0) {
          sections[currentSection.toLowerCase()] = currentContent.join('\n').trim();
        }
        
        // Start new section
        currentSection = headerMatch[1];
        currentContent = [];
      } else if (currentSection) {
        currentContent.push(line);
      }
    }

    // Save last section
    if (currentSection && currentContent.length > 0) {
      sections[currentSection.toLowerCase()] = currentContent.join('\n').trim();
    }

    return sections;
  }

  /**
   * Parse list items from text
   */
  private parseListItems(text: string): string[] {
    const items: string[] = [];
    
    // Split by common list markers
    const lines = text.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Match various list formats
      const listMatch = trimmed.match(/^(?:[\*\-\+]|\d+[\.\)]|\w[\.\)])\s*(.+)$/);
      if (listMatch && listMatch[1]) {
        items.push(listMatch[1].trim());
      } else if (trimmed && !trimmed.match(/^#+/)) {
        // Include non-empty lines that aren't headers
        items.push(trimmed);
      }
    }
    
    return items.filter(item => item.length > 0);
  }

  /**
   * Extract root cause from parsed data
   */
  private extractRootCause(parsed: any): RootCause {
    if (parsed.rootCause) {
      return {
        primary: parsed.rootCause.primary || parsed.rootCause.description || 'Unknown cause',
        secondary: parsed.rootCause.secondary || [],
        confidence: parsed.rootCause.confidence || 0.5,
        category: parsed.rootCause.category || 'unknown',
        description: parsed.rootCause.description || parsed.rootCause.primary || 'No description available'
      };
    }

    // Fallback extraction
    return {
      primary: 'Unable to determine root cause',
      secondary: [],
      confidence: 0.1,
      category: 'unknown',
      description: 'Analysis could not identify a clear root cause'
    };
  }

  /**
   * Extract evidence from parsed data
   */
  private extractEvidence(parsed: any): Evidence[] {
    if (parsed.evidence && Array.isArray(parsed.evidence)) {
      return parsed.evidence.map((item: any) => ({
        type: item.type || 'observation',
        description: item.description || String(item),
        relevance: item.relevance || 0.5,
        line: item.line || null,
        severity: item.severity || 'medium'
      }));
    }

    return [];
  }

  /**
   * Extract recommendations from parsed data
   */
  private extractRecommendations(parsed: any): Array<{
    action: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
    description: string;
  }> {
    if (parsed.recommendations && Array.isArray(parsed.recommendations)) {
      return parsed.recommendations.map((item: any) => ({
        action: item.action || item.description || String(item),
        priority: item.priority || 'medium',
        description: item.description || item.action || String(item)
      }));
    }

    return [];
  }

  /**
   * Extract code issues from parsed data
   */
  private extractCodeIssues(parsed: any): any[] {
    if (parsed.issues && Array.isArray(parsed.issues)) {
      return parsed.issues;
    }
    
    if (parsed.problems && Array.isArray(parsed.problems)) {
      return parsed.problems;
    }

    return [];
  }

  /**
   * Extract code suggestions from parsed data
   */
  private extractCodeSuggestions(parsed: any): any[] {
    if (parsed.suggestions && Array.isArray(parsed.suggestions)) {
      return parsed.suggestions;
    }
    
    if (parsed.improvements && Array.isArray(parsed.improvements)) {
      return parsed.improvements;
    }

    return [];
  }

  /**
   * Extract code metrics from parsed data
   */
  private extractCodeMetrics(parsed: any): Record<string, any> {
    return parsed.metrics || parsed.statistics || {};
  }

  /**
   * Extract confidence score from parsed data or text
   */
  private extractConfidence(parsed: any): number {
    if (typeof parsed.confidence === 'number') {
      return Math.max(0, Math.min(1, parsed.confidence));
    }

    return 0.5; // Default confidence
  }

  /**
   * Extract confidence from text content
   */
  private extractConfidenceFromText(text: string): number {
    const confidenceWords = {
      'certain': 0.9,
      'confident': 0.8,
      'likely': 0.7,
      'probable': 0.7,
      'possible': 0.5,
      'uncertain': 0.3,
      'unlikely': 0.2
    };

    for (const [word, score] of Object.entries(confidenceWords)) {
      if (text.toLowerCase().includes(word)) {
        return score;
      }
    }

    return 0.5;
  }

  /**
   * Extract first sentence from text
   */
  private extractFirstSentence(text: string): string {
    const sentences = text.split(/[.!?]+/);
    return sentences[0]?.trim() || text.trim();
  }

  /**
   * Infer priority from recommendation text
   */
  private inferPriority(text: string, index: number): 'low' | 'medium' | 'high' | 'critical' {
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('critical') || lowerText.includes('urgent') || lowerText.includes('immediately')) {
      return 'critical';
    }
    
    if (lowerText.includes('important') || lowerText.includes('should') || index === 0) {
      return 'high';
    }
    
    if (lowerText.includes('consider') || lowerText.includes('might')) {
      return 'low';
    }
    
    return 'medium';
  }

  /**
   * Create fallback analysis result when parsing fails
   */
  private createFallbackAnalysisResult(
    response: string,
    model: string,
    analysisTime: number
  ): CrashAnalysisResult {
    // Extract basic information from raw response
    const lines = response.split('\n').filter(line => line.trim().length > 0);
    const firstLine = lines[0] || 'Unable to analyze crash';
    
    return {
      rootCause: {
        primary: firstLine.substring(0, 200),
        secondary: [],
        confidence: 0.2,
        category: 'unknown',
        description: response.substring(0, 500)
      },
      evidence: [],
      recommendations: [
        {
          action: 'Review the crash log manually',
          priority: 'high',
          description: 'Automated analysis failed. Manual review is recommended.'
        }
      ],
      confidence: 0.1,
      metadata: {
        modelUsed: model,
        analysisTime,
        promptTokens: 0,
        responseTokens: 0,
        responseLength: response.length,
        timestamp: new Date(),
        parseError: 'Failed to parse structured response'
      }
    };
  }

  /**
   * Validate parsed result structure
   */
  validateAnalysisResult(result: CrashAnalysisResult): boolean {
    try {
      return (
        result &&
        typeof result === 'object' &&
        result.rootCause &&
        typeof result.rootCause.primary === 'string' &&
        Array.isArray(result.evidence) &&
        Array.isArray(result.recommendations) &&
        typeof result.confidence === 'number' &&
        result.confidence >= 0 &&
        result.confidence <= 1
      );
    } catch (error) {
      return false;
    }
  }
}