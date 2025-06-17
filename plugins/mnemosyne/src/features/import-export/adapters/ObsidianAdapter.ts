import { 
  ImportAdapter, 
  ImportAnalysis, 
  ParsedContent,
  RawDocument,
  RawRelationship,
  RawAttachment,
  DocumentPreview,
  ImportWarning,
  FolderStructure,
  LinkGraph,
  TransformationPreview
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
  
  // Additional missing methods
  
  private async scanDirectory(
    dirPath: string, 
    callback: (filePath: string) => Promise<void>
  ): Promise<void> {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        await this.scanDirectory(fullPath, callback);
      } else if (entry.isFile()) {
        await callback(fullPath);
      }
    }
  }
  
  private async loadVaultConfig(vaultPath: string): Promise<ObsidianConfig> {
    try {
      const configPath = path.join(vaultPath, '.obsidian', 'app.json');
      const configContent = await fs.readFile(configPath, 'utf-8');
      return JSON.parse(configContent);
    } catch {
      return {}; // Return empty config if not found
    }
  }
  
  private parseNote(note: ObsidianNote): { 
    document: RawDocument; 
    relationships: RawRelationship[] 
  } {
    const document: RawDocument = {
      id: this.generateDocumentId('obsidian', note.path),
      path: note.path,
      title: this.extractTitle(note),
      content: note.content,
      frontmatter: note.frontmatter,
      tags: note.tags,
      created: note.created,
      modified: note.modified,
      metadata: {
        links: note.links,
        embeds: note.embeds
      }
    };
    
    const relationships: RawRelationship[] = note.links.map(link => ({
      source: note.path,
      target: link,
      type: 'links-to',
      metadata: { linkType: 'wikilink' }
    }));
    
    return { document, relationships };
  }
  
  private async parseAttachment(
    attachment: ObsidianAttachment
  ): Promise<RawAttachment> {
    return {
      id: this.generateDocumentId('obsidian', attachment.path),
      path: attachment.path,
      name: path.basename(attachment.path),
      type: attachment.type,
      size: attachment.size
    };
  }
  
  private async loadAttachment(
    filePath: string,
    vaultPath: string
  ): Promise<ObsidianAttachment> {
    const stats = await fs.stat(filePath);
    return {
      path: path.relative(vaultPath, filePath),
      type: path.extname(filePath),
      size: stats.size
    };
  }
  
  private async analyzeFolderStructure(
    vaultPath: string
  ): Promise<FolderStructure[]> {
    const structure: FolderStructure[] = [];
    
    const analyze = async (dirPath: string): Promise<FolderStructure> => {
      const name = path.basename(dirPath);
      const folder: FolderStructure = {
        path: path.relative(vaultPath, dirPath),
        name,
        children: [],
        documentCount: 0
      };
      
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        if (entry.isDirectory() && !entry.name.startsWith('.')) {
          const child = await analyze(fullPath);
          folder.children.push(child);
          folder.documentCount += child.documentCount;
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
          folder.documentCount++;
        }
      }
      
      return folder;
    };
    
    const rootEntries = await fs.readdir(vaultPath, { withFileTypes: true });
    for (const entry of rootEntries) {
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        const folderStructure = await analyze(path.join(vaultPath, entry.name));
        structure.push(folderStructure);
      }
    }
    
    return structure;
  }
  
  private extractAllTags(notes: ObsidianNote[]): string[] {
    const allTags = new Set<string>();
    notes.forEach(note => {
      note.tags.forEach(tag => allTags.add(tag));
    });
    return Array.from(allTags).sort();
  }
  
  private buildLinkGraph(notes: ObsidianNote[]): LinkGraph {
    const nodes: string[] = notes.map(n => n.path);
    const edges: Array<{ source: string; target: string; count: number }> = [];
    const edgeMap = new Map<string, number>();
    
    notes.forEach(note => {
      note.links.forEach(link => {
        const key = `${note.path}::${link}`;
        const count = (edgeMap.get(key) || 0) + 1;
        edgeMap.set(key, count);
      });
    });
    
    edgeMap.forEach((count, key) => {
      const [source, target] = key.split('::');
      edges.push({ source, target, count });
    });
    
    return { nodes, edges };
  }
  
  private getTransformationPreviews(): TransformationPreview[] {
    return [
      {
        type: 'wikilinks',
        description: 'Convert Obsidian [[wikilinks]] to Mnemosyne links',
        example: {
          before: '[[My Note|Display Text]]',
          after: '[Display Text](mnemosyne://obsidian-my-note-1234567890)'
        }
      },
      {
        type: 'embeds',
        description: 'Convert Obsidian embeds to Mnemosyne embeds',
        example: {
          before: '![[image.png]]',
          after: '![image.png](mnemosyne://embed/obsidian-image-png-1234567890)'
        }
      },
      {
        type: 'callouts',
        description: 'Convert Obsidian callouts to admonitions',
        example: {
          before: '> [!note] Title',
          after: '!!! note "Title"'
        }
      }
    ];
  }
  
  private async detectWarnings(vault: ObsidianVault): Promise<ImportWarning[]> {
    const warnings: ImportWarning[] = [];
    
    // Check for broken links
    const allPaths = new Set(vault.notes.map(n => n.path));
    const brokenLinks: string[] = [];
    
    vault.notes.forEach(note => {
      note.links.forEach(link => {
        if (!allPaths.has(link) && !allPaths.has(link + '.md')) {
          brokenLinks.push(`${note.path} → ${link}`);
        }
      });
    });
    
    if (brokenLinks.length > 0) {
      warnings.push({
        type: 'broken-link',
        message: `Found ${brokenLinks.length} broken internal links`,
        affected: brokenLinks.slice(0, 10), // Show first 10
        severity: 'medium'
      });
    }
    
    // Check for missing attachments
    const attachmentPaths = new Set(vault.attachments.map(a => a.path));
    const missingAttachments: string[] = [];
    
    vault.notes.forEach(note => {
      note.embeds.forEach(embed => {
        if (!attachmentPaths.has(embed)) {
          missingAttachments.push(`${note.path} → ${embed}`);
        }
      });
    });
    
    if (missingAttachments.length > 0) {
      warnings.push({
        type: 'missing-attachment',
        message: `Found ${missingAttachments.length} missing attachments`,
        affected: missingAttachments.slice(0, 10),
        severity: 'high'
      });
    }
    
    return warnings;
  }
  
  private estimateImportDuration(vault: ObsidianVault): number {
    // Estimate based on content size and complexity
    const baseTimePerNote = 50; // ms
    const timePerLink = 10; // ms
    const timePerAttachment = 100; // ms
    
    const noteTime = vault.notes.length * baseTimePerNote;
    const linkTime = vault.notes.reduce((sum, n) => sum + n.links.length, 0) * timePerLink;
    const attachmentTime = vault.attachments.length * timePerAttachment;
    
    return noteTime + linkTime + attachmentTime;
  }
  
  private extractTitle(note: ObsidianNote): string {
    // Try frontmatter title first
    if (note.frontmatter?.title) {
      return note.frontmatter.title;
    }
    
    // Try first heading
    const headingMatch = note.content.match(/^#\s+(.+)$/m);
    if (headingMatch) {
      return headingMatch[1];
    }
    
    // Use filename without extension
    return path.basename(note.path, '.md');
  }
  
  private extractEmbeds(content: string): string[] {
    const embeds: string[] = [];
    const embedPattern = /!\[\[([^\]]+)\]\]/g;
    let match;
    
    while ((match = embedPattern.exec(content)) !== null) {
      embeds.push(match[1]);
    }
    
    return embeds;
  }
  
  private transformTags(content: string): string {
    // Ensure tags have proper formatting
    return content.replace(/#([a-zA-Z0-9_\-\/]+)/g, (match, tag) => {
      // Normalize tag format
      return `#${tag.toLowerCase().replace(/\s+/g, '-')}`;
    });
  }
  
  private extractLinks(content: string): string[] {
    const links: string[] = [];
    
    // Extract wikilinks
    const wikilinkPattern = /\[\[([^\]|]+)(\|[^\]]+)?\]\]/g;
    let match;
    while ((match = wikilinkPattern.exec(content)) !== null) {
      links.push(match[1]);
    }
    
    // Extract markdown links
    const mdLinkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
    while ((match = mdLinkPattern.exec(content)) !== null) {
      if (!match[2].startsWith('http')) {
        links.push(match[2]);
      }
    }
    
    return links;
  }
}