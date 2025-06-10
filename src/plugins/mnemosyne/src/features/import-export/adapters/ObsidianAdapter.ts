import * as fs from 'fs/promises';
import * as path from 'path';
import {
  ImportAdapter,
  ImportSource,
  ImportAnalysis,
  ImportOptions,
  ParsedContent,
  ParsedDocument,
  ParsedLink,
  ParsedAttachment,
  ProvenanceNode,
  KnowledgeGraphUpdate,
  DocumentChange,
  ImportStructure,
  FolderNode,
  ImportSample,
  ImportPreview,
  ImportTransformation
} from '../interfaces';
import { MnemosyneDocument } from '../../../interfaces';
import { TemplateContext } from '../../templates/interfaces';
import { v4 as uuidv4 } from 'uuid';
import * as matter from 'gray-matter';

interface ObsidianVault {
  path: string;
  config?: ObsidianConfig;
  plugins?: ObsidianPlugin[];
}

interface ObsidianConfig {
  theme?: string;
  cssTheme?: string;
  attachmentFolderPath?: string;
  defaultViewMode?: string;
  [key: string]: any;
}

interface ObsidianPlugin {
  id: string;
  name: string;
  enabled: boolean;
  settings?: any;
}

interface ObsidianNote {
  path: string;
  content: string;
  frontmatter?: any;
  stats: any;
}

export class ObsidianAdapter implements ImportAdapter {
  sourceType = 'obsidian' as const;
  version = '1.0.0';

  /**
   * Detect if source is a valid Obsidian vault
   */
  async detect(source: ImportSource): Promise<boolean> {
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
    const vault = await this.loadVault(source.path);
    const notes = await this.scanVault(vault);
    
    // Analyze vault structure
    const structure = await this.analyzeStructure(vault.path);
    const samples = await this.generateSamples(notes, 5);
    const transformations = this.identifyTransformations(notes);
    
    // Count various elements
    const linkCount = notes.reduce((sum, note) => {
      const links = this.extractWikilinks(note.content);
      return sum + links.length;
    }, 0);
    
    const tagCount = notes.reduce((sum, note) => {
      const tags = this.extractTags(note);
      return sum + tags.length;
    }, 0);
    
    const attachmentCount = await this.countAttachments(vault.path);
    
    return {
      source,
      documentCount: notes.length,
      linkCount,
      tagCount,
      attachmentCount,
      estimatedSize: await this.calculateVaultSize(vault.path),
      structure,
      sample: samples,
      preview: await this.generatePreviews(samples),
      transformations
    };
  }

  /**
   * Parse Obsidian vault into structured content
   */
  async parse(source: ImportSource): Promise<ParsedContent> {
    const vault = await this.loadVault(source.path);
    const notes = await this.scanVault(vault);
    const documents: ParsedDocument[] = [];
    
    for (const note of notes) {
      const parsed = await this.parseNote(note, vault);
      documents.push(parsed);
    }
    
    const structure = await this.analyzeStructure(vault.path);
    
    return {
      documents,
      structure,
      metadata: {
        vault: vault.config,
        plugins: vault.plugins
      }
    };
  }

  /**
   * Transform parsed content to Mnemosyne documents
   */
  async transform(
    content: ParsedContent,
    options: ImportOptions
  ): Promise<MnemosyneDocument[]> {
    const documents: MnemosyneDocument[] = [];
    
    for (const parsed of content.documents) {
      const doc = await this.transformDocument(parsed, options);
      documents.push(doc);
    }
    
    // Apply folder mapping if specified
    if (options.mapping?.folderMapping) {
      this.applyFolderMapping(documents, options.mapping.folderMapping);
    }
    
    return documents;
  }

  /**
   * Map relationships for knowledge graph
   */
  async mapRelationships(docs: MnemosyneDocument[]): Promise<KnowledgeGraphUpdate> {
    const nodes = docs.map(doc => ({
      id: doc.id,
      type: 'document' as const,
      properties: {
        title: doc.title,
        path: doc.metadata?.obsidian?.originalPath,
        tags: doc.tags
      }
    }));
    
    const edges: any[] = [];
    
    // Create edges from links
    for (const doc of docs) {
      const links = doc.metadata?.parsedLinks || [];
      
      for (const link of links) {
        const targetDoc = this.findDocumentByTitle(docs, link.target);
        if (targetDoc) {
          edges.push({
            source: doc.id,
            target: targetDoc.id,
            type: 'links-to',
            properties: {
              alias: link.alias
            }
          });
        }
      }
    }
    
    // Create folder hierarchy
    const clusters = this.createFolderClusters(docs);
    
    return { nodes, edges, clusters };
  }

