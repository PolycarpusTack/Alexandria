/**
 * Few-Shot Learning Examples for Crash Analysis
 * 
 * Provides curated examples to improve LLM analysis accuracy
 */

export interface FewShotExample {
  id: string;
  crashType: string;
  input: {
    errorMessage: string;
    stackTrace: string;
    context?: Record<string, any>;
  };
  output: {
    primaryError: string;
    rootCause: string;
    confidence: number;
    fixes: string[];
  };
  explanation?: string;
}

export class FewShotExamples {
  private static examples: Map<string, FewShotExample[]> = new Map();

  static {
    this.initializeExamples();
  }

  /**
   * Initialize default few-shot examples
   */
  private static initializeExamples(): void {
    // Memory leak examples
    this.addExample({
      id: 'memory-leak-arraylist',
      crashType: 'MemoryLeak',
      input: {
        errorMessage: 'java.lang.OutOfMemoryError: Java heap space',
        stackTrace: `Exception in thread "main" java.lang.OutOfMemoryError: Java heap space
  at java.util.Arrays.copyOf(Arrays.java:3210)
  at java.util.Arrays.copyOf(Arrays.java:3181)
  at java.util.ArrayList.grow(ArrayList.java:265)
  at java.util.ArrayList.ensureExplicitCapacity(ArrayList.java:239)
  at com.app.cache.DataCache.addEntry(DataCache.java:45)`,
        context: {
          heapUsage: '98%',
          gcTime: '45s',
          objectCount: { ArrayList: 50000, DataEntry: 10000000 }
        }
      },
      output: {
        primaryError: 'Unbounded ArrayList growth in DataCache causing heap exhaustion',
        rootCause: 'DataCache.addEntry() adds entries without size limits or eviction policy',
        confidence: 95,
        fixes: [
          'Implement LRU eviction policy with max size limit',
          'Use WeakHashMap for automatic memory-pressure eviction',
          'Add periodic cleanup of old entries',
          'Monitor cache size and implement size-based eviction'
        ]
      },
      explanation: 'Classic unbounded collection growth pattern'
    });

    this.addExample({
      id: 'memory-leak-listener',
      crashType: 'MemoryLeak',
      input: {
        errorMessage: 'java.lang.OutOfMemoryError: unable to create new native thread',
        stackTrace: `Exception in thread "EventDispatcher" java.lang.OutOfMemoryError
  at java.lang.Thread.start0(Native Method)
  at java.lang.Thread.start(Thread.java:717)
  at com.app.events.EventBus.registerListener(EventBus.java:89)
  at com.app.ui.Dashboard.initialize(Dashboard.java:156)`,
        context: {
          threadCount: 8500,
          listenerCount: 8432
        }
      },
      output: {
        primaryError: 'Event listener leak preventing garbage collection',
        rootCause: 'EventBus holds strong references to listeners without cleanup',
        confidence: 90,
        fixes: [
          'Use WeakReference for event listeners',
          'Implement explicit unregister in component lifecycle',
          'Add listener leak detection in development mode',
          'Use event bus with automatic cleanup'
        ]
      }
    });

    // Null pointer examples
    this.addExample({
      id: 'npe-optional-chain',
      crashType: 'NullPointerException',
      input: {
        errorMessage: 'java.lang.NullPointerException',
        stackTrace: `java.lang.NullPointerException
  at com.app.service.UserService.getUserEmail(UserService.java:78)
  at com.app.api.NotificationAPI.sendEmail(NotificationAPI.java:45)
  at com.app.workflow.OrderWorkflow.notifyUser(OrderWorkflow.java:234)`,
        context: {
          code: 'return user.getProfile().getContactInfo().getEmail();'
        }
      },
      output: {
        primaryError: 'Unsafe method chaining without null checks',
        rootCause: 'Multiple potential null points in user.getProfile().getContactInfo().getEmail()',
        confidence: 95,
        fixes: [
          'Use Optional chaining: Optional.ofNullable(user).map(User::getProfile).map(Profile::getContactInfo).map(ContactInfo::getEmail)',
          'Add defensive null checks at each level',
          'Implement @NonNull annotations with static analysis',
          'Use Objects.requireNonNull() for fail-fast behavior'
        ]
      }
    });

    // Deadlock examples
    this.addExample({
      id: 'deadlock-classic',
      crashType: 'Deadlock',
      input: {
        errorMessage: 'Deadlock detected',
        stackTrace: `"Thread-1" waiting for lock 0x000000076ab62208
  at com.app.sync.AccountManager.transferMoney(AccountManager.java:45)
  - waiting to lock <0x000000076ab62208> (a com.app.model.Account)
  - locked <0x000000076ab621a8> (a com.app.model.Account)

"Thread-2" waiting for lock 0x000000076ab621a8  
  at com.app.sync.AccountManager.transferMoney(AccountManager.java:45)
  - waiting to lock <0x000000076ab621a8> (a com.app.model.Account)
  - locked <0x000000076ab62208> (a com.app.model.Account)`,
        context: {
          lockOrder: { 'Thread-1': ['Account-A', 'Account-B'], 'Thread-2': ['Account-B', 'Account-A'] }
        }
      },
      output: {
        primaryError: 'Classic circular wait deadlock in account transfer',
        rootCause: 'Inconsistent lock ordering between threads causing circular dependency',
        confidence: 100,
        fixes: [
          'Implement consistent lock ordering by account ID',
          'Use tryLock with timeout instead of blocking lock',
          'Implement lock-free algorithm using compare-and-swap',
          'Use database-level locking with proper isolation'
        ]
      }
    });

    // Connection timeout examples
    this.addExample({
      id: 'connection-pool-exhausted',
      crashType: 'ConnectionTimeout',
      input: {
        errorMessage: 'org.apache.commons.dbcp.SQLNestedException: Cannot get a connection, pool error Timeout waiting for idle object',
        stackTrace: `Caused by: java.util.NoSuchElementException: Timeout waiting for idle object
  at org.apache.commons.pool.impl.GenericObjectPool.borrowObject(GenericObjectPool.java:1167)
  at org.apache.commons.dbcp.PoolingDataSource.getConnection(PoolingDataSource.java:106)
  at com.app.dao.UserDAO.findById(UserDAO.java:123)`,
        context: {
          poolConfig: { maxActive: 10, maxIdle: 5, active: 10, idle: 0 },
          avgQueryTime: '2500ms',
          waitingThreads: 45
        }
      },
      output: {
        primaryError: 'Connection pool exhausted with all connections in use',
        rootCause: 'Slow queries (2.5s avg) combined with small pool size (10) causing exhaustion',
        confidence: 90,
        fixes: [
          'Increase pool size to handle concurrent load',
          'Optimize slow queries to reduce connection hold time',
          'Implement connection timeout and eviction',
          'Add query timeout to prevent long-running queries',
          'Monitor and alert on pool utilization'
        ]
      }
    });

    // Performance degradation examples
    this.addExample({
      id: 'n-plus-one-query',
      crashType: 'PerformanceTimeout',
      input: {
        errorMessage: 'Request timeout after 30000ms',
        stackTrace: `java.util.concurrent.TimeoutException: Request timeout
  at com.app.api.OrderAPI.getOrdersWithItems(OrderAPI.java:89)
  at com.app.dao.OrderDAO.loadItems(OrderDAO.java:145)`,
        context: {
          queryCount: 1001,
          queryPattern: '1 SELECT orders + 1000 SELECT items WHERE order_id = ?',
          responseTime: '28500ms'
        }
      },
      output: {
        primaryError: 'N+1 query problem causing performance degradation',
        rootCause: 'Loading order items individually for each order instead of batch loading',
        confidence: 95,
        fixes: [
          'Use JOIN query to fetch orders with items in single query',
          'Implement batch loading with WHERE order_id IN (...)',
          'Add @Fetch(FetchType.EAGER) or use entity graphs',
          'Enable query result caching for repeated queries',
          'Implement pagination to limit result set size'
        ]
      }
    });
  }

