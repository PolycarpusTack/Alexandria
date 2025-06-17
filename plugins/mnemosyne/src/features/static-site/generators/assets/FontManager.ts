/**
 * Font Manager
 * Handles font file management and optimization
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { createHash } from 'crypto';

export interface FontInfo {
  source: string;
  destination: string;
  family: string;
  weight?: string;
  style?: string;
  format: string;
  size: number;
  hash: string;
  mimeType: string;
}

export class FontManager {
  private supportedFormats = ['.woff', '.woff2', '.ttf', '.otf', '.eot'];

  /**
   * Copy fonts from source to destination
   */
  async copyFonts(sourceDir: string, destDir: string): Promise<FontInfo[]> {
    const fonts: FontInfo[] = [];

    try {
      const files = await this.findFontFiles(sourceDir);

      for (const file of files) {
        const fontInfo = await this.copyFont(file, sourceDir, destDir);
        if (fontInfo) {
          fonts.push(fontInfo);
        }
      }
    } catch (error) {
      console.error('Error copying fonts:', error);
    }

    return fonts;
  }

  /**
   * Copy a single font file
   */
  private async copyFont(
    fontPath: string,
    sourceDir: string,
    destDir: string
  ): Promise<FontInfo | null> {
    try {
      const relativePath = path.relative(sourceDir, fontPath);
      const destPath = path.join(destDir, relativePath);

      // Ensure destination directory exists
      await fs.mkdir(path.dirname(destPath), { recursive: true });

      // Copy file
      await fs.copyFile(fontPath, destPath);

      // Get file info
      const stats = await fs.stat(destPath);
      const buffer = await fs.readFile(fontPath);
      const hash = createHash('md5').update(buffer).digest('hex');

      // Parse font metadata from filename
      const metadata = this.parseFontMetadata(path.basename(fontPath));

      return {
        source: fontPath,
        destination: destPath,
        family: metadata.family,
        weight: metadata.weight,
        style: metadata.style,
        format: metadata.format,
        size: stats.size,
        hash,
        mimeType: this.getMimeType(metadata.format)
      };
    } catch (error) {
      console.error(`Failed to copy font ${fontPath}:`, error);
      return null;
    }
  }

  /**
   * Find all font files in a directory
   */
  private async findFontFiles(dir: string): Promise<string[]> {
    const fontFiles: string[] = [];

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          const subFiles = await this.findFontFiles(fullPath);
          fontFiles.push(...subFiles);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (this.supportedFormats.includes(ext)) {
            fontFiles.push(fullPath);
          }
        }
      }
    } catch (error) {
      console.error(`Error reading directory ${dir}:`, error);
    }

    return fontFiles;
  }

  /**
   * Parse font metadata from filename
   */
  private parseFontMetadata(filename: string): {
    family: string;
    weight?: string;
    style?: string;
    format: string;
  } {
    const ext = path.extname(filename).toLowerCase();
    const nameWithoutExt = path.basename(filename, ext);

    // Common patterns: FontName-Weight-Style
    const parts = nameWithoutExt.split('-');
    
    let family = parts[0];
    let weight: string | undefined;
    let style: string | undefined;

    // Check for common weight patterns
    const weights = ['thin', 'light', 'regular', 'medium', 'bold', 'black'];
    const foundWeight = parts.find(part => 
      weights.includes(part.toLowerCase()) || /^\d{3}$/.test(part)
    );
    
    if (foundWeight) {
      weight = foundWeight;
    }

    // Check for italic style
    if (parts.some(part => part.toLowerCase() === 'italic')) {
      style = 'italic';
    }

    return {
      family,
      weight,
      style,
      format: ext.substring(1) // Remove the dot
    };
  }

  /**
   * Get MIME type for font format
   */
  private getMimeType(format: string): string {
    const mimeTypes: Record<string, string> = {
      'woff': 'font/woff',
      'woff2': 'font/woff2',
      'ttf': 'font/ttf',
      'otf': 'font/otf',
      'eot': 'application/vnd.ms-fontobject'
    };

    return mimeTypes[format] || 'application/octet-stream';
  }

  /**
   * Generate @font-face CSS declarations
   */
  generateFontFaceCSS(fonts: FontInfo[]): string {
    const fontFaces: string[] = [];

    // Group fonts by family
    const fontFamilies = new Map<string, FontInfo[]>();
    
    for (const font of fonts) {
      const family = font.family;
      if (!fontFamilies.has(family)) {
        fontFamilies.set(family, []);
      }
      fontFamilies.get(family)!.push(font);
    }

    // Generate @font-face for each family/variant
    for (const [family, familyFonts] of fontFamilies) {
      for (const font of familyFonts) {
        const fontFace = this.generateSingleFontFace(font);
        fontFaces.push(fontFace);
      }
    }

    return fontFaces.join('\n\n');
  }

  /**
   * Generate a single @font-face declaration
   */
  private generateSingleFontFace(font: FontInfo): string {
    const relativePath = font.destination.replace(/\\/g, '/');
    const format = this.getFontFormat(font.format);

    let css = '@font-face {\n';
    css += `  font-family: '${font.family}';\n`;
    
    if (font.weight) {
      css += `  font-weight: ${this.normalizeFontWeight(font.weight)};\n`;
    }
    
    if (font.style) {
      css += `  font-style: ${font.style};\n`;
    }
    
    css += `  src: url('${relativePath}') format('${format}');\n`;
    css += '  font-display: swap;\n';
    css += '}';

    return css;
  }

  /**
   * Get font format string for @font-face
   */
  private getFontFormat(ext: string): string {
    const formats: Record<string, string> = {
      'woff': 'woff',
      'woff2': 'woff2',
      'ttf': 'truetype',
      'otf': 'opentype',
      'eot': 'embedded-opentype'
    };

    return formats[ext] || ext;
  }

  /**
   * Normalize font weight values
   */
  private normalizeFontWeight(weight: string): string {
    const weightMap: Record<string, string> = {
      'thin': '100',
      'light': '300',
      'regular': '400',
      'normal': '400',
      'medium': '500',
      'bold': '700',
      'black': '900'
    };

    return weightMap[weight.toLowerCase()] || weight;
  }

  /**
   * Generate font preload links
   */
  generatePreloadLinks(fonts: FontInfo[]): string[] {
    const links: string[] = [];

    // Only preload critical fonts (woff2 format, regular weight)
    const criticalFonts = fonts.filter(font => 
      font.format === 'woff2' && 
      (!font.weight || font.weight === 'regular' || font.weight === '400')
    );

    for (const font of criticalFonts) {
      const relativePath = font.destination.replace(/\\/g, '/');
      links.push(
        `<link rel="preload" href="${relativePath}" as="font" type="${font.mimeType}" crossorigin>`
      );
    }

    return links;
  }
}