import { 
  MnemosyneCore,
  Document as MnemosyneDocument 
} from '../../../core/MnemosyneCore';
import { TemplateEngine } from '../../templates/TemplateEngine';
import { ExportOptions, ExportContext } from '../core/ExportEngine';
import * as puppeteer from 'puppeteer';
import * as path from 'path';

interface PDFOptions {
  format?: 'A4' | 'Letter' | 'A3';
  margin?: {
    top?: string;
    right?: string;
    bottom?: string;
    left?: string;
  };
  displayHeaderFooter?: boolean;
  headerTemplate?: string;
  footerTemplate?: string;
  printBackground?: boolean;
  landscape?: boolean;
  pageRanges?: string;
  preferCSSPageSize?: boolean;
}

export class PDFExporter {
  constructor(
    private mnemosyne: MnemosyneCore,
    private templateEngine: TemplateEngine
  ) {}

  /**
   * Export documents to PDF
   */
  async export(
    documents: MnemosyneDocument[],
    context: ExportContext,
    options: ExportOptions
  ): Promise<Buffer> {
    // 1. Select template
    const template = context.template || await this.getDefaultTemplate(options);
    
    // 2. Prepare document content
    const content = await this.prepareContent(documents, options);
    
    // 3. Add table of contents if requested
    if (options.pdfOptions?.tableOfContents) {
      content.tableOfContents = this.generateTableOfContents(documents);
    }
    
    // 4. Add knowledge graph visualization if requested
    if (options.includeGraph) {
      content.knowledgeGraph = await this.generateKnowledgeGraphData(documents);
    }
    
    // 5. Render HTML using template
    const html = await this.templateEngine.render(template.id, {
      ...content,
      ...context.metadata,
      exportOptions: options
    });
    
    // 6. Apply CSS styling
    const styledHTML = this.applyStyles(html, template, options);
    
    // 7. Generate PDF
    const pdf = await this.generatePDF(styledHTML, options.pdfOptions || {});
    
    return pdf;
  }

  /**
   * Prepare content for PDF generation
   */
  private async prepareContent(
    documents: MnemosyneDocument[],
    options: ExportOptions
  ): Promise<any> {
    const content: any = {
      documents: [],
      metadata: {
        exportDate: new Date(),
        documentCount: documents.length
      }
    };
    
    // Process each document
    for (const doc of documents) {
      const processed = {
        ...doc,
        content: await this.processMarkdown(doc.content),
        backlinks: options.includeBacklinks 
          ? await this.getBacklinks(doc.id)
          : []
      };
      
      content.documents.push(processed);
    }
    
    return content;
  }

  /**
   * Generate table of contents
   */
  private generateTableOfContents(documents: MnemosyneDocument[]): TableOfContents {
    const toc: TableOfContents = {
      sections: []
    };
    
    documents.forEach((doc, index) => {
      const section: TOCSection = {
        title: doc.title,
        page: index + 1,
        id: doc.id,
        subsections: this.extractHeadings(doc.content)
      };
      
      toc.sections.push(section);
    });
    
    return toc;
  }