  /**
   * Add a new example
   */
  static addExample(example: FewShotExample): void {
    if (!this.examples.has(example.crashType)) {
      this.examples.set(example.crashType, []);
    }
    this.examples.get(example.crashType)!.push(example);
  }

  /**
   * Get examples for a crash type
   */
  static getExamples(crashType: string, limit?: number): FewShotExample[] {
    const examples = this.examples.get(crashType) || [];
    return limit ? examples.slice(0, limit) : examples;
  }

  /**
   * Get all crash types with examples
   */
  static getCrashTypes(): string[] {
    return Array.from(this.examples.keys());
  }

  /**
   * Find most relevant examples for given error
   */
  static findRelevantExamples(errorMessage: string, stackTrace: string, limit: number = 3): FewShotExample[] {
    const relevantExamples: Array<{example: FewShotExample; score: number}> = [];

    // Score each example based on similarity
    for (const [crashType, examples] of this.examples) {
      for (const example of examples) {
        const score = this.calculateSimilarity(errorMessage, stackTrace, example);
        if (score > 0) {
          relevantExamples.push({ example, score });
        }
      }
    }

    // Sort by score and return top examples
    return relevantExamples
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(item => item.example);
  }

  /**
   * Calculate similarity score between error and example
   */
  private static calculateSimilarity(errorMessage: string, stackTrace: string, example: FewShotExample): number {
    let score = 0;
    const errorLower = errorMessage.toLowerCase();
    const stackLower = stackTrace.toLowerCase();
    const exampleError = example.input.errorMessage.toLowerCase();
    const exampleStack = example.input.stackTrace.toLowerCase();

    // Check error message similarity
    if (errorLower.includes('outofmemory') && exampleError.includes('outofmemory')) score += 10;
    if (errorLower.includes('nullpointer') && exampleError.includes('nullpointer')) score += 10;
    if (errorLower.includes('deadlock') && exampleError.includes('deadlock')) score += 10;
    if (errorLower.includes('timeout') && exampleError.includes('timeout')) score += 10;

    // Check stack trace patterns
    const errorClasses = this.extractClassNames(stackTrace);
    const exampleClasses = this.extractClassNames(example.input.stackTrace);
    
    for (const className of errorClasses) {
      if (exampleClasses.has(className)) {
        score += 5;
      }
    }

    // Exact error type match
    if (errorMessage === example.input.errorMessage) {
      score += 20;
    }

    return score;
  }

  /**
   * Extract class names from stack trace
   */
  private static extractClassNames(stackTrace: string): Set<string> {
    const classes = new Set<string>();
    const classPattern = /at\s+([\w.]+)\./g;
    let match;
    
    while ((match = classPattern.exec(stackTrace)) !== null) {
      const className = match[1].split('.').pop();
      if (className) {
        classes.add(className);
      }
    }
    
    return classes;
  }

  /**
   * Format examples for prompt inclusion
   */
  static formatExamplesForPrompt(examples: FewShotExample[]): string {
    return examples.map((example, index) => {
      return `### Example ${index + 1}: ${example.crashType}

**Input:**
Error: ${example.input.errorMessage}
Stack Trace:
${example.input.stackTrace}
${example.input.context ? `Context: ${JSON.stringify(example.input.context, null, 2)}` : ''}

**Analysis:**
Primary Error: ${example.output.primaryError}
Root Cause: ${example.output.rootCause}
Confidence: ${example.output.confidence}%
Fixes:
${example.output.fixes.map(fix => `- ${fix}`).join('\n')}

${example.explanation ? `**Explanation:** ${example.explanation}` : ''}
`;
    }).join('\n---\n\n');
  }
}