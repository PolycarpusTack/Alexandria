import { PluginContext } from '../../../../../../core/plugin-registry/interfaces';
import { MnemosyneDocument } from '../../../interfaces';
import { ParsedLink } from '../interfaces';

export interface ConversionOptions {
  sourceFormat: string;
  targetFormat?: string;
  preserveStructure: boolean;
  convertWikilinks: boolean;
  preserveMetadata?: boolean;
  enhanceWithAI?: boolean;
}

export class FormatConverter {
  private converters: Map<string, Converter> = new Map();

  constructor(private context: PluginContext) {
    this.registerDefaultConverters();
  }

  /**
   * Register a format converter
   */
  registerConverter(format: string, converter: Converter): void {
    this.converters.set(format, converter);
  }

  /**
   * Convert document to Mnemosyne format
   */
  async convert(document: any, options: ConversionOptions): Promise<MnemosyneDocument> {
    const converter = this.getConverter(options.sourceFormat);

    // Basic conversion
    let converted = await converter.toMnemosyne(document, options);

    // Apply common transformations
    if (options.convertWikilinks) {
      converted = await this.convertWikilinks(converted);
    }

    // Enhance with AI if requested
    if (options.enhanceWithAI) {
      converted = await this.enhanceWithAI(converted);
    }

    // Validate converted document
    this.validateDocument(converted);

    return converted;
  }

  /**
   * Convert Mnemosyne document to target format
   */
  async convertFrom(
    document: MnemosyneDocument,
    targetFormat: string,
    options?: any
  ): Promise<any> {
    const converter = this.getConverter(targetFormat);
    return converter.fromMnemosyne(document, options);
  }

  /**
   * Batch convert documents
   */
  async batchConvert(documents: any[], options: ConversionOptions): Promise<MnemosyneDocument[]> {
    const converted: MnemosyneDocument[] = [];

    for (const doc of documents) {
      try {
        const result = await this.convert(doc, options);
        converted.push(result);
      } catch (error) {
        this.context.logger.error('Document conversion failed', {
          document: doc.title || doc.path,
          error: error.message
        });
      }
    }

    return converted;
  }

  // Private methods

  private registerDefaultConverters(): void {
    // Markdown converter
    this.registerConverter('markdown', new MarkdownConverter());

    // Obsidian converter
    this.registerConverter('obsidian', new ObsidianConverter());

    // Notion converter
    this.registerConverter('notion', new NotionConverter());

    // JSON converter
    this.registerConverter('json', new JSONConverter());
  }

  private getConverter(format: string): Converter {
    const converter = this.converters.get(format);
    if (!converter) {
      // Fall back to generic converter
      return new GenericConverter();
    }
    return converter;
  }

  private async convertWikilinks(document: MnemosyneDocument): Promise<MnemosyneDocument> {
    const wikiLinkRegex = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

    document.content = document.content.replace(wikiLinkRegex, (match, target, alias) => {
      // Convert to Mnemosyne internal link format
      const linkId = this.generateLinkId(target);
      const displayText = alias || target;
      return `[${displayText}](mnemosyne://${linkId})`;
    });

    // Extract and store links
    const links: ParsedLink[] = [];
    let match;

    wikiLinkRegex.lastIndex = 0; // Reset regex
    while ((match = wikiLinkRegex.exec(document.content)) !== null) {
      links.push({
        type: 'wikilink',
        target: match[1],
        alias: match[2],
        position: {
          start: match.index,
          end: match.index + match[0].length
        }
      });
    }

    // Store links in metadata
    if (!document.metadata) document.metadata = {};
    document.metadata.parsedLinks = links;

    return document;
  }

  private async enhanceWithAI(document: MnemosyneDocument): Promise<MnemosyneDocument> {
    // Check if ALFRED is available
    const alfred = this.context.plugins?.get('alfred');
    if (!alfred) {
      return document;
    }

    try {
      // Enhance metadata
      if (!document.metadata?.summary) {
        document.metadata = document.metadata || {};
        document.metadata.summary = await this.generateSummary(document.content);
      }

      // Extract key concepts
      if (!document.tags || document.tags.length === 0) {
        document.tags = await this.extractTags(document.content);
      }

      // Suggest related topics
      document.metadata.suggestedRelated = await this.suggestRelated(document);
    } catch (error) {
      this.context.logger.warn('AI enhancement failed', { error });
    }

    return document;
  }

