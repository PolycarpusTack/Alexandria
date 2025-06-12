/**
 * Prompt Templates for Different Crash Types
 *
 * Specialized templates optimized for various crash scenarios
 */

import { ParsedCrashData } from '../../interfaces';

export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  crashTypes: string[];
  template: string;
  variables: string[];
  modelRequirements?: {
    minParameters?: number;
    maxParameters?: number;
    recommendedModels?: string[];
  };
  effectiveness?: {
    successRate?: number;
    avgInferenceTime?: number;
    sampleSize?: number;
  };
}

export class PromptTemplates {
  private static templates: Map<string, PromptTemplate> = new Map();

  static {
    // Initialize default templates
    this.registerDefaultTemplates();
  }

  /**
   * Register default prompt templates for common crash types
   */
  private static registerDefaultTemplates(): void {
    // Memory-related crashes
    this.registerTemplate({
      id: 'memory-leak-analysis',
      name: 'Memory Leak Analysis',
      description: 'Specialized template for analyzing memory leaks and OOM errors',
      crashTypes: ['OutOfMemoryError', 'MemoryLeak', 'HeapDump'],
      template: `You are a memory profiling expert. Analyze this memory-related crash:

## Memory State at Crash
{{memoryInfo}}

## Error Pattern
{{errorPattern}}

## Memory Growth Timeline
{{memoryTimeline}}

## Stack Trace
{{stackTrace}}

Your analysis must identify:
1. Memory leak source and type (heap/native/thread)
2. Object retention patterns
3. GC behavior anomalies
4. Memory allocation hotspots

Provide actionable fixes focusing on:
- Object lifecycle management
- Resource cleanup patterns
- Memory optimization strategies

Format your response as:
{
  "leakType": "heap|native|thread",
  "leakSource": {
    "component": "string",
    "class": "string",
    "method": "string"
  },
  "retainedObjects": [{
    "type": "string",
    "count": number,
    "size": "string",
    "retentionPath": ["string"]
  }],
  "rootCause": {
    "description": "string",
    "confidence": number,
    "evidence": ["string"]
  },
  "fixes": [{
    "action": "string",
    "implementation": "string",
    "impact": "high|medium|low"
  }]
}`,
      variables: ['memoryInfo', 'errorPattern', 'memoryTimeline', 'stackTrace'],
      modelRequirements: {
        minParameters: 7000000000, // 7B
        recommendedModels: ['llama2:13b', 'mistral:7b-instruct']
      }
    });

    // Null pointer exceptions
    this.registerTemplate({
      id: 'null-pointer-analysis',
      name: 'Null Pointer Exception Analysis',
      description: 'Template for analyzing NPE and null reference errors',
      crashTypes: ['NullPointerException', 'NullReferenceException', 'SegmentationFault'],
      template: `You are debugging a null pointer exception. Use deductive reasoning:

## Error Context
{{errorMessage}}

## Call Stack Leading to NPE
{{callStack}}

## Variable State Before Crash
{{variableState}}

## Code Context (if available)
{{codeContext}}

Step-by-step analysis:
1. Identify the exact null reference
2. Trace backwards to find where null was introduced
3. Determine why the null check was missing
4. Assess defensive programming gaps

Response format:
{
  "nullVariable": {
    "name": "string",
    "type": "string",
    "location": "file:line"
  },
  "nullSource": {
    "reason": "uninitialized|returned-null|cleared|concurrent-modification",
    "location": "string",
    "explanation": "string"
  },
  "missingChecks": [{
    "location": "string",
    "suggestedCheck": "string"
  }],
  "preventionStrategy": {
    "immediate": ["string"],
    "longTerm": ["string"]
  }
}`,
      variables: ['errorMessage', 'callStack', 'variableState', 'codeContext'],
      modelRequirements: {
        minParameters: 7000000000
      }
    });

    // Concurrency issues
    this.registerTemplate({
      id: 'concurrency-deadlock',
      name: 'Concurrency and Deadlock Analysis',
      description: 'Template for race conditions, deadlocks, and thread issues',
      crashTypes: ['Deadlock', 'RaceCondition', 'ThreadStarvation'],
      template: `Analyze this concurrency issue as a distributed systems expert:

## Thread State at Crash
{{threadDump}}

## Lock Acquisition Order
{{lockOrder}}

## Resource Contention
{{resourceContention}}

## Timing Information
{{timingData}}

Systematic analysis required:
1. Identify circular dependencies in lock acquisition
2. Detect race condition windows
3. Analyze thread scheduling issues
4. Find synchronization gaps

Output format:
{
  "issueType": "deadlock|race|starvation|livelock",
  "involvedThreads": [{
    "id": "string",
    "state": "string",
    "heldLocks": ["string"],
    "waitingFor": "string"
  }],
  "rootCause": {
    "pattern": "circular-wait|order-violation|missing-sync",
    "description": "string",
    "timeline": [{
      "thread": "string",
      "action": "string",
      "timestamp": "string"
    }]
  },
  "solutions": [{
    "approach": "lock-ordering|lock-free|timeout|redesign",
    "implementation": "string",
    "tradeoffs": "string"
  }]
}`,
      variables: ['threadDump', 'lockOrder', 'resourceContention', 'timingData'],
      modelRequirements: {
        minParameters: 13000000000, // 13B for complex concurrency
        recommendedModels: ['llama2:13b', 'codellama:13b']
      }
    });

    // Database/connection errors
    this.registerTemplate({
      id: 'database-connection',
      name: 'Database Connection Issues',
      description: 'Template for connection pool, timeout, and DB errors',
      crashTypes: ['ConnectionTimeout', 'PoolExhausted', 'DatabaseError'],
      template: `Diagnose this database connectivity issue:

## Connection Error Details
{{errorDetails}}

## Connection Pool State
{{poolState}}

## Query Information
{{queryInfo}}

## Network/DB Metrics
{{metrics}}

Analysis checklist:
1. Connection pool configuration vs load
2. Query performance and timeouts
3. Network latency and packet loss
4. Database server health

Required output:
{
  "connectionIssue": {
    "type": "timeout|exhausted|refused|auth|network",
    "component": "pool|driver|network|server"
  },
  "metrics": {
    "poolUtilization": number,
    "avgResponseTime": number,
    "failureRate": number
  },
  "diagnosis": {
    "primaryCause": "string",
    "contributingFactors": ["string"],
    "evidence": ["string"]
  },
  "recommendations": [{
    "area": "pool-config|query-optimization|infrastructure|monitoring",
    "action": "string",
    "expectedImprovement": "string"
  }]
}`,
      variables: ['errorDetails', 'poolState', 'queryInfo', 'metrics']
    });

    // Performance degradation
    this.registerTemplate({
      id: 'performance-degradation',
      name: 'Performance Degradation Analysis',
      description: 'Template for slowdowns, timeouts, and performance issues',
      crashTypes: ['PerformanceTimeout', 'SlowResponse', 'CPUSpike'],
      template: `Analyze this performance degradation as a performance engineer:

## Performance Metrics
{{performanceMetrics}}

## Resource Utilization
{{resourceUsage}}

## Hotspot Analysis
{{hotspots}}

## Historical Comparison
{{historicalData}}

Conduct thorough analysis:
1. Identify performance bottlenecks
2. Analyze resource contention
3. Find algorithmic inefficiencies
4. Detect external dependencies impact

Response structure:
{
  "bottleneck": {
    "type": "cpu|memory|io|network|lock",
    "location": "string",
    "severity": "critical|high|medium"
  },
  "performanceProfile": {
    "baseline": { "metric": "value" },
    "current": { "metric": "value" },
    "degradation": number
  },
  "rootCauses": [{
    "cause": "string",
    "impact": "percent",
    "evidence": ["string"]
  }],
  "optimizations": [{
    "target": "string",
    "technique": "caching|async|batching|algorithm|index",
    "expectedGain": "string",
    "implementation": "string"
  }]
}`,
      variables: ['performanceMetrics', 'resourceUsage', 'hotspots', 'historicalData'],
      modelRequirements: {
        minParameters: 7000000000
      }
    });
  }

