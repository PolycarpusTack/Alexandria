/**
 * Prompt Versioning System
 *
 * Manages prompt versions and tracks their effectiveness
 */

export interface PromptVersion {
  id: string;
  promptId: string;
  version: number;
  content: string;
  template?: string;
  createdAt: Date;
  createdBy?: string;
  description?: string;
  changelog?: string;
  status: 'draft' | 'active' | 'deprecated' | 'archived';
  metrics: PromptMetrics;
  tags?: string[];
}

export interface PromptMetrics {
  usageCount: number;
  successRate: number;
  avgConfidence: number;
  avgInferenceTime: number;
  errorRate: number;
  userRatings?: {
    helpful: number;
    notHelpful: number;
  };
}

export interface PromptVersionComparison {
  versionA: PromptVersion;
  versionB: PromptVersion;
  metrics: {
    successRateDiff: number;
    confidenceDiff: number;
    inferenceTimeDiff: number;
    preferredVersion?: string;
  };
}

export class PromptVersioning {
  private static versions: Map<string, PromptVersion[]> = new Map();
  private static activeVersions: Map<string, string> = new Map(); // promptId -> versionId

  /**
   * Create a new prompt version
   */
  static createVersion(
    promptId: string,
    content: string,
    options?: {
      template?: string;
      description?: string;
      changelog?: string;
      createdBy?: string;
      tags?: string[];
    }
  ): PromptVersion {
    // Get existing versions for this prompt
    const existingVersions = this.versions.get(promptId) || [];
    const latestVersion = existingVersions[existingVersions.length - 1];
    const newVersionNumber = latestVersion ? latestVersion.version + 1 : 1;

    const version: PromptVersion = {
      id: uuidv4(),
      promptId,
      version: newVersionNumber,
      content,
      template: options?.template,
      createdAt: new Date(),
      createdBy: options?.createdBy,
      description: options?.description,
      changelog: options?.changelog,
      status: 'draft',
      metrics: {
        usageCount: 0,
        successRate: 0,
        avgConfidence: 0,
        avgInferenceTime: 0,
        errorRate: 0,
        userRatings: {
          helpful: 0,
          notHelpful: 0
        }
      },
      tags: options?.tags || []
    };

    // Store the version
    if (!this.versions.has(promptId)) {
      this.versions.set(promptId, []);
    }
    this.versions.get(promptId)!.push(version);

    return version;
  }

  /**
   * Activate a prompt version
   */
  static activateVersion(versionId: string): void {
    // Find the version
    let targetVersion: PromptVersion | null = null;
    let promptId: string | null = null;

    for (const [pid, versions] of this.versions) {
      const version = versions.find((v) => v.id === versionId);
      if (version) {
        targetVersion = version;
        promptId = pid;
        break;
      }
    }

    if (!targetVersion || !promptId) {
      throw new Error(`Version ${versionId} not found`);
    }

    // Deactivate current active version
    const currentActiveId = this.activeVersions.get(promptId);
    if (currentActiveId) {
      const currentActive = this.getVersion(currentActiveId);
      if (currentActive && currentActive.status === 'active') {
        currentActive.status = 'deprecated';
      }
    }

    // Activate new version
    targetVersion.status = 'active';
    this.activeVersions.set(promptId, versionId);
  }

  /**
   * Get active version for a prompt
   */
  static getActiveVersion(promptId: string): PromptVersion | null {
    const activeId = this.activeVersions.get(promptId);
    if (!activeId) return null;

    return this.getVersion(activeId);
  }

  /**
   * Get a specific version
   */
  static getVersion(versionId: string): PromptVersion | null {
    for (const versions of this.versions.values()) {
      const version = versions.find((v) => v.id === versionId);
      if (version) return version;
    }
    return null;
  }

  /**
   * Get all versions for a prompt
   */
  static getVersionHistory(promptId: string): PromptVersion[] {
    return this.versions.get(promptId) || [];
  }

