// SharedRepository service for Apicarus
// Integrates with Mnemosyne for shared knowledge management

export class SharedRepository {
  constructor(plugin) {
    this.plugin = plugin;
    this.mnemosyneIntegration = null;
    this.currentUser = null;
  }
  
  async init() {
    try {
      // Check if Mnemosyne is available
      const mnemosyne = global.Alexandria?.plugins?.get('mnemosyne');
      if (mnemosyne) {
        this.mnemosyneIntegration = mnemosyne;
        this.plugin.logger?.info('Mnemosyne integration enabled for shared repositories');
      } else {
        this.plugin.logger?.warn('Mnemosyne not available - shared repositories limited to local storage');
      }
      
      // Get current user context
      this.currentUser = await this.plugin.context?.userService?.getCurrentUser();
    } catch (error) {
      this.plugin.logger?.error('Failed to initialize SharedRepository:', error);
    }
  }
  
  // Create a shared collection in the repository
  async createSharedCollection(collection, options = {}) {
    const {
      visibility = 'private', // 'public', 'private', 'team'
      teamIds = [],
      description = '',
      tags = [],
      category = 'api-testing'
    } = options;
    
    // Add sharing metadata
    const sharedCollection = {
      ...collection,
      sharing: {
        visibility,
        owner: this.currentUser?.id || 'anonymous',
        teamIds,
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1
      },
      metadata: {
        plugin: 'apicarus',
        type: 'rest-collection',
        description,
        tags,
        category,
        stats: {
          requestCount: collection.requests?.length || 0,
          lastUsed: null,
          usageCount: 0,
          rating: 0,
          reviews: []
        }
      }
    };
    
    if (this.mnemosyneIntegration) {
      // Create as Mnemosyne document
      const document = await this.createMnemosyneDocument(sharedCollection);
      return document;
    } else {
      // Fallback to local storage with sharing metadata
      return await this.saveToLocalRepository(sharedCollection);
    }
  }
  
  // Create a Mnemosyne document from collection
  async createMnemosyneDocument(collection) {
    const document = {
      title: `API Collection: ${collection.name}`,
      content: JSON.stringify(collection, null, 2),
      contentType: 'plain',
      tags: [...(collection.metadata.tags || []), 'apicarus', 'rest-api', 'collection'],
      category: collection.metadata.category,
      description: collection.metadata.description,
      author: this.currentUser?.id || 'anonymous',
      permissions: this.buildPermissions(collection.sharing),
      metadata: {
        ...collection.metadata,
        sourcePlugin: 'apicarus',
        collectionId: collection.id
      }
    };
    
    try {
      const createdDoc = await this.mnemosyneIntegration.documentService.create(document);
      
      // Create knowledge graph relationships
      await this.createKnowledgeGraphRelationships(createdDoc, collection);
      
      return {
        ...collection,
        mnemosyneId: createdDoc.id,
        shareLink: createdDoc.permissions.shareLink
      };
    } catch (error) {
      this.plugin.logger?.error('Failed to create Mnemosyne document:', error);
      throw error;
    }
  }
  
  // Build permissions object based on sharing settings
  buildPermissions(sharing) {
    const permissions = {
      owner: sharing.owner,
      readers: [],
      writers: [],
      admins: [sharing.owner],
      public: sharing.visibility === 'public'
    };
    
    if (sharing.visibility === 'team') {
      permissions.readers = [...sharing.teamIds];
      permissions.writers = [...sharing.teamIds];
    }
    
    // Generate share link for public or team collections
    if (sharing.visibility !== 'private') {
      permissions.shareLink = this.generateShareLink();
    }
    
    return permissions;
  }
  
  // Create knowledge graph relationships for better discovery
  async createKnowledgeGraphRelationships(document, collection) {
    if (!this.mnemosyneIntegration?.knowledgeGraphService) return;
    
    try {
      // Create nodes for each request in the collection
      for (const request of collection.requests || []) {
        const requestNode = {
          type: 'api-endpoint',
          title: `${request.method} ${request.name}`,
          content: JSON.stringify(request),
          tags: ['api-request', request.method.toLowerCase()],
          metadata: {
            method: request.method,
            url: request.url,
            collectionId: collection.id
          }
        };
        
        const node = await this.mnemosyneIntegration.knowledgeGraphService.createNode(requestNode);
        
        // Create relationship between collection document and request node
        await this.mnemosyneIntegration.knowledgeGraphService.createRelationship({
          sourceId: document.id,
          targetId: node.id,
          type: 'contains',
          strength: 1.0,
          bidirectional: false,
          description: 'Collection contains request'
        });
      }
      
      // Create relationships to related concepts
      const apiDomain = this.extractAPIDomain(collection);
      if (apiDomain) {
        await this.createDomainRelationship(document.id, apiDomain);
      }
    } catch (error) {
      this.plugin.logger?.error('Failed to create knowledge graph relationships:', error);
    }
  }
  