  /**
   * Register a new prompt template
   */
  static registerTemplate(template: PromptTemplate): void {
    this.templates.set(template.id, template);
  }

  /**
   * Get template by ID
   */
  static getTemplate(id: string): PromptTemplate | undefined {
    return this.templates.get(id);
  }

  /**
   * Get all templates
   */
  static getAllTemplates(): PromptTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Find best template for crash type
   */
  static findBestTemplate(crashData: ParsedCrashData): PromptTemplate | null {
    // Extract crash type indicators
    const indicators = this.extractCrashIndicators(crashData);

    // Score each template
    let bestTemplate: PromptTemplate | null = null;
    let bestScore = 0;

    for (const template of this.templates.values()) {
      const score = this.scoreTemplate(template, indicators);
      if (score > bestScore) {
        bestScore = score;
        bestTemplate = template;
      }
    }

    return bestTemplate;
  }

  /**
   * Extract crash type indicators from parsed data
   */
  private static extractCrashIndicators(crashData: ParsedCrashData): Set<string> {
    const indicators = new Set<string>();

    // Check error messages
    for (const error of crashData.errorMessages) {
      const msg = error.message.toLowerCase();

      if (msg.includes('outofmemory') || msg.includes('heap')) {
        indicators.add('OutOfMemoryError');
        indicators.add('MemoryLeak');
      }
      if (msg.includes('null pointer') || msg.includes('nullpointer')) {
        indicators.add('NullPointerException');
      }
      if (msg.includes('deadlock') || msg.includes('thread')) {
        indicators.add('Deadlock');
        indicators.add('ThreadStarvation');
      }
      if (msg.includes('timeout') || msg.includes('connection')) {
        indicators.add('ConnectionTimeout');
        indicators.add('DatabaseError');
      }
      if (msg.includes('performance') || msg.includes('slow')) {
        indicators.add('PerformanceTimeout');
        indicators.add('SlowResponse');
      }
    }

    // Check stack traces
    for (const stack of crashData.stackTraces) {
      if (stack.frames.some((f) => f.functionName?.includes('Memory'))) {
        indicators.add('MemoryLeak');
      }
      if (stack.frames.some((f) => f.functionName?.includes('Thread'))) {
        indicators.add('ThreadStarvation');
      }
    }

    return indicators;
  }

