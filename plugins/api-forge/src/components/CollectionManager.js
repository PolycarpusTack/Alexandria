// CollectionManager component for Apicarus plugin

export class CollectionManager {
  constructor(plugin) {
    this.plugin = plugin;
    this.collections = plugin.collections || [];
  }
  
  async init() {
    // Load collections from storage on initialization
    try {
      const savedData = await this.plugin.storage?.findOne('apiforge_collections', { type: 'collections' });
      if (savedData) {
        this.collections = savedData.collections || [];
        this.plugin.collections = this.collections;
      }
    } catch (error) {
      this.plugin.logger?.error('Failed to load collections:', error);
    }
  }

  create(name, description = '') {
    const collection = {
      id: Date.now().toString(),
      name,
      description,
      requests: [],
      createdAt: new Date()
    };
    
    this.collections.push(collection);
    this.save();
    
    return collection;
  }

  addRequest(collectionId, request) {
    const collection = this.collections.find(c => c.id === collectionId);
    if (collection) {
      collection.requests.push({
        ...request,
        id: Date.now().toString(),
        savedAt: new Date()
      });
      this.save();
    }
  }

  async save() {
    try {
      const collectionsData = {
        type: 'collections',
        collections: this.collections,
        updatedAt: new Date()
      };
      
      const existing = await this.plugin.storage?.findOne('apiforge_collections', { type: 'collections' });
      if (existing) {
        await this.plugin.storage?.update('apiforge_collections', existing.id, collectionsData);
      } else {
        await this.plugin.storage?.create('apiforge_collections', collectionsData);
      }
      
      // Update plugin's collections reference
      this.plugin.collections = this.collections;
    } catch (error) {
      this.plugin.logger?.error('Failed to save collections:', error);
      throw error;
    }
  }
  
  // Get all collections
  getAll() {
    return this.collections;
  }
  
  // Get a specific collection by ID
  getById(collectionId) {
    return this.collections.find(c => c.id === collectionId);
  }
  
  // Update collection details
  async update(collectionId, updates) {
    const collection = this.getById(collectionId);
    if (!collection) {
      throw new Error('Collection not found');
    }
    
    Object.assign(collection, updates, {
      updatedAt: new Date()
    });
    
    await this.save();
    return collection;
  }
  
  // Delete a collection
  async delete(collectionId) {
    const index = this.collections.findIndex(c => c.id === collectionId);
    if (index === -1) {
      throw new Error('Collection not found');
    }
    
    const deleted = this.collections.splice(index, 1)[0];
    await this.save();
    return deleted;
  }
  
  // Get request from collection
  getRequest(collectionId, requestId) {
    const collection = this.getById(collectionId);
    if (!collection) return null;
    
    return collection.requests.find(r => r.id === requestId);
  }
  
  // Update request in collection
  async updateRequest(collectionId, requestId, updates) {
    const collection = this.getById(collectionId);
    if (!collection) {
      throw new Error('Collection not found');
    }
    
    const request = collection.requests.find(r => r.id === requestId);
    if (!request) {
      throw new Error('Request not found');
    }
    
    Object.assign(request, updates, {
      updatedAt: new Date()
    });
    
    await this.save();
    return request;
  }
  
  // Delete request from collection
  async deleteRequest(collectionId, requestId) {
    const collection = this.getById(collectionId);
    if (!collection) {
      throw new Error('Collection not found');
    }
    
    const index = collection.requests.findIndex(r => r.id === requestId);
    if (index === -1) {
      throw new Error('Request not found');
    }
    
    const deleted = collection.requests.splice(index, 1)[0];
    await this.save();
    return deleted;
  }
  
  // Export collection to JSON
  exportCollection(collectionId) {
    const collection = this.getById(collectionId);
    if (!collection) {
      throw new Error('Collection not found');
    }
    
    return JSON.stringify(collection, null, 2);
  }
  
  // Import collection from JSON
  async importCollection(jsonData) {
    try {
      const imported = JSON.parse(jsonData);
      
      // Generate new IDs to avoid conflicts
      imported.id = Date.now().toString();
      imported.importedAt = new Date();
      
      // Generate new IDs for all requests
      if (imported.requests) {
        imported.requests = imported.requests.map(req => ({
          ...req,
          id: Date.now().toString() + Math.random().toString(36).substr(2, 9)
        }));
      }
      
      this.collections.push(imported);
      await this.save();
      
      return imported;
    } catch (error) {
      this.plugin.logger?.error('Failed to import collection:', error);
      throw new Error('Invalid collection data');
    }
  }
  
  // UI Methods
  async createCollection() {
    const name = await this.promptForName();
    if (!name) return;
    
    const collection = this.create(name);
    this.plugin.refreshUI();
    
    this.plugin.ui?.showNotification({
      type: 'success',
      title: 'Collection Created',
      message: `Collection "${name}" has been created`
    });
  }
  
  async importCollection() {
    // Show file picker dialog
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      try {
        const content = await file.text();
        const imported = await this.importCollection(content);
        
        this.plugin.refreshUI();
        
        this.plugin.ui?.showNotification({
          type: 'success',
          title: 'Collection Imported',
          message: `Collection "${imported.name}" has been imported`
        });
      } catch (error) {
        this.plugin.ui?.showNotification({
          type: 'error',
          title: 'Import Failed',
          message: error.message
        });
      }
    };
    
    input.click();
  }
  
  async promptForName() {
    // Simple prompt for now, can be enhanced with a proper dialog
    return prompt('Enter collection name:');
  }
  
  // Save current request to a collection
  async saveCurrentRequest() {
    const url = document.getElementById('apicarus-url')?.value;
    if (!url) {
      this.plugin.ui?.showNotification({
        type: 'warning',
        title: 'No Request',
        message: 'Please create a request first'
      });
      return;
    }
    
    // Show collection picker
    if (this.collections.length === 0) {
      const create = confirm('No collections found. Create a new collection?');
      if (create) {
        await this.createCollection();
      }
      return;
    }
    
    // For now, use the first collection or prompt
    const collectionId = this.collections[0].id;
    const requestName = prompt('Enter request name:') || 'Unnamed Request';
    
    const request = {
      name: requestName,
      method: document.getElementById('apicarus-method')?.value,
      url: url,
      headers: this.plugin.getHeaders(),
      params: this.plugin.getParams(),
      body: this.plugin.getRequestBody(),
      auth: this.plugin.currentRequest?.auth
    };
    
    this.addRequest(collectionId, request);
    
    this.plugin.ui?.showNotification({
      type: 'success',
      title: 'Request Saved',
      message: `Request saved to collection`
    });
  }
}