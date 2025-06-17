/**
 * PDF Renderer - Handles the actual PDF generation using Puppeteer
 */

import * as puppeteer from 'puppeteer';
import { WatermarkOptions } from '../core/types';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

export interface PDFRenderOptions {
  format?: puppeteer.PaperFormat;
  printBackground?: boolean;
  displayHeaderFooter?: boolean;
  headerTemplate?: string;
  footerTemplate?: string;
  margin?: {
    top?: string;
    right?: string;
    bottom?: string;
    left?: string;
  };
  scale?: number;
  landscape?: boolean;
  preferCSSPageSize?: boolean;
  pageRanges?: string;
}

export class PDFRenderer {
  private browser?: puppeteer.Browser;
  private browserPromise?: Promise<puppeteer.Browser>;
  
  /**
   * Render HTML to PDF
   */
  async render(html: string, options: PDFRenderOptions): Promise<Buffer> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    
    try {
      // Set content
      await page.setContent(html, {
        waitUntil: ['networkidle0', 'domcontentloaded']
      });
      
      // Wait for any async content to load
      await page.evaluateHandle('document.fonts.ready');
      
      // Apply print media styles
      await page.emulateMediaType('print');
      
      // Generate PDF
      const pdfBuffer = await page.pdf({
        format: options.format || 'A4',
        printBackground: options.printBackground !== false,
        displayHeaderFooter: options.displayHeaderFooter || false,
        headerTemplate: options.headerTemplate || this.getDefaultHeaderTemplate(),
        footerTemplate: options.footerTemplate || this.getDefaultFooterTemplate(),
        margin: options.margin || {
          top: '1in',
          right: '1in',
          bottom: '1in',
          left: '1in'
        },
        scale: options.scale || 1,
        landscape: options.landscape || false,
        preferCSSPageSize: options.preferCSSPageSize !== false,
        pageRanges: options.pageRanges
      });
      
      return pdfBuffer;
      
    } finally {
      await page.close();
    }
  }
  
  /**
   * Apply watermark to PDF
   */
  async applyWatermark(
    pdfBuffer: Buffer,
    watermark: WatermarkOptions
  ): Promise<Buffer> {
    // For now, we'll add watermark via CSS in the HTML
    // In a production system, you might use a PDF manipulation library
    // like pdf-lib or HummusJS for post-processing
    
    // This is a placeholder implementation
    // Real implementation would modify the PDF directly
    return pdfBuffer;
  }
  
  /**
   * Get or create browser instance
   */
  private async getBrowser(): Promise<puppeteer.Browser> {
    if (this.browser && this.browser.isConnected()) {
      return this.browser;
    }
    
    // If a browser is being launched, wait for it
    if (this.browserPromise) {
      return this.browserPromise;
    }
    
    // Launch new browser
    this.browserPromise = this.launchBrowser();
    this.browser = await this.browserPromise;
    this.browserPromise = undefined;
    
    return this.browser;
  }
  
  /**
   * Launch Puppeteer browser
   */
  private async launchBrowser(): Promise<puppeteer.Browser> {
    const args = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu'
    ];
    
    return await puppeteer.launch({
      headless: true,
      args,
      // Use system Chrome if available
      executablePath: await this.getChromePath()
    });
  }
  
  /**
   * Get Chrome executable path
   */
  private async getChromePath(): Promise<string | undefined> {
    // Try to find system Chrome
    const platform = os.platform();
    
    const paths: Record<string, string[]> = {
      darwin: [
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Chromium.app/Contents/MacOS/Chromium'
      ],
      linux: [
        '/usr/bin/google-chrome',
        '/usr/bin/chromium-browser',
        '/usr/bin/chromium'
      ],
      win32: [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
      ]
    };
    
    const platformPaths = paths[platform] || [];
    
    for (const chromePath of platformPaths) {
      try {
        await fs.access(chromePath);
        return chromePath;
      } catch {
        // Path doesn't exist, try next
      }
    }
    
    // Use Puppeteer's bundled Chromium
    return undefined;
  }
  
  /**
   * Get default header template
   */
  private getDefaultHeaderTemplate(): string {
    return `
      <div style="font-size: 10px; width: 100%; text-align: center;">
        <span class="title"></span>
      </div>
    `;
  }
  
  /**
   * Get default footer template
   */
  private getDefaultFooterTemplate(): string {
    return `
      <div style="font-size: 10px; width: 100%; display: flex; justify-content: space-between; padding: 0 20px;">
        <span class="date"></span>
        <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
      </div>
    `;
  }
  
  /**
   * Close browser instance
   */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = undefined;
    }
  }
}