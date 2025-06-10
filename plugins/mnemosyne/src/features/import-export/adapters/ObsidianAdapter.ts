import { 
  ImportAdapter, 
  ImportAnalysis, 
  ParsedContent,
  RawDocument,
  RawRelationship,
  RawAttachment,
  DocumentPreview
} from './base/ImportAdapter';
import { 
  MnemosyneCore,
  Document as MnemosyneDocument,
  KnowledgeRelationship
} from '../../../core/MnemosyneCore';
import { ImportSource, ImportOptions } from '../core/ImportEngine';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as matter from 'gray-matter';

interface ObsidianVault {
  path: string;
  notes: ObsidianNote[];
  attachments: ObsidianAttachment[];
  config: ObsidianConfig;
}

interface ObsidianNote {
  path: string;
  content: string;
  frontmatter: any;
  tags: string[];
  links: string[];
  embeds: string[];
  created: Date;
  modified: Date;
}

interface ObsidianAttachment {
  path: string;
  type: string;
  size: number;
}

interface ObsidianConfig {
  attachmentFolder?: string;
  newFileLocation?: string;
  useMarkdownLinks?: boolean;
}

export default class ObsidianAdapter extends ImportAdapter {
  private vault?: ObsidianVault;
  
  /**
   * Detect if source is an Obsidian vault
   */
  async detect(source: ImportSource): Promise<boolean> {
    if (source.type !== 'obsidian') return false;
    
    try {
      // Check for .obsidian folder
      const obsidianPath = path.join(source.path, '.obsidian');
      const stats = await fs.stat(obsidianPath);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }
  
  /**
   * Analyze Obsidian vault structure
   */
  async analyze(source: ImportSource): Promise<ImportAnalysis> {
    this.vault = await this.scanVault(source.path);
    
    const analysis: ImportAnalysis = {
      documentCount: this.vault.notes.length,
      linkCount: this.countLinks(this.vault.notes),
      attachmentCount: this.vault.attachments.length,
      tagCount: this.countTags(this.vault.notes),
      structure: {
        folders: await this.analyzeFolderStructure(source.path),
        tags: this.extractAllTags(this.vault.notes),
        linkGraph: this.buildLinkGraph(this.vault.notes)
      },
      preview: {
        sampleDocuments: await this.generatePreviews(this.vault.notes.slice(0, 3)),
        transformations: this.getTransformationPreviews()
      },
      warnings: await this.detectWarnings(this.vault),
      estimatedDuration: this.estimateImportDuration(this.vault)
    };
    
    return analysis;
  }
  
  /**
   * Parse Obsidian vault into raw content
   */
  async parse(source: ImportSource): Promise<ParsedContent> {
    if (!this.vault) {
      this.vault = await this.scanVault(source.path);
    }
    
    const documents: RawDocument[] = [];
    const relationships: RawRelationship[] = [];
    const attachments: RawAttachment[] = [];
    
    // Parse each note
    for (const note of this.vault.notes) {
      const parsed = this.parseNote(note);
      documents.push(parsed.document);
      relationships.push(...parsed.relationships);
    }
    
    // Parse attachments
    for (const attachment of this.vault.attachments) {
      attachments.push(await this.parseAttachment(attachment));
    }
    
    return {
      documents,
      relationships,
      attachments,
      metadata: {
        vault: this.vault.config,
        importDate: new Date()
      }
    };
  }
  
  /**
   * Transform to Mnemosyne documents
   */
  async transform(
    content: ParsedContent,
    options: ImportOptions
  ): Promise<MnemosyneDocument[]> {
    const documents: MnemosyneDocument[] = [];
    
    for (const raw of content.documents) {
      const doc: MnemosyneDocument = {
        id: this.generateDocumentId('obsidian', raw.path),
        title: raw.title,
        content: await this.transformContent(raw.content, options),
        tags: raw.tags || [],
        created: raw.created || new Date(),
        modified: raw.modified || new Date(),
        metadata: {
          source: 'obsidian',
          originalPath: raw.path,
          frontmatter: raw.frontmatter,
          obsidian: {
            dailyNote: this.isDailyNote(raw.path),
            canvas: this.isCanvas(raw.path),
            template: this.isTemplate(raw.path)
          }
        }
      };
      
      documents.push(doc);
    }
    
    return documents;
  }
}
  /**
   * Map relationships for knowledge graph
   */
  async mapRelationships(
    documents: MnemosyneDocument[]
  ): Promise<KnowledgeRelationship[]> {
    const relationships: KnowledgeRelationship[] = [];
    
    for (const doc of documents) {
      // Extract links from content
      const links = this.extractLinks(doc.content);
      
      for (const link of links) {
        const targetDoc = documents.find(d => 
          d.metadata?.originalPath === link ||
          d.title === link
        );
        
        if (targetDoc) {
          relationships.push({
            sourceId: doc.id,
            targetId: targetDoc.id,
            type: 'links-to',
            metadata: {
              originalLink: link,
              linkType: 'wikilink'
            }
          });
        }
      }
      
      // Map folder relationships
      const folderPath = path.dirname(doc.metadata?.originalPath || '');
      if (folderPath && folderPath !== '.') {
        relationships.push({
          sourceId: doc.id,
          targetId: `folder-${this.sanitizeId(folderPath)}`,
          type: 'in-folder',
          metadata: {
            folderPath
          }
        });
      }
    }
    
    return relationships;
  }
  
