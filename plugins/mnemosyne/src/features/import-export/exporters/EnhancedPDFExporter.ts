/**
 * Enhanced PDF Exporter - Wrapper for modular implementation
 * This file provides backward compatibility while using the new modular structure
 */

import { PDFExporter } from '../../pdf-export/core/PDFExporter';
import { 
  MnemosyneCore,
  Document as MnemosyneDocument
} from '../../../core/MnemosyneCore';
import { MnemosyneTemplateEngine } from '../../templates/TemplateEngine';
import { ExportOptions, ExportContext } from '../core/ExportEngine';
import { PDFExportOptions as ModularPDFOptions } from '../../pdf-export/core/types';

// Re-export types for backward compatibility
export type { 
  PDFExportOptions as AdvancedPDFOptions,
  ProcessedContent,
  ProcessedDocument,
  TableOfContents,
  ContentIndex,
  Glossary,
  Bibliography,
  ExportMetadata,
  ContentAnalytics
} from '../../pdf-export/core/types';

/**
 * Legacy EnhancedPDFExporter class that wraps the new modular implementation
 * @deprecated Use PDFExporter from pdf-export/core/PDFExporter directly
 */
export class EnhancedPDFExporter {
  private pdfExporter: PDFExporter;

  constructor(
    mnemosyne: MnemosyneCore,
    templateEngine: MnemosyneTemplateEngine
  ) {
    this.pdfExporter = new PDFExporter(mnemosyne, templateEngine);
  }

  /**
   * Export documents to PDF
   * Delegates to the modular PDFExporter implementation
   */
  async exportToPDF(
    documents: MnemosyneDocument[],
    context: ExportContext,
    options: ExportOptions & { pdfOptions?: ModularPDFOptions } = {}
  ): Promise<Buffer> {
    return this.pdfExporter.exportToPDF(documents, context, options);
  }
}