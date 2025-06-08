/**
 * Chain-of-Thought Reasoning Templates for Crash Analysis
 * 
 * Implements step-by-step reasoning patterns for complex analysis
 */

export interface ChainOfThoughtTemplate {
  id: string;
  name: string;
  description: string;
  steps: ReasoningStep[];
  outputFormat: string;
}

export interface ReasoningStep {
  id: string;
  description: string;
  prompt: string;
  dependencies?: string[]; // IDs of steps this depends on
  optional?: boolean;
  validation?: string; // Validation prompt
}

export class ChainOfThoughtReasoning {
  private static templates: Map<string, ChainOfThoughtTemplate> = new Map();

  static {
    this.initializeTemplates();
  }

  /**
   * Initialize default chain-of-thought templates
   */
  private static initializeTemplates(): void {
    // Complex crash analysis template
    this.registerTemplate({
      id: 'complex-crash-analysis',
      name: 'Complex Crash Analysis',
      description: 'Multi-step reasoning for complex crash scenarios',
      steps: [
        {
          id: 'error-identification',
          description: 'Identify and categorize all errors',
          prompt: `Step 1: Error Identification
Examine the crash data and identify:
1. Primary error message and type
2. Secondary errors or warnings
3. Error patterns and frequency
4. Error severity classification

List each error with its characteristics.`
        },
        {
          id: 'stack-analysis',
          description: 'Analyze stack traces for call patterns',
          prompt: `Step 2: Stack Trace Analysis
For each stack trace:
1. Identify the failing method/function
2. Trace the call chain leading to failure
3. Find common patterns across multiple traces
4. Identify the deepest application code frame

Summarize the call flow that led to the crash.`,
          dependencies: ['error-identification']
        },
        {
          id: 'timeline-construction',
          description: 'Construct event timeline',
          prompt: `Step 3: Timeline Construction
Build a chronological sequence:
1. When did the first warning appear?
2. What events preceded the crash?
3. How long between first symptom and failure?
4. Were there any recovery attempts?

Create a timeline of significant events.`,
          dependencies: ['error-identification', 'stack-analysis']
        },
        {
          id: 'root-cause-hypothesis',
          description: 'Generate root cause hypotheses',
          prompt: `Step 4: Root Cause Hypothesis
Based on previous analysis:
1. What are the possible root causes?
2. What evidence supports each hypothesis?
3. What evidence contradicts each hypothesis?
4. Rank hypotheses by probability

Provide 3-5 hypotheses with supporting evidence.`,
          dependencies: ['timeline-construction']
        },
        {
          id: 'impact-assessment',
          description: 'Assess impact and scope',
          prompt: `Step 5: Impact Assessment
Evaluate the crash impact:
1. Which components are affected?
2. Is this an isolated or systemic issue?
3. What's the blast radius of the failure?
4. Are there cascading failures?

Describe the scope and severity of impact.`,
          dependencies: ['root-cause-hypothesis']
        },
        {
          id: 'solution-generation',
          description: 'Generate targeted solutions',
          prompt: `Step 6: Solution Generation
For each root cause hypothesis:
1. What's the immediate fix?
2. What's the long-term solution?
3. How can we prevent recurrence?
4. What monitoring should be added?

Provide specific, actionable solutions.`,
          dependencies: ['root-cause-hypothesis', 'impact-assessment']
        }
      ],
      outputFormat: `{
  "analysis": {
    "errors": [...],
    "timeline": [...],
    "hypotheses": [...],
    "impact": {...},
    "solutions": [...]
  }
}`
    });

    // Memory leak investigation template
    this.registerTemplate({
      id: 'memory-leak-investigation',
      name: 'Memory Leak Investigation',
      description: 'Systematic memory leak root cause analysis',
      steps: [
        {
          id: 'memory-state',
          description: 'Analyze memory state at crash',
          prompt: `Step 1: Memory State Analysis
Examine the memory conditions:
1. Heap usage and growth rate
2. GC frequency and duration
3. Memory allocation patterns
4. Large object identification

What does the memory profile reveal?`
        },
        {
          id: 'allocation-tracking',
          description: 'Track allocation sources',
          prompt: `Step 2: Allocation Source Tracking
Identify memory allocation hotspots:
1. Which classes consume most memory?
2. What are the allocation stack traces?
3. Are allocations growing linearly or exponentially?
4. Any unexpected retention?

Map allocation sources to code locations.`,
          dependencies: ['memory-state']
        },
        {
          id: 'retention-analysis',
          description: 'Analyze object retention',
          prompt: `Step 3: Retention Path Analysis
For objects consuming significant memory:
1. What's keeping them alive (GC roots)?
2. Are there unexpected references?
3. Is this intentional caching or a leak?
4. What's the retention timeline?

Identify retention paths and lifecycle issues.`,
          dependencies: ['allocation-tracking']
        },
        {
          id: 'leak-classification',
          description: 'Classify the type of leak',
          prompt: `Step 4: Leak Classification
Determine the leak type:
1. Classic memory leak (strong references)?
2. Resource leak (unclosed handles)?
3. Cache without bounds?
4. Listener/callback leak?
5. Thread leak?

Classify and explain the leak mechanism.`,
          dependencies: ['retention-analysis']
        },
        {
          id: 'fix-strategy',
          description: 'Develop fix strategy',
          prompt: `Step 5: Fix Strategy
Based on leak type:
1. How to break the retention?
2. What cleanup is needed?
3. How to prevent future leaks?
4. What limits/bounds to implement?

Provide concrete fix implementation.`,
          dependencies: ['leak-classification']
        }
      ],
      outputFormat: `{
  "memoryAnalysis": {
    "state": {...},
    "allocations": [...],
    "retention": [...],
    "leakType": "...",
    "fixes": [...]
  }
}`
    });

    // Concurrency debugging template
    this.registerTemplate({
      id: 'concurrency-debugging',
      name: 'Concurrency Issue Debugging',
      description: 'Step-by-step concurrency problem analysis',
      steps: [
        {
          id: 'thread-state',
          description: 'Analyze thread states',
          prompt: `Step 1: Thread State Analysis
Examine all threads:
1. What state is each thread in?
2. Which threads are blocked/waiting?
3. What are they waiting for?
4. Any suspicious thread names or counts?

Create a thread state summary.`
        },
        {
          id: 'lock-analysis',
          description: 'Analyze lock dependencies',
          prompt: `Step 2: Lock Dependency Analysis
Map the locking behavior:
1. What locks does each thread hold?
2. What locks is each thread waiting for?
3. Is there a circular dependency?
4. What's the lock acquisition order?

Build a lock dependency graph.`,
          dependencies: ['thread-state']
        },
        {
          id: 'race-detection',
          description: 'Detect race conditions',
          prompt: `Step 3: Race Condition Detection
Look for race condition indicators:
1. Unsynchronized shared state access?
2. Check-then-act patterns?
3. Missing volatile/synchronization?
4. Non-atomic compound operations?

Identify potential race conditions.`,
          dependencies: ['thread-state']
        },
        {
          id: 'timing-analysis',
          description: 'Analyze timing dependencies',
          prompt: `Step 4: Timing Analysis
Examine temporal aspects:
1. Does issue occur consistently?
2. Load/timing correlation?
3. Initialization order problems?
4. Timeout configurations?

Assess timing-related factors.`,
          dependencies: ['lock-analysis', 'race-detection']
        },
        {
          id: 'synchronization-fix',
          description: 'Design synchronization fix',
          prompt: `Step 5: Synchronization Solution
Design the fix:
1. How to break deadlock cycles?
2. What synchronization to add/remove?
3. Lock-free alternatives?
4. Proper lock ordering?

Provide thread-safe solution.`,
          dependencies: ['timing-analysis']
        }
      ],
      outputFormat: `{
  "concurrencyAnalysis": {
    "threads": [...],
    "locks": {...},
    "races": [...],
    "timing": {...},
    "solution": {...}
  }
}`
    });
  }