  /**
   * Track provenance for imported document
   */
  async trackProvenance(
    doc: MnemosyneDocument,
    source: ImportSource
  ): Promise<ProvenanceNode> {
    return {
      id: uuidv4(),
      type: 'provenance',
      documentId: doc.id,
      source: {
        system: 'obsidian',
        version: this.version,
        importDate: new Date(),
        importer: 'system', // Would be replaced with actual user
        importOptions: {} // Would include actual options
      },
      original: {
        format: 'obsidian-markdown',
        location: doc.metadata?.obsidian?.originalPath || source.path,
        size: Buffer.byteLength(doc.content, 'utf8'),
        metadata: doc.metadata?.obsidian || {},
        checksum: this.calculateChecksum(doc.content)
      },
      transformations: [
        {
          type: 'import',
          description: 'Initial import from Obsidian vault',
          timestamp: new Date(),
          reversible: false
        }
      ],
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Check if adapter supports bidirectional sync
   */
  supportsBidirectionalSync(): boolean {
    return true;
  }

  /**
   * Get changes since last sync
   */
  async getChangesSince?(date: Date): Promise<DocumentChange[]> {
    // Would implement file watching or modification time checking
    return [];
  }

  /**
   * Apply changes back to Obsidian vault
   */
  async applyChanges?(changes: DocumentChange[]): Promise<void> {
    // Would implement writing changes back to vault
  }

  // Private helper methods

  private async loadVault(vaultPath: string): Promise<ObsidianVault> {
    const vault: ObsidianVault = {
      path: vaultPath
    };
    
    // Load Obsidian configuration
    try {
      const configPath = path.join(vaultPath, '.obsidian', 'config');
      const configContent = await fs.readFile(configPath, 'utf-8');
      vault.config = JSON.parse(configContent);
    } catch {
      // Config might not exist
    }
    
    // Load enabled plugins
    try {
      const pluginsPath = path.join(vaultPath, '.obsidian', 'community-plugins.json');
      const pluginsContent = await fs.readFile(pluginsPath, 'utf-8');
      const enabledPlugins = JSON.parse(pluginsContent);
      vault.plugins = enabledPlugins.map((id: string) => ({
        id,
        name: id,
        enabled: true
      }));
    } catch {
      vault.plugins = [];
    }
    
    return vault;
  }

  private async scanVault(vault: ObsidianVault): Promise<ObsidianNote[]> {
    const notes: ObsidianNote[] = [];
    
    async function scan(dir: string): Promise<void> {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          // Skip .obsidian and other hidden folders
          if (!entry.name.startsWith('.')) {
            await scan(fullPath);
          }
        } else if (entry.name.endsWith('.md')) {
          const content = await fs.readFile(fullPath, 'utf-8');
          const stats = await fs.stat(fullPath);
          const parsed = matter(content);
          
          notes.push({
            path: path.relative(vault.path, fullPath),
            content: parsed.content,
            frontmatter: parsed.data,
            stats
          });
        }
      }
    }
    
    await scan(vault.path);
    return notes;
  }

  private async analyzeStructure(vaultPath: string): Promise<ImportStructure> {
    const structure: ImportStructure = {
      folders: [],
      documents: 0,
      maxDepth: 0,
      hasAttachments: false,
      hasTags: false,
      hasMetadata: false
    };
    
    async function analyzeDir(dir: string, depth: number = 0): Promise<FolderNode> {
      const folderNode: FolderNode = {
        name: path.basename(dir),
        path: path.relative(vaultPath, dir),
        documentCount: 0,
        children: []
      };
      
      structure.maxDepth = Math.max(structure.maxDepth, depth);
      
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory() && !entry.name.startsWith('.')) {
          const childNode = await analyzeDir(fullPath, depth + 1);
          folderNode.children.push(childNode);
          folderNode.documentCount += childNode.documentCount;
        } else if (entry.name.endsWith('.md')) {
          folderNode.documentCount++;
          structure.documents++;
        } else if (this.isAttachment(entry.name)) {
          structure.hasAttachments = true;
        }
      }
      
