/**
 * Static Site Generator for Mnemosyne - Wrapper for modular implementation
 * This file provides backward compatibility while using the new modular structure
 */

import { SiteGenerator } from '../../static-site/core/SiteGenerator';
import { 
  MnemosyneCore,
  Document as MnemosyneDocument
} from '../../../core/MnemosyneCore';
import { MnemosyneTemplateEngine } from '../../templates/TemplateEngine';
import { ExportOptions, ExportContext } from '../core/ExportEngine';
import { 
  StaticSiteOptions as ModularStaticSiteOptions,
  GeneratedSite
} from '../../static-site/core/types';

// Re-export types for backward compatibility
export type { 
  StaticSiteOptions,
  GeneratedSite,
  GeneratedPage,
  GeneratedAsset,
  BuildManifest,
  PerformanceMetrics
} from '../../static-site/core/types';

/**
 * Legacy StaticSiteGenerator class that wraps the new modular implementation
 * @deprecated Use SiteGenerator from static-site/core/SiteGenerator directly
 */
export class StaticSiteGenerator {
  private siteGenerator: SiteGenerator;

  constructor(
    mnemosyne: MnemosyneCore,
    templateEngine: MnemosyneTemplateEngine
  ) {
    this.siteGenerator = new SiteGenerator(mnemosyne, templateEngine);
  }

  /**
   * Generate complete static site from Mnemosyne documents
   * Delegates to the modular SiteGenerator implementation
   */
  async generateSite(
    documents: MnemosyneDocument[],
    context: ExportContext,
    options: ExportOptions & { staticSiteOptions?: ModularStaticSiteOptions } = {}
  ): Promise<GeneratedSite> {
    return this.siteGenerator.generateSite(documents, context, options);
  }
}