  /**
   * Register a new template
   */
  static registerTemplate(template: ChainOfThoughtTemplate): void {
    this.templates.set(template.id, template);
  }

  /**
   * Get template by ID
   */
  static getTemplate(id: string): ChainOfThoughtTemplate | undefined {
    return this.templates.get(id);
  }

  /**
   * Execute chain-of-thought reasoning
   */
  static buildReasoningPrompt(
    templateId: string,
    crashData: any,
    includeSteps?: string[]
  ): string {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    const steps = includeSteps 
      ? template.steps.filter(s => includeSteps.includes(s.id))
      : template.steps;

    const prompt = `You will analyze this crash using chain-of-thought reasoning.

## Crash Data
${JSON.stringify(crashData, null, 2)}

## Analysis Process
Follow these steps carefully, showing your reasoning at each stage:

${steps.map((step, index) => {
  const deps = step.dependencies 
    ? `\n(This step depends on: ${step.dependencies.join(', ')})` 
    : '';
  return `${step.prompt}${deps}`;
}).join('\n\n')}

## Final Output
Synthesize your step-by-step analysis into this format:
${template.outputFormat}

Think through each step systematically before providing the final JSON output.`;

    return prompt;
  }

  /**
   * Create validation prompt for a reasoning step
   */
  static createValidationPrompt(
    templateId: string,
    stepId: string,
    stepOutput: any
  ): string {
    const template = this.templates.get(templateId);
    const step = template?.steps.find(s => s.id === stepId);
    
    if (!step?.validation) {
      return '';
    }

    return `Validate this ${step.description} output:
${JSON.stringify(stepOutput, null, 2)}

${step.validation}

Is the analysis correct and complete? If not, what's missing or incorrect?`;
  }

  /**
   * Get reasoning template for error type
   */
  static getTemplateForError(errorType: string): ChainOfThoughtTemplate | null {
    // Map error types to templates
    const errorTemplateMap: Record<string, string> = {
      'OutOfMemoryError': 'memory-leak-investigation',
      'MemoryLeak': 'memory-leak-investigation',
      'Deadlock': 'concurrency-debugging',
      'RaceCondition': 'concurrency-debugging',
      'ThreadStarvation': 'concurrency-debugging',
      'default': 'complex-crash-analysis'
    };

    const templateId = errorTemplateMap[errorType] || errorTemplateMap['default'];
    return this.templates.get(templateId) || null;
  }

  /**
   * Create a custom reasoning chain
   */
  static createCustomChain(steps: ReasoningStep[]): string {
    return `Analyze this issue using the following reasoning steps:

${steps.map((step, index) => {
  return `### Step ${index + 1}: ${step.description}
${step.prompt}
${step.dependencies ? `(Depends on: ${step.dependencies.join(', ')})` : ''}
`;
}).join('\n')}

Provide your analysis following each step sequentially.`;
  }
}