      return folderNode;
    }
    
    const rootNode = await analyzeDir(vaultPath);
    structure.folders = rootNode.children;
    
    return structure;
  }

  private async parseNote(
    note: ObsidianNote,
    vault: ObsidianVault
  ): Promise<ParsedDocument> {
    const links = this.extractWikilinks(note.content);
    const tags = this.extractTags(note);
    const attachments = await this.extractAttachments(note, vault);
    
    return {
      path: note.path,
      title: this.extractTitle(note),
      content: note.content,
      format: 'obsidian-markdown',
      metadata: {
        ...note.frontmatter,
        obsidian: {
          path: note.path,
          created: note.stats.birthtime,
          modified: note.stats.mtime
        }
      },
      links,
      tags,
      attachments
    };
  }

  private async transformDocument(
    parsed: ParsedDocument,
    options: ImportOptions
  ): Promise<MnemosyneDocument> {
    let content = parsed.content;
    
    // Convert wikilinks if requested
    if (options.convertWikilinks) {
      content = this.convertWikilinks(content);
    }
    
    const doc: MnemosyneDocument = {
      id: uuidv4(),
      title: parsed.title,
      content,
      format: 'markdown',
      tags: parsed.tags || [],
      metadata: {
        ...parsed.metadata,
        parsedLinks: parsed.links
      },
      createdAt: parsed.metadata?.obsidian?.created || new Date(),
      updatedAt: parsed.metadata?.obsidian?.modified || new Date(),
      version: 1
    };
    
    return doc;
  }

  private extractWikilinks(content: string): ParsedLink[] {
    const links: ParsedLink[] = [];
    const regex = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
    let match;
    
    while ((match = regex.exec(content)) !== null) {
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
    
    return links;
  }

  private extractTags(note: ObsidianNote): string[] {
    const tags: Set<string> = new Set();
    
    // From frontmatter
    if (note.frontmatter?.tags) {
      const fmTags = Array.isArray(note.frontmatter.tags) 
        ? note.frontmatter.tags 
        : [note.frontmatter.tags];
      fmTags.forEach((tag: string) => tags.add(tag));
    }
    
    // From content
    const hashtagRegex = /#[\w-]+/g;
    const matches = note.content.match(hashtagRegex) || [];
    matches.forEach(tag => tags.add(tag.substring(1)));
    
    return Array.from(tags);
  }

  private extractTitle(note: ObsidianNote): string {
    // From frontmatter
    if (note.frontmatter?.title) {
      return note.frontmatter.title;
    }
    
    // From first heading
    const headingMatch = note.content.match(/^#\s+(.+)$/m);
    if (headingMatch) {
      return headingMatch[1];
    }
    
    // From filename
    return path.basename(note.path, '.md');
  }

  private async extractAttachments(
    note: ObsidianNote,
    vault: ObsidianVault
  ): Promise<ParsedAttachment[]> {
    const attachments: ParsedAttachment[] = [];
    const attachmentRegex = /!\[\[([^\]]+)\]\]/g;
    let match;
    
    while ((match = attachmentRegex.exec(note.content)) !== null) {
      const filename = match[1];
      const attachmentPath = await this.resolveAttachmentPath(
        filename,
        note.path,
        vault
      );
      
      if (attachmentPath) {
        try {
          const stats = await fs.stat(attachmentPath);
          attachments.push({
            path: attachmentPath,
            name: filename,
            mimeType: this.getMimeType(filename),
            size: stats.size
          });
        } catch {
          // Attachment not found
        }
      }
    }
    
    return attachments;
  }

  private async resolveAttachmentPath(
    filename: string,
    notePath: string,
    vault: ObsidianVault
  ): Promise<string | null> {
    // Check various possible locations
    const possiblePaths = [
      // Same folder as note
      path.join(path.dirname(notePath), filename),
      // Configured attachment folder
      vault.config?.attachmentFolderPath 
        ? path.join(vault.path, vault.config.attachmentFolderPath, filename)
        : null,
      // Root attachments folder
      path.join(vault.path, 'attachments', filename),
      // Root of vault
      path.join(vault.path, filename)
    ].filter(Boolean) as string[];
    
    for (const possiblePath of possiblePaths) {
      try {
        await fs.access(possiblePath);
        return possiblePath;
      } catch {
        // Continue to next path
      }
    }
    
    return null;
  }

  private convertWikilinks(content: string): string {
    return content.replace(
      /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,
      (match, target, alias) => {
        const linkId = this.generateLinkId(target);
        const displayText = alias || target;
        return `[${displayText}](mnemosyne://${linkId})`;
      }
    );
  }

  private generateLinkId(target: string): string {
    return target.toLowerCase().replace(/\s+/g, '-');
  }

  private findDocumentByTitle(
    docs: MnemosyneDocument[],
    title: string
  ): MnemosyneDocument | undefined {
    return docs.find(doc => 
      doc.title.toLowerCase() === title.toLowerCase()
    );
  }

  private createFolderClusters(docs: MnemosyneDocument[]): any[] {
    const clusters: Map<string, string[]> = new Map();
    
    for (const doc of docs) {
      const folderPath = path.dirname(doc.metadata?.obsidian?.originalPath || '');
      if (folderPath && folderPath !== '.') {
        if (!clusters.has(folderPath)) {
          clusters.set(folderPath, []);
        }
        clusters.get(folderPath)!.push(doc.id);
      }
    }
    
    return Array.from(clusters.entries()).map(([folder, nodeIds]) => ({
      id: folder.replace(/\//g, '-'),
      name: folder,
      nodeIds
    }));
  }

  private calculateChecksum(content: string): string {
    // Simple checksum implementation
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  private isAttachment(filename: string): boolean {
    const extensions = [
      '.png', '.jpg', '.jpeg', '.gif', '.svg',
      '.pdf', '.mp3', '.mp4', '.mov',
      '.zip', '.tar', '.gz'
    ];
    return extensions.some(ext => filename.toLowerCase().endsWith(ext));
  }

  private async calculateVaultSize(vaultPath: string): Promise<number> {
    let totalSize = 0;
    
    async function calculateDir(dir: string): Promise<void> {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory() && !entry.name.startsWith('.')) {
          await calculateDir(fullPath);
        } else if (entry.isFile()) {
          const stats = await fs.stat(fullPath);
          totalSize += stats.size;
        }
      }
    }
    
    await calculateDir(vaultPath);
    return totalSize;
  }

  private async countAttachments(vaultPath: string): Promise<number> {
    let count = 0;
    
    async function countInDir(dir: string): Promise<void> {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory() && !entry.name.startsWith('.')) {
          await countInDir(fullPath);
        } else if (entry.isFile() && this.isAttachment(entry.name)) {
          count++;
        }
      }
    }
    
    await countInDir(vaultPath);
    return count;
  }

  private async generateSamples(
    notes: ObsidianNote[],
    count: number
  ): Promise<ImportSample[]> {
    const samples: ImportSample[] = [];
    const sampleNotes = notes.slice(0, count);
    
    for (const note of sampleNotes) {
      samples.push({
        path: note.path,
        title: this.extractTitle(note),
        content: note.content.substring(0, 500) + '...',
        metadata: note.frontmatter
      });
    }
    
    return samples;
  }

  private async generatePreviews(samples: ImportSample[]): Promise<ImportPreview[]> {
    // Generate preview of how documents will look after import
    return [];
  }

  private identifyTransformations(notes: ObsidianNote[]): ImportTransformation[] {
    const transformations: ImportTransformation[] = [];
    let wikiLinkCount = 0;
    let tagCount = 0;
    let metadataCount = 0;
    
    for (const note of notes) {
      const links = this.extractWikilinks(note.content);
      wikiLinkCount += links.length;
      
      const tags = this.extractTags(note);
      tagCount += tags.length;
      
      if (note.frontmatter && Object.keys(note.frontmatter).length > 0) {
        metadataCount++;
      }
    }
    
    if (wikiLinkCount > 0) {
      transformations.push({
        type: 'wikilink',
        description: 'Convert Obsidian wikilinks to Mnemosyne format',
        count: wikiLinkCount,
        examples: ['[[Note]]', '[[Note|Alias]]']
      });
    }
    
    if (tagCount > 0) {
      transformations.push({
        type: 'tag',
        description: 'Import tags from content and frontmatter',
        count: tagCount,
        examples: ['#tag', 'tags: [tag1, tag2]']
      });
    }
    
    if (metadataCount > 0) {
      transformations.push({
        type: 'metadata',
        description: 'Preserve frontmatter metadata',
        count: metadataCount,
        examples: ['title:', 'date:', 'author:']
      });
    }
    
    return transformations;
  }

  private applyFolderMapping(
    documents: MnemosyneDocument[],
    mapping: Record<string, string>
  ): void {
    for (const doc of documents) {
      const originalPath = doc.metadata?.obsidian?.originalPath;
      if (originalPath) {
        const folder = path.dirname(originalPath);
        const mappedFolder = mapping[folder];
        if (mappedFolder) {
          doc.metadata.folder = mappedFolder;
          doc.tags.push(`folder:${mappedFolder}`);
        }
      }
    }
  }

  private getMimeType(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.pdf': 'application/pdf',
      '.mp3': 'audio/mpeg',
      '.mp4': 'video/mp4',
      '.mov': 'video/quicktime',
      '.zip': 'application/zip'
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }
}