  // Search shared repositories
  async searchSharedCollections(query, filters = {}) {
    const {
      visibility = 'all', // 'all', 'public', 'private', 'team'
      tags = [],
      category = null,
      author = null,
      sortBy = 'relevance', // 'relevance', 'rating', 'usage', 'date'
      limit = 50
    } = filters;
    
    if (this.mnemosyneIntegration) {
      // Use Mnemosyne's advanced search
      const searchQuery = {
        query,
        filters: {
          contentType: 'plain',
          tags: ['apicarus', ...tags],
          category: category || 'api-testing',
          author,
          metadata: {
            sourcePlugin: 'apicarus'
          }
        },
        options: {
          limit,
          includeAnalytics: true,
          includeRelationships: true
        }
      };
      
      if (visibility !== 'all') {
        searchQuery.filters.permissions = {
          visibility: visibility === 'public' ? { public: true } : { public: false }
        };
      }
      
      const results = await this.mnemosyneIntegration.searchService.search(searchQuery);
      
      // Transform results back to collections
      return results.map(doc => this.documentToCollection(doc));
    } else {
      // Fallback to local search
      return await this.searchLocalRepository(query, filters);
    }
  }
  
  // Get trending/popular collections
  async getTrendingCollections(timeframe = '7d', limit = 10) {
    if (!this.mnemosyneIntegration) {
      return [];
    }
    
    try {
      const analytics = await this.mnemosyneIntegration.analyticsService.getTopContent({
        contentType: 'api-collection',
        timeframe,
        metric: 'usage',
        limit
      });
      
      const collections = [];
      for (const item of analytics) {
        const doc = await this.mnemosyneIntegration.documentService.getById(item.documentId);
        if (doc) {
          collections.push(this.documentToCollection(doc));
        }
      }
      
      return collections;
    } catch (error) {
      this.plugin.logger?.error('Failed to get trending collections:', error);
      return [];
    }
  }
  
  // Get collections by team
  async getTeamCollections(teamId) {
    if (!this.mnemosyneIntegration) {
      return [];
    }
    
    const results = await this.mnemosyneIntegration.documentService.find({
      'permissions.readers': teamId,
      'metadata.sourcePlugin': 'apicarus'
    });
    
    return results.map(doc => this.documentToCollection(doc));
  }
  
  // Fork a shared collection
  async forkCollection(collectionId, options = {}) {
    const originalCollection = await this.getSharedCollection(collectionId);
    if (!originalCollection) {
      throw new Error('Collection not found');
    }
    
    const forkedCollection = {
      ...originalCollection,
      id: Date.now().toString(),
      name: options.name || `${originalCollection.name} (Fork)`,
      sharing: {
        visibility: options.visibility || 'private',
        owner: this.currentUser?.id || 'anonymous',
        teamIds: options.teamIds || [],
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1,
        forkedFrom: collectionId
      },
      metadata: {
        ...originalCollection.metadata,
        forkedAt: new Date(),
        originalId: collectionId,
        originalAuthor: originalCollection.sharing.owner
      }
    };
    
    return await this.createSharedCollection(forkedCollection, options);
  }
  
  // Rate and review a collection
  async rateCollection(collectionId, rating, review = '') {
    if (!this.mnemosyneIntegration) {
      return;
    }
    
    const doc = await this.mnemosyneIntegration.documentService.getById(collectionId);
    if (!doc) return;
    
    const stats = doc.metadata.stats || {};
    const reviews = stats.reviews || [];
    
    // Add or update review
    const existingReviewIndex = reviews.findIndex(r => r.userId === this.currentUser?.id);
    const reviewData = {
      userId: this.currentUser?.id || 'anonymous',
      rating,
      review,
      date: new Date()
    };
    
    if (existingReviewIndex >= 0) {
      reviews[existingReviewIndex] = reviewData;
    } else {
      reviews.push(reviewData);
    }
    
    // Calculate average rating
    const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
    
    // Update document
    await this.mnemosyneIntegration.documentService.update(collectionId, {
      metadata: {
        ...doc.metadata,
        stats: {
          ...stats,
          rating: avgRating,
          reviews
        }
      }
    });
  }
  