  /**
   * Scan Obsidian vault
   */
  private async scanVault(vaultPath: string): Promise<ObsidianVault> {
    const notes: ObsidianNote[] = [];
    const attachments: ObsidianAttachment[] = [];
    const config = await this.loadVaultConfig(vaultPath);
    
    // Recursively scan for files
    await this.scanDirectory(vaultPath, async (filePath) => {
      const ext = path.extname(filePath).toLowerCase();
      
      if (ext === '.md') {
        const note = await this.loadNote(filePath, vaultPath);
        notes.push(note);
      } else if (this.isAttachment(ext)) {
        const attachment = await this.loadAttachment(filePath, vaultPath);
        attachments.push(attachment);
      }
    });
    
    return { path: vaultPath, notes, attachments, config };
  }
  
  /**
   * Load and parse a note
   */
  private async loadNote(filePath: string, vaultPath: string): Promise<ObsidianNote> {
    const content = await fs.readFile(filePath, 'utf-8');
    const stats = await fs.stat(filePath);
    const parsed = matter(content);
    
    return {
      path: path.relative(vaultPath, filePath),
      content: parsed.content,
      frontmatter: parsed.data,
      tags: this.extractTags(parsed.content, parsed.data),
      links: this.extractWikilinks(parsed.content),
      embeds: this.extractEmbeds(parsed.content),
      created: stats.birthtime,
      modified: stats.mtime
    };
  }
  
  /**
   * Transform Obsidian content to Mnemosyne format
   */
  private async transformContent(
    content: string,
    options: ImportOptions
  ): Promise<string> {
    let transformed = content;
    
    if (options.convertLinks) {
      // Convert [[wikilinks]] to Mnemosyne links
      transformed = transformed.replace(
        /\[\[([^\]|]+)(\|([^\]]+))?\]\]/g,
        (match, target, _, display) => {
          const linkText = display || target;
          const linkId = this.generateDocumentId('obsidian', target);
          return `[${linkText}](mnemosyne://${linkId})`;
        }
      );
      