  private validateDocument(document: MnemosyneDocument): void {
    const errors: string[] = [];

    if (!document.id) {
      document.id = uuidv4();
    }

    if (!document.title || document.title.trim() === '') {
      errors.push('Document must have a title');
    }

    if (!document.content) {
      document.content = '';
    }

    if (!document.createdAt) {
      document.createdAt = new Date();
    }

    if (!document.updatedAt) {
      document.updatedAt = new Date();
    }

    if (!document.version) {
      document.version = 1;
    }

    if (errors.length > 0) {
      throw new Error(`Document validation failed: ${errors.join(', ')}`);
    }
  }

  private generateLinkId(target: string): string {
    // Generate stable ID for link target
    return target.toLowerCase().replace(/\s+/g, '-');
  }

  private async generateSummary(content: string): Promise<string> {
    // AI-powered summary generation
    // For now, return first paragraph
    const firstParagraph = content.split('\n\n')[0];
    return firstParagraph.substring(0, 200) + '...';
  }

  private async extractTags(content: string): Promise<string[]> {
    // AI-powered tag extraction
    // For now, extract hashtags
    const hashtags = content.match(/#[\w-]+/g) || [];
    return hashtags.map((tag) => tag.substring(1));
  }

  private async suggestRelated(document: MnemosyneDocument): Promise<string[]> {
    // AI-powered related document suggestions
    return [];
  }
}

/**
 * Base converter interface
 */
interface Converter {
  toMnemosyne(source: any, options: ConversionOptions): Promise<MnemosyneDocument>;
  fromMnemosyne(document: MnemosyneDocument, options?: any): Promise<any>;
}

/**
 * Markdown converter
 */
class MarkdownConverter implements Converter {
  async toMnemosyne(source: any, options: ConversionOptions): Promise<MnemosyneDocument> {
    const document: MnemosyneDocument = {
      id: uuidv4(),
      title: this.extractTitle(source),
      content: source.content || source,
      format: 'markdown',
      tags: this.extractTags(source),
      metadata: this.extractMetadata(source),
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1
    };

    return document;
  }

  async fromMnemosyne(document: MnemosyneDocument, options?: any): Promise<string> {
    let markdown = '';

    // Add frontmatter if metadata exists
    if (document.metadata && Object.keys(document.metadata).length > 0) {
      markdown += '---\n';
      markdown += this.serializeMetadata(document.metadata);
      markdown += '---\n\n';
    }

    // Add title
    markdown += `# ${document.title}\n\n`;

    // Add content
    markdown += document.content;

    return markdown;
  }