  // Update collection usage statistics
  async updateUsageStats(collectionId) {
    if (!this.mnemosyneIntegration) return;
    
    try {
      const doc = await this.mnemosyneIntegration.documentService.getById(collectionId);
      if (!doc) return;
      
      const stats = doc.metadata.stats || {};
      
      await this.mnemosyneIntegration.documentService.update(collectionId, {
        metadata: {
          ...doc.metadata,
          stats: {
            ...stats,
            lastUsed: new Date(),
            usageCount: (stats.usageCount || 0) + 1
          }
        }
      });
    } catch (error) {
      this.plugin.logger?.error('Failed to update usage stats:', error);
    }
  }
  
  // Helper methods
  
  generateShareLink() {
    return `alexandria://shared/apicarus/${Date.now().toString(36)}${Math.random().toString(36).substr(2, 9)}`;
  }
  
  extractAPIDomain(collection) {
    // Extract common domain from collection URLs
    const urls = collection.requests?.map(r => r.url).filter(Boolean) || [];
    if (urls.length === 0) return null;
    
    try {
      const domains = urls.map(url => new URL(url).hostname);
      // Find most common domain
      const domainCounts = {};
      domains.forEach(d => {
        domainCounts[d] = (domainCounts[d] || 0) + 1;
      });
      
      return Object.entries(domainCounts)
        .sort(([,a], [,b]) => b - a)[0]?.[0];
    } catch (error) {
      return null;
    }
  }
  
  async createDomainRelationship(documentId, domain) {
    // Create or find API domain node
    const domainNode = {
      type: 'api-domain',
      title: domain,
      tags: ['api', 'domain'],
      metadata: { domain }
    };
    
    const node = await this.mnemosyneIntegration.knowledgeGraphService.findOrCreateNode(domainNode);
    
    await this.mnemosyneIntegration.knowledgeGraphService.createRelationship({
      sourceId: documentId,
      targetId: node.id,
      type: 'uses-api',
      strength: 0.8,
      bidirectional: false
    });
  }
  
  documentToCollection(doc) {
    try {
      const collection = JSON.parse(doc.content);
      return {
        ...collection,
        mnemosyneId: doc.id,
        permissions: doc.permissions,
        analytics: doc.analytics,
        lastModified: doc.modified
      };
    } catch (error) {
      this.plugin.logger?.error('Failed to parse collection from document:', error);
      return null;
    }
  }
  
  // Local storage fallback methods
  
  async saveToLocalRepository(collection) {
    const repositories = await this.plugin.storage?.find('apiforge_repositories', {}) || [];
    repositories.push(collection);
    await this.plugin.storage?.update('apiforge_repositories', { id: 'main' }, { repositories });
    return collection;
  }
  
  async searchLocalRepository(query, filters) {
    const repositories = await this.plugin.storage?.find('apiforge_repositories', {}) || [];
    
    return repositories.filter(collection => {
      // Basic text search
      const searchText = `${collection.name} ${collection.metadata.description} ${collection.metadata.tags.join(' ')}`.toLowerCase();
      if (!searchText.includes(query.toLowerCase())) return false;
      
      // Apply filters
      if (filters.visibility !== 'all' && collection.sharing.visibility !== filters.visibility) return false;
      if (filters.author && collection.sharing.owner !== filters.author) return false;
      if (filters.tags.length > 0 && !filters.tags.some(tag => collection.metadata.tags.includes(tag))) return false;
      
      return true;
    });
  }
  
  async getSharedCollection(collectionId) {
    if (this.mnemosyneIntegration) {
      const doc = await this.mnemosyneIntegration.documentService.getById(collectionId);
      return doc ? this.documentToCollection(doc) : null;
    } else {
      const repositories = await this.plugin.storage?.find('apiforge_repositories', {}) || [];
      return repositories.find(c => c.id === collectionId || c.mnemosyneId === collectionId);
    }
  }
}