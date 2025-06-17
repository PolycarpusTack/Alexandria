/**
 * Image Processor
 * Handles image optimization and format conversion
 */

import sharp from 'sharp';
import * as fs from 'fs/promises';
import * as path from 'path';
import { ImageProcessingOptions, AssetMetadata } from './types';
import { createHash } from 'crypto';

export class ImageProcessor {
  private supportedFormats = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg'];

  /**
   * Process images in a directory
   */
  async processImages(
    sourceDir: string,
    outputDir: string,
    options: ImageProcessingOptions
  ): Promise<Array<{
    source: string;
    outputs: Array<{
      path: string;
      format: string;
      size: number;
      width?: number;
      height?: number;
    }>;
  }>> {
    const results = [];
    const imageFiles = await this.findImageFiles(sourceDir);

    for (const imagePath of imageFiles) {
      const outputs = await this.processImage(imagePath, outputDir, options);
      results.push({
        source: imagePath,
        outputs
      });
    }

    return results;
  }

  /**
   * Process a single image
   */
  async processImage(
    imagePath: string,
    outputDir: string,
    options: ImageProcessingOptions
  ): Promise<Array<{
    path: string;
    format: string;
    size: number;
    width?: number;
    height?: number;
  }>> {
    const outputs = [];
    const ext = path.extname(imagePath).toLowerCase();
    const basename = path.basename(imagePath, ext);

    // Skip SVG files from sharp processing
    if (ext === '.svg') {
      const outputPath = path.join(outputDir, path.basename(imagePath));
      await fs.copyFile(imagePath, outputPath);
      const stats = await fs.stat(outputPath);
      outputs.push({
        path: outputPath,
        format: 'svg',
        size: stats.size
      });
      return outputs;
    }

    try {
      const image = sharp(imagePath);
      const metadata = await image.metadata();

      // Process each requested format
      for (const format of options.formats) {
        const outputPath = await this.processFormat(
          image,
          basename,
          outputDir,
          format,
          options,
          metadata
        );

        if (outputPath) {
          const stats = await fs.stat(outputPath);
          outputs.push({
            path: outputPath,
            format,
            size: stats.size,
            width: metadata.width,
            height: metadata.height
          });
        }
      }

      // Generate thumbnails if requested
      if (options.generateThumbnails && options.thumbnailSizes) {
        for (const size of options.thumbnailSizes) {
          const thumbOutputs = await this.generateThumbnail(
            imagePath,
            basename,
            outputDir,
            size,
            options
          );
          outputs.push(...thumbOutputs);
        }
      }

    } catch (error) {
      console.error(`Failed to process image ${imagePath}:`, error);
    }

    return outputs;
  }

  /**
   * Process image to a specific format
   */
  private async processFormat(
    image: sharp.Sharp,
    basename: string,
    outputDir: string,
    format: string,
    options: ImageProcessingOptions,
    metadata: sharp.Metadata
  ): Promise<string | null> {
    try {
      let processing = image.clone();

      // Apply size constraints
      if (options.maxWidth || options.maxHeight) {
        processing = processing.resize(options.maxWidth, options.maxHeight, {
          fit: 'inside',
          withoutEnlargement: true
        });
      }

      // Apply format-specific settings
      switch (format) {
        case 'jpeg':
        case 'jpg':
          processing = processing.jpeg({
            quality: options.quality,
            progressive: true
          });
          break;
        case 'png':
          processing = processing.png({
            quality: options.quality,
            progressive: true,
            compressionLevel: 9
          });
          break;
        case 'webp':
          processing = processing.webp({
            quality: options.quality,
            lossless: options.quality === 100
          });
          break;
        case 'avif':
          processing = processing.avif({
            quality: options.quality,
            lossless: options.quality === 100
          });
          break;
      }

      const outputPath = path.join(outputDir, `${basename}.${format}`);
      await processing.toFile(outputPath);

      return outputPath;
    } catch (error) {
      console.error(`Failed to convert to ${format}:`, error);
      return null;
    }
  }

  /**
   * Generate thumbnail versions
   */
  private async generateThumbnail(
    imagePath: string,
    basename: string,
    outputDir: string,
    size: number,
    options: ImageProcessingOptions
  ): Promise<Array<{
    path: string;
    format: string;
    size: number;
    width: number;
    height: number;
  }>> {
    const outputs = [];

    try {
      const image = sharp(imagePath);
      
      for (const format of options.formats) {
        let processing = image.clone()
          .resize(size, size, {
            fit: 'cover',
            position: 'center'
          });

        // Apply format settings
        if (format === 'jpeg' || format === 'jpg') {
          processing = processing.jpeg({ quality: options.quality });
        } else if (format === 'webp') {
          processing = processing.webp({ quality: options.quality });
        }

        const outputPath = path.join(
          outputDir,
          `${basename}-${size}x${size}.${format}`
        );
        
        await processing.toFile(outputPath);
        const stats = await fs.stat(outputPath);

        outputs.push({
          path: outputPath,
          format,
          size: stats.size,
          width: size,
          height: size
        });
      }
    } catch (error) {
      console.error(`Failed to generate thumbnail:`, error);
    }

    return outputs;
  }

  /**
   * Find all image files in a directory
   */
  private async findImageFiles(dir: string): Promise<string[]> {
    const imageFiles: string[] = [];

    async function scan(currentDir: string) {
      const entries = await fs.readdir(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);

        if (entry.isDirectory()) {
          await scan(fullPath);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (this.supportedFormats.includes(ext)) {
            imageFiles.push(fullPath);
          }
        }
      }
    }

    await scan(dir);
    return imageFiles;
  }

  /**
   * Generate responsive image HTML
   */
  generateResponsiveImageHTML(
    basename: string,
    formats: string[],
    sizes: number[],
    alt: string
  ): string {
    const sources = formats
      .filter(format => format !== 'jpg' && format !== 'jpeg')
      .map(format => {
        const srcset = sizes
          .map(size => `${basename}-${size}x${size}.${format} ${size}w`)
          .join(', ');
        
        return `<source type="image/${format}" srcset="${srcset}">`;
      })
      .join('\n  ');

    const imgSrcset = sizes
      .map(size => `${basename}-${size}x${size}.jpg ${size}w`)
      .join(', ');

    return `<picture>
  ${sources}
  <img 
    src="${basename}.jpg" 
    srcset="${imgSrcset}"
    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
    alt="${alt}"
    loading="lazy"
  >
</picture>`;
  }

  /**
   * Generate image metadata
   */
  async generateMetadata(imagePath: string): Promise<AssetMetadata> {
    const stats = await fs.stat(imagePath);
    const buffer = await fs.readFile(imagePath);
    const hash = createHash('md5').update(buffer).digest('hex');

    let mimeType = 'image/unknown';
    const ext = path.extname(imagePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml'
    };
    
    if (ext in mimeTypes) {
      mimeType = mimeTypes[ext];
    }

    return {
      originalPath: imagePath,
      processedAt: new Date(),
      size: stats.size,
      hash,
      mimeType
    };
  }

  /**
   * Optimize SVG content
   */
  async optimizeSVG(svgContent: string): Promise<string> {
    // Remove comments
    let optimized = svgContent.replace(/<!--[\s\S]*?-->/g, '');
    
    // Remove unnecessary whitespace
    optimized = optimized.replace(/\s+/g, ' ');
    optimized = optimized.replace(/>\s+</g, '><');
    
    // Remove empty attributes
    optimized = optimized.replace(/\s*[a-zA-Z-]+=""\s*/g, ' ');
    
    return optimized.trim();
  }
}