  /**
   * Extract headings from markdown content
   */
  private extractHeadings(content: string): TOCSection[] {
    const headings: TOCSection[] = [];
    const headingPattern = /^(#{1,6})\s+(.+)$/gm;
    let match;
    
    while ((match = headingPattern.exec(content)) !== null) {
      const level = match[1].length;
      const title = match[2];
      
      if (level <= 3) { // Only include h1, h2, h3
        headings.push({
          title,
          level,
          id: this.slugify(title)
        });
      }
    }
    
    return headings;
  }

  /**
   * Apply CSS styles to HTML
   */
  private applyStyles(html: string, template: any, options: ExportOptions): string {
    const css = this.generateCSS(template, options);
    
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mnemosyne Export</title>
  <style>${css}</style>
</head>
<body>
  ${html}
</body>
</html>`;
  }

  /**
   * Generate CSS for PDF
   */
  private generateCSS(template: any, options: ExportOptions): string {
    const baseCSS = `
      @page {
        size: ${options.pdfOptions?.format || 'A4'};
        margin: 20mm;
      }
      
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        line-height: 1.6;
        color: #333;
        max-width: 100%;
      }
      
      h1, h2, h3, h4, h5, h6 {
        page-break-after: avoid;
        margin-top: 1.5em;
        margin-bottom: 0.5em;
      }
      
      h1 { font-size: 2em; color: #1a1a1a; }
      h2 { font-size: 1.5em; color: #2a2a2a; }
      h3 { font-size: 1.2em; color: #3a3a3a; }
      
      p { margin: 1em 0; }
      
      code {
        background-color: #f5f5f5;
        padding: 2px 4px;
        border-radius: 3px;
        font-size: 0.9em;
      }
      
      pre {
        background-color: #f5f5f5;
        padding: 12px;
        border-radius: 4px;
        overflow-x: auto;
        page-break-inside: avoid;
      }
      
      blockquote {
        border-left: 4px solid #ddd;
        margin: 1em 0;
        padding-left: 1em;
        color: #666;
      }
      
      table {
        width: 100%;
        border-collapse: collapse;
        margin: 1em 0;
        page-break-inside: avoid;
      }
      
      th, td {
        border: 1px solid #ddd;
        padding: 8px;
        text-align: left;
      }
      
      th {
        background-color: #f5f5f5;
        font-weight: bold;
      }
      
      .page-break {
        page-break-after: always;
      }
      
      .toc {
        page-break-after: always;
      }
      
      .toc-entry {
        margin: 0.5em 0;
      }
      
      .toc-level-1 { margin-left: 0; }
      .toc-level-2 { margin-left: 2em; }
      .toc-level-3 { margin-left: 4em; }
      
      .knowledge-graph {
        page-break-inside: avoid;
        text-align: center;
        margin: 2em 0;
      }
      
      .metadata {
        font-size: 0.9em;
        color: #666;
        margin-bottom: 2em;
      }
      
      @media print {
        .no-print { display: none; }
      }
    `;
    
    // Add template-specific CSS
    const templateCSS = template.css || '';
    
    return baseCSS + '\n' + templateCSS;
  }

  /**
   * Generate PDF using Puppeteer
   */
  private async generatePDF(html: string, options: PDFOptions): Promise<Buffer> {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      
      // Generate PDF
      const pdf = await page.pdf({
        format: options.format || 'A4',
        margin: options.margin || {
          top: '20mm',
          right: '20mm',
          bottom: '20mm',
          left: '20mm'
        },
        displayHeaderFooter: options.displayHeaderFooter || false,
        headerTemplate: options.headerTemplate,
        footerTemplate: options.footerTemplate,
        printBackground: options.printBackground !== false,
        landscape: options.landscape || false,
        preferCSSPageSize: options.preferCSSPageSize || false
      });
      
      return pdf;
    } finally {
      await browser.close();
    }
  }

  /**
   * Process markdown to HTML
   */
  private async processMarkdown(markdown: string): Promise<string> {
    // This would use a markdown processor like marked or markdown-it
    // For now, returning as-is (in real implementation would convert)
    return markdown;
  }

  /**
   * Get default PDF template
   */
  private async getDefaultTemplate(options: ExportOptions): Promise<any> {
    const templateId = 'pdf-export-default';
    return this.templateEngine.getTemplate(templateId);
  }

  /**
   * Get backlinks for a document
   */
  private async getBacklinks(documentId: string): Promise<any[]> {
    const relationships = await this.mnemosyne.knowledgeGraph.getRelationships(
      documentId,
      { type: 'links-to', direction: 'incoming' }
    );
    
    return relationships;
  }

  /**
   * Generate knowledge graph data for visualization
   */
  private async generateKnowledgeGraphData(documents: MnemosyneDocument[]): Promise<any> {
    const nodes = documents.map(doc => ({
      id: doc.id,
      label: doc.title,
      group: doc.metadata?.type || 'default'
    }));
    
    const edges = [];
    for (const doc of documents) {
      const relationships = await this.mnemosyne.knowledgeGraph.getRelationships(doc.id);
      edges.push(...relationships.map(rel => ({
        from: rel.sourceId,
        to: rel.targetId,
        label: rel.type
      })));
    }
    
    return { nodes, edges };
  }

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
}

interface TableOfContents {
  sections: TOCSection[];
}

interface TOCSection {
  title: string;
  page?: number;
  level?: number;
  id: string;
  subsections?: TOCSection[];
}