  private extractTitle(source: any): string {
    if (source.title) return source.title;

    // Extract from first heading
    const match = source.content?.match(/^#\s+(.+)$/m);
    if (match) return match[1];

    // Extract from filename
    if (source.path) {
      return source.path.split('/').pop()?.replace(/\.md$/, '') || 'Untitled';
    }

    return 'Untitled';
  }

  private extractTags(source: any): string[] {
    const tags: string[] = [];

    // From metadata
    if (source.metadata?.tags) {
      tags.push(...source.metadata.tags);
    }

    // From content hashtags
    const hashtags = source.content?.match(/#[\w-]+/g) || [];
    tags.push(...hashtags.map((tag: string) => tag.substring(1)));

    return [...new Set(tags)];
  }

  private extractMetadata(source: any): Record<string, any> {
    return source.metadata || {};
  }

  private serializeMetadata(metadata: Record<string, any>): string {
    return (
      Object.entries(metadata)
        .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
        .join('\n') + '\n'
    );
  }
}

/**
 * Obsidian converter
 */
class ObsidianConverter extends MarkdownConverter {
  async toMnemosyne(source: any, options: ConversionOptions): Promise<MnemosyneDocument> {
    const document = await super.toMnemosyne(source, options);

    // Preserve Obsidian-specific metadata
    document.metadata.obsidian = {
      vault: source.vault,
      path: source.path,
      frontmatter: source.frontmatter,
      plugins: source.plugins
    };

    // Convert Obsidian tags
    if (source.frontmatter?.tags) {
      document.tags = [...document.tags, ...source.frontmatter.tags];
    }

    // Handle daily notes
    if (source.isDailyNote) {
      document.metadata.type = 'daily-note';
      document.metadata.date = source.date;
    }

    return document;
  }
}

/**
 * Notion converter
 */
class NotionConverter implements Converter {
  async toMnemosyne(source: any, options: ConversionOptions): Promise<MnemosyneDocument> {
    const document: MnemosyneDocument = {
      id: source.id || uuidv4(),
      title: source.title || this.extractTitleFromBlocks(source.blocks),
      content: await this.convertBlocks(source.blocks),
      format: 'markdown',
      tags: source.tags || [],
      metadata: {
        notion: {
          pageId: source.pageId,
          workspace: source.workspace,
          properties: source.properties,
          cover: source.cover,
          icon: source.icon
        }
      },
      createdAt: source.createdTime ? new Date(source.createdTime) : new Date(),
      updatedAt: source.lastEditedTime ? new Date(source.lastEditedTime) : new Date(),
      version: 1
    };

    return document;
  }

  async fromMnemosyne(document: MnemosyneDocument, options?: any): Promise<any> {
    // Convert back to Notion format
    return {
      title: document.title,
      blocks: this.markdownToBlocks(document.content),
      properties: document.metadata?.notion?.properties || {}
    };
  }

  private extractTitleFromBlocks(blocks: any[]): string {
    const firstHeading = blocks?.find((b) => b.type === 'heading_1');
    return firstHeading?.text || 'Untitled';
  }

  private async convertBlocks(blocks: any[]): Promise<string> {
    if (!blocks) return '';

    const markdown: string[] = [];

    for (const block of blocks) {
      markdown.push(await this.blockToMarkdown(block));
    }

    return markdown.join('\n\n');
  }

  private async blockToMarkdown(block: any): Promise<string> {
    switch (block.type) {
      case 'paragraph':
        return block.text || '';
      case 'heading_1':
        return `# ${block.text}`;
      case 'heading_2':
        return `## ${block.text}`;
      case 'heading_3':
        return `### ${block.text}`;
      case 'bulleted_list_item':
        return `- ${block.text}`;
      case 'numbered_list_item':
        return `1. ${block.text}`;
      case 'code':
        return `\`\`\`${block.language || ''}\n${block.text}\n\`\`\``;
      case 'quote':
        return `> ${block.text}`;
      default:
        return block.text || '';
    }
  }

  private markdownToBlocks(markdown: string): any[] {
    // Convert markdown back to Notion blocks
    // Simplified implementation
    return markdown.split('\n\n').map((paragraph) => ({
      type: 'paragraph',
      text: paragraph
    }));
  }
}

/**
 * JSON converter
 */
class JSONConverter implements Converter {
  async toMnemosyne(source: any, options: ConversionOptions): Promise<MnemosyneDocument> {
    // Direct mapping from JSON
    return {
      id: source.id || uuidv4(),
      title: source.title || 'Untitled',
      content: source.content || '',
      format: source.format || 'markdown',
      tags: source.tags || [],
      metadata: source.metadata || {},
      createdAt: source.createdAt ? new Date(source.createdAt) : new Date(),
      updatedAt: source.updatedAt ? new Date(source.updatedAt) : new Date(),
      version: source.version || 1
    };
  }

  async fromMnemosyne(document: MnemosyneDocument, options?: any): Promise<any> {
    return {
      ...document,
      createdAt: document.createdAt.toISOString(),
      updatedAt: document.updatedAt.toISOString()
    };
  }
}

/**
 * Generic converter for unknown formats
 */
class GenericConverter implements Converter {
  async toMnemosyne(source: any, options: ConversionOptions): Promise<MnemosyneDocument> {
    return {
      id: uuidv4(),
      title: source.title || source.name || 'Imported Document',
      content: source.content || source.text || JSON.stringify(source, null, 2),
      format: 'text',
      tags: [],
      metadata: {
        originalFormat: options.sourceFormat,
        imported: true
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1
    };
  }

  async fromMnemosyne(document: MnemosyneDocument, options?: any): Promise<any> {
    return document.content;
  }
}