  /**
   * Update metrics for a version
   */
  static updateMetrics(
    versionId: string,
    result: {
      success: boolean;
      confidence?: number;
      inferenceTime?: number;
      userFeedback?: 'helpful' | 'not-helpful';
    }
  ): void {
    const version = this.getVersion(versionId);
    if (!version) return;

    const metrics = version.metrics;
    metrics.usageCount++;

    // Update success rate
    if (result.success) {
      metrics.successRate =
        (metrics.successRate * (metrics.usageCount - 1) + 1) / metrics.usageCount;
    } else {
      metrics.successRate = (metrics.successRate * (metrics.usageCount - 1)) / metrics.usageCount;
      metrics.errorRate = 1 - metrics.successRate;
    }

    // Update confidence
    if (result.confidence !== undefined) {
      metrics.avgConfidence =
        (metrics.avgConfidence * (metrics.usageCount - 1) + result.confidence) / metrics.usageCount;
    }

    // Update inference time
    if (result.inferenceTime !== undefined) {
      metrics.avgInferenceTime =
        (metrics.avgInferenceTime * (metrics.usageCount - 1) + result.inferenceTime) /
        metrics.usageCount;
    }

    // Update user ratings
    if (result.userFeedback && metrics.userRatings) {
      if (result.userFeedback === 'helpful') {
        metrics.userRatings.helpful++;
      } else {
        metrics.userRatings.notHelpful++;
      }
    }
  }

  /**
   * Compare two versions
   */
  static compareVersions(versionAId: string, versionBId: string): PromptVersionComparison | null {
    const versionA = this.getVersion(versionAId);
    const versionB = this.getVersion(versionBId);

    if (!versionA || !versionB) return null;

    const successRateDiff = versionB.metrics.successRate - versionA.metrics.successRate;
    const confidenceDiff = versionB.metrics.avgConfidence - versionA.metrics.avgConfidence;
    const inferenceTimeDiff = versionB.metrics.avgInferenceTime - versionA.metrics.avgInferenceTime;

    // Determine preferred version (higher success rate and confidence, lower inference time)
    let preferredVersion: string | undefined;
    const scoreA =
      versionA.metrics.successRate +
      versionA.metrics.avgConfidence -
      versionA.metrics.avgInferenceTime / 10000;
    const scoreB =
      versionB.metrics.successRate +
      versionB.metrics.avgConfidence -
      versionB.metrics.avgInferenceTime / 10000;

    if (scoreA > scoreB) {
      preferredVersion = versionAId;
    } else if (scoreB > scoreA) {
      preferredVersion = versionBId;
    }

    return {
      versionA,
      versionB,
      metrics: {
        successRateDiff,
        confidenceDiff,
        inferenceTimeDiff,
        preferredVersion
      }
    };
  }

  /**
   * Get best performing version for a prompt
   */
  static getBestVersion(promptId: string): PromptVersion | null {
    const versions = this.getVersionHistory(promptId);
    if (versions.length === 0) return null;

    // Filter for versions with sufficient usage
    const qualifiedVersions = versions.filter(
      (v) => v.metrics.usageCount >= 10 && v.status !== 'archived'
    );

    if (qualifiedVersions.length === 0) {
      // Return latest active/draft version
      return (
        versions
          .filter((v) => v.status === 'active' || v.status === 'draft')
          .sort((a, b) => b.version - a.version)[0] || null
      );
    }

    // Score based on success rate, confidence, and inference time
    return qualifiedVersions.reduce((best, current) => {
      const bestScore =
        best.metrics.successRate +
        best.metrics.avgConfidence -
        best.metrics.avgInferenceTime / 10000;
      const currentScore =
        current.metrics.successRate +
        current.metrics.avgConfidence -
        current.metrics.avgInferenceTime / 10000;

      return currentScore > bestScore ? current : best;
    });
  }

  /**
   * Archive old versions
   */
  static archiveOldVersions(promptId: string, keepCount: number = 5): void {
    const versions = this.getVersionHistory(promptId);
    const sortedVersions = versions.sort((a, b) => b.version - a.version);

    // Keep the most recent versions and any active version
    const toArchive = sortedVersions.slice(keepCount);

    for (const version of toArchive) {
      if (version.status !== 'active') {
        version.status = 'archived';
      }
    }
  }

  /**
   * Export version history
   */
  static exportVersionHistory(promptId: string): string {
    const versions = this.getVersionHistory(promptId);
    const history = versions.map((v) => ({
      version: v.version,
      createdAt: v.createdAt,
      status: v.status,
      metrics: v.metrics,
      description: v.description,
      changelog: v.changelog
    }));

    return JSON.stringify(history, null, 2);
  }

  /**
   * Clone a version as a new draft
   */
  static cloneVersion(
    versionId: string,
    modifications?: Partial<PromptVersion>
  ): PromptVersion | null {
    const original = this.getVersion(versionId);
    if (!original) return null;

    return this.createVersion(original.promptId, modifications?.content || original.content, {
      template: modifications?.template || original.template,
      description: modifications?.description || `Cloned from v${original.version}`,
      changelog: modifications?.changelog || `Based on version ${original.version}`,
      createdBy: modifications?.createdBy,
      tags: modifications?.tags || original.tags
    });
  }
}
