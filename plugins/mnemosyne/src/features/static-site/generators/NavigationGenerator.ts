/**
 * Navigation Generator - Generates site navigation structure
 */

import { 
  SiteStructure,
  NavigationItem,
  StaticSiteOptions,
  PageInfo
} from '../core/types';
import * as path from 'path';

export class NavigationGenerator {
  /**
   * Generate navigation structure from site structure
   */
  async generateNavigation(
    siteStructure: SiteStructure,
    options: StaticSiteOptions
  ): Promise<NavigationItem[]> {
    const navigation: NavigationItem[] = [];
    
    // Add home link
    navigation.push({
      title: 'Home',
      path: '/',
      icon: 'home',
      order: 0
    });
    
    // Build navigation from page hierarchy
    const rootPages = this.getRootPages(siteStructure);
    
    for (const page of rootPages) {
      const navItem = await this.buildNavigationItem(page, siteStructure);
      if (navItem) {
        navigation.push(navItem);
      }
    }
    
    // Add special sections
    if (options.generateSearch) {
      navigation.push({
        title: 'Search',
        path: '/search.html',
        icon: 'search',
        order: 90
      });
    }
    
    if (options.groupByTags) {
      navigation.push({
        title: 'Tags',
        path: '/tags/',
        icon: 'tag',
        order: 91,
        children: this.buildTagNavigation(siteStructure)
      });
    }
    
    // Sort by order
    navigation.sort((a, b) => (a.order || 100) - (b.order || 100));
    
    return navigation;
  }

  /**
   * Get root-level pages
   */
  private getRootPages(siteStructure: SiteStructure): PageInfo[] {
    return Array.from(siteStructure.pages.values())
      .filter(page => page.level === 0 || page.level === 1)
      .sort((a, b) => {
        // Sort by path to maintain consistent order
        return a.path.localeCompare(b.path);
      });
  }

  /**
   * Build navigation item recursively
   */
  private async buildNavigationItem(
    page: PageInfo,
    siteStructure: SiteStructure
  ): Promise<NavigationItem | null> {
    // Skip certain pages from navigation
    if (this.shouldSkipPage(page)) {
      return null;
    }
    
    const children = await this.getChildPages(page, siteStructure);
    
    const navItem: NavigationItem = {
      title: page.title,
      path: page.path,
      order: this.getPageOrder(page)
    };
    
    if (children.length > 0) {
      navItem.children = [];
      for (const child of children) {
        const childNav = await this.buildNavigationItem(child, siteStructure);
        if (childNav) {
          navItem.children.push(childNav);
        }
      }
    }
    
    return navItem;
  }

  /**
   * Get child pages for a given page
   */
  private async getChildPages(
    parentPage: PageInfo,
    siteStructure: SiteStructure
  ): Promise<PageInfo[]> {
    const parentDir = path.dirname(parentPage.path);
    
    return Array.from(siteStructure.pages.values())
      .filter(page => {
        const pageDir = path.dirname(page.path);
        // Check if page is a direct child
        return pageDir.startsWith(parentDir) && 
               page.level === parentPage.level + 1 &&
               page.id !== parentPage.id;
      })
      .sort((a, b) => a.title.localeCompare(b.title));
  }

  /**
   * Build tag navigation
   */
  private buildTagNavigation(siteStructure: SiteStructure): NavigationItem[] {
    const tagNav: NavigationItem[] = [];
    
    // Get tags sorted by count
    const tagCounts = new Map<string, number>();
    for (const [tag, pageIds] of siteStructure.tagHierarchy) {
      tagCounts.set(tag, pageIds.length);
    }
    
    const sortedTags = Array.from(tagCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20); // Top 20 tags
    
    for (const [tag, count] of sortedTags) {
      tagNav.push({
        title: `${tag} (${count})`,
        path: `/tags/${this.slugify(tag)}.html`
      });
    }
    
    return tagNav;
  }

  /**
   * Check if page should be skipped from navigation
   */
  private shouldSkipPage(page: PageInfo): boolean {
    // Skip index pages (they're represented by their parent)
    if (page.path.endsWith('/index.html')) {
      return true;
    }
    
    // Skip special pages
    const specialPages = ['404.html', 'search.html', 'sitemap.xml'];
    if (specialPages.includes(path.basename(page.path))) {
      return true;
    }
    
    // Skip drafts or hidden pages
    if (page.tags.includes('draft') || page.tags.includes('hidden')) {
      return true;
    }
    
    return false;
  }

  /**
   * Get page order for navigation
   */
  private getPageOrder(page: PageInfo): number {
    // Check for explicit order in metadata
    const metadata = (page as any).metadata;
    if (metadata?.order !== undefined) {
      return metadata.order;
    }
    
    // Default ordering by title
    const orderMap: Record<string, number> = {
      'overview': 10,
      'introduction': 11,
      'getting-started': 12,
      'guide': 20,
      'tutorial': 21,
      'documentation': 30,
      'api': 40,
      'reference': 41,
      'examples': 50,
      'about': 80,
      'contact': 81
    };
    
    const lowerTitle = page.title.toLowerCase();
    for (const [key, order] of Object.entries(orderMap)) {
      if (lowerTitle.includes(key)) {
        return order;
      }
    }
    
    return 100; // Default order
  }

  /**
   * Convert string to URL-friendly slug
   */
  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }
}