      // Convert ![[embeds]]
      transformed = transformed.replace(
        /!\[\[([^\]]+)\]\]/g,
        (match, target) => {
          const embedId = this.generateDocumentId('obsidian', target);
          return `![${target}](mnemosyne://embed/${embedId})`;
        }
      );
    }
    
    // Convert Obsidian callouts to standard format
    transformed = this.transformCallouts(transformed);
    
    // Convert tags
    transformed = this.transformTags(transformed);
    
    return transformed;
  }
  
  /**
   * Extract tags from content and frontmatter
   */
  private extractTags(content: string, frontmatter: any): string[] {
    const tags = new Set<string>();
    
    // From frontmatter
    if (frontmatter.tags) {
      if (Array.isArray(frontmatter.tags)) {
        frontmatter.tags.forEach(tag => tags.add(tag));
      } else if (typeof frontmatter.tags === 'string') {
        frontmatter.tags.split(',').forEach(tag => tags.add(tag.trim()));
      }
    }
    
    // From content
    const tagPattern = /#([a-zA-Z0-9_\-\/]+)/g;
    let match;
    while ((match = tagPattern.exec(content)) !== null) {
      tags.add(match[1]);
    }
    
    return Array.from(tags);
  }
  
  /**
   * Extract wikilinks from content
   */
  private extractWikilinks(content: string): string[] {
    const links: string[] = [];
    const linkPattern = /\[\[([^\]|]+)(\|[^\]]+)?\]\]/g;
    let match;
    
    while ((match = linkPattern.exec(content)) !== null) {
      links.push(match[1]);
    }
    
    return links;
  }
  
  /**
   * Transform Obsidian callouts to standard admonitions
   */
  private transformCallouts(content: string): string {
    const calloutPattern = /^> \[!(\w+)\](.*)$/gm;
    
    return content.replace(calloutPattern, (match, type, title) => {
      const admonitionType = this.mapCalloutType(type);
      return `!!! ${admonitionType} "${title.trim()}"`;
    });
  }
  
  private mapCalloutType(obsidianType: string): string {
    const mapping = {
      'note': 'note',
      'tip': 'tip',
      'warning': 'warning',
      'danger': 'danger',
      'info': 'info',
      'question': 'question',
      'example': 'example',
      'quote': 'quote'
    };
    
    return mapping[obsidianType.toLowerCase()] || 'note';
  }
  
  /**
   * Generate preview of transformation
   */
  private async generatePreviews(notes: ObsidianNote[]): Promise<DocumentPreview[]> {
    const previews: DocumentPreview[] = [];
    
    for (const note of notes) {
      const original = note.content.slice(0, 500);
      const converted = await this.transformContent(original, {
        convertLinks: true,
        preserveStructure: true
      });
      
      previews.push({
        original,
        converted,
        changes: this.detectChanges(original, converted)
      });
    }
    
    return previews;
  }
  
  private detectChanges(original: string, converted: string): string[] {
    const changes: string[] = [];
    
    if (original.includes('[[') && !converted.includes('[[')) {
      changes.push('Converted wikilinks to Mnemosyne links');
    }
    
    if (original.includes('> [!') && converted.includes('!!!')) {
      changes.push('Converted callouts to admonitions');
    }
    
    if (original !== converted) {
      changes.push('Applied format transformations');
    }
    
    return changes;
  }
  
  // Utility methods
  private countLinks(notes: ObsidianNote[]): number {
    return notes.reduce((count, note) => count + note.links.length, 0);
  }
  
  private countTags(notes: ObsidianNote[]): number {
    const uniqueTags = new Set<string>();
    notes.forEach(note => note.tags.forEach(tag => uniqueTags.add(tag)));
    return uniqueTags.size;
  }
  
  private isDailyNote(path: string): boolean {
    return /\d{4}-\d{2}-\d{2}/.test(path);
  }
  
  private isCanvas(path: string): boolean {
    return path.endsWith('.canvas');
  }
  
  private isTemplate(path: string): boolean {
    return path.includes('Templates/') || path.includes('templates/');
  }
  
  private isAttachment(ext: string): boolean {
    const attachmentExts = ['.png', '.jpg', '.jpeg', '.gif', '.pdf', '.mp3', '.mp4'];
    return attachmentExts.includes(ext);
  }
}