  /**
   * Score a template against crash indicators
   */
  private static scoreTemplate(template: PromptTemplate, indicators: Set<string>): number {
    let score = 0;

    for (const crashType of template.crashTypes) {
      if (indicators.has(crashType)) {
        score += 10;
      }
    }

    // Bonus for high effectiveness
    if (template.effectiveness?.successRate && template.effectiveness.successRate > 0.8) {
      score += 5;
    }

    return score;
  }

  /**
   * Fill template variables with crash data
   */
  static fillTemplate(
    template: PromptTemplate,
    crashData: ParsedCrashData,
    additionalData?: Record<string, any>
  ): string {
    let prompt = template.template;
    const data = this.extractTemplateData(crashData, additionalData);

    // Replace all variables
    for (const variable of template.variables) {
      const value = data[variable] || `[${variable} not available]`;
      prompt = prompt.replace(new RegExp(`{{${variable}}}`, 'g'), value);
    }

    return prompt;
  }

  /**
   * Extract template data from crash data
   */
  private static extractTemplateData(
    crashData: ParsedCrashData,
    additionalData?: Record<string, any>
  ): Record<string, string> {
    const data: Record<string, string> = {};

    // Basic error information
    data.errorMessage = crashData.errorMessages.map((e) => e.message).join('\n');
    data.errorPattern = crashData.errorMessages.map((e) => `[${e.level}] ${e.message}`).join('\n');

    // Stack traces
    data.stackTrace = crashData.stackTraces
      .map((st) => {
        const frames = st.frames
          .map(
            (f) =>
              `  at ${f.functionName || 'unknown'} (${f.fileName || 'unknown'}:${f.lineNumber || '?'})`
          )
          .join('\n');
        return `${st.message || 'Stack Trace'}:\n${frames}`;
      })
      .join('\n\n');

    data.callStack = data.stackTrace; // Alias

    // System information
    data.systemInfo = Object.entries(crashData.systemInfo)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');

    // Memory information (if available)
    const memoryData = crashData.additionalContext?.memory || {};
    data.memoryInfo = JSON.stringify(memoryData, null, 2);

    // Performance metrics (if available)
    const perfData = crashData.additionalContext?.performance || {};
    data.performanceMetrics = JSON.stringify(perfData, null, 2);

    // Thread information (if available)
    const threadData = crashData.additionalContext?.threads || {};
    data.threadDump = JSON.stringify(threadData, null, 2);

    // Merge additional data
    if (additionalData) {
      Object.assign(data, additionalData);
    }

    return data;
  }
}
