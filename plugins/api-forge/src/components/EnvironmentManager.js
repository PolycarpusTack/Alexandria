// EnvironmentManager component for Apicarus plugin
import { SecureStorage } from '../utils/security.js';

export class EnvironmentManager {
  constructor(plugin) {
    this.plugin = plugin;
    this.environments = plugin.environments || [];
    this.activeEnvironment = plugin.activeEnvironment || null;
    this.secureStorage = new SecureStorage(plugin.context);
  }
  
  async init() {
    // Load environments from storage on initialization
    try {
      const savedData = await this.plugin.storage?.findOne('apiforge_environments', { type: 'environments' });
      if (savedData) {
        this.environments = savedData.environments || [];
        this.activeEnvironment = savedData.activeEnvironment || null;
        this.plugin.environments = this.environments;
        this.plugin.activeEnvironment = this.activeEnvironment;
      }
    } catch (error) {
      this.plugin.logger?.error('Failed to load environments:', error);
    }
  }

  create(name, variables = {}) {
    const environment = {
      id: Date.now().toString(),
      name,
      variables,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    this.environments.push(environment);
    this.save();
    
    return environment;
  }

  setActive(environmentId) {
    const environment = this.environments.find(e => e.id === environmentId);
    if (!environment && environmentId !== null) {
      throw new Error('Environment not found');
    }
    
    this.activeEnvironment = environmentId;
    this.plugin.activeEnvironment = environmentId;
    this.save();
    
    return environment;
  }

  async interpolateVariables(text) {
    if (!this.activeEnvironment || !text) return text;
    
    const environment = this.getById(this.activeEnvironment);
    if (!environment) return text;
    
    // Replace {{variable}} with actual values
    let result = text;
    const matches = text.match(/\{\{(\w+)\}\}/g) || [];
    
    for (const match of matches) {
      const varName = match.slice(2, -2); // Remove {{ }}
      let value = environment.variables[varName];
      
      // Check if this is a secure variable
      if (value && value.startsWith('__secure__')) {
        const secureKey = value.substring(10); // Remove __secure__ prefix
        const secureData = await this.secureStorage.getCredentials(secureKey);
        value = secureData ? secureData.value : match;
      }
      
      result = result.replace(match, value || match);
    }
    
    return result;
  }

  async save() {
    try {
      const environmentsData = {
        type: 'environments',
        environments: this.environments,
        activeEnvironment: this.activeEnvironment,
        updatedAt: new Date()
      };
      
      const existing = await this.plugin.storage?.findOne('apiforge_environments', { type: 'environments' });
      if (existing) {
        await this.plugin.storage?.update('apiforge_environments', existing.id, environmentsData);
      } else {
        await this.plugin.storage?.create('apiforge_environments', environmentsData);
      }
      
      // Update plugin's references
      this.plugin.environments = this.environments;
      this.plugin.activeEnvironment = this.activeEnvironment;
    } catch (error) {
      this.plugin.logger?.error('Failed to save environments:', error);
      throw error;
    }
  }
  
  // Get all environments
  getAll() {
    return this.environments;
  }
  
  // Get active environment
  getActive() {
    if (!this.activeEnvironment) return null;
    return this.getById(this.activeEnvironment);
  }
  
  // Get environment by ID
  getById(environmentId) {
    return this.environments.find(e => e.id === environmentId);
  }
  
  // Update environment
  async update(environmentId, updates) {
    const environment = this.getById(environmentId);
    if (!environment) {
      throw new Error('Environment not found');
    }
    
    Object.assign(environment, updates, {
      updatedAt: new Date()
    });
    
    await this.save();
    return environment;
  }
  
  // Update variable in environment
  async setVariable(environmentId, key, value) {
    const environment = this.getById(environmentId);
    if (!environment) {
      throw new Error('Environment not found');
    }
    
    if (!environment.variables) {
      environment.variables = {};
    }
    
    // Check if this is a sensitive variable (contains secret, token, key, password)
    const isSensitive = this.isSensitiveVariable(key);
    
    if (isSensitive) {
      // Store sensitive data in secure storage
      const secureKey = `env_${environmentId}_${key}`;
      await this.secureStorage.saveCredentials(secureKey, { value });
      
      // Store a placeholder in regular storage
      environment.variables[key] = `__secure__${secureKey}`;
    } else {
      environment.variables[key] = value;
    }
    
    environment.updatedAt = new Date();
    
    await this.save();
    return environment;
  }
  
  // Check if a variable name suggests sensitive data
  isSensitiveVariable(key) {
    const sensitivePatterns = [
      /password/i,
      /secret/i,
      /token/i,
      /key/i,
      /credential/i,
      /auth/i,
      /private/i
    ];
    
    return sensitivePatterns.some(pattern => pattern.test(key));
  }
  
  // Delete variable from environment
  async deleteVariable(environmentId, key) {
    const environment = this.getById(environmentId);
    if (!environment) {
      throw new Error('Environment not found');
    }
    
    if (environment.variables && environment.variables[key]) {
      delete environment.variables[key];
      environment.updatedAt = new Date();
      await this.save();
    }
    
    return environment;
  }
  
  // Delete environment
  async delete(environmentId) {
    const index = this.environments.findIndex(e => e.id === environmentId);
    if (index === -1) {
      throw new Error('Environment not found');
    }
    
    const deleted = this.environments.splice(index, 1)[0];
    
    // If deleted environment was active, clear active environment
    if (this.activeEnvironment === environmentId) {
      this.activeEnvironment = null;
    }
    
    await this.save();
    return deleted;
  }
  
  // Export environment
  exportEnvironment(environmentId) {
    const environment = this.getById(environmentId);
    if (!environment) {
      throw new Error('Environment not found');
    }
    
    return JSON.stringify(environment, null, 2);
  }
  
  // Import environment
  async importEnvironment(jsonData) {
    try {
      const imported = JSON.parse(jsonData);
      
      // Generate new ID to avoid conflicts
      imported.id = Date.now().toString();
      imported.importedAt = new Date();
      imported.updatedAt = new Date();
      
      this.environments.push(imported);
      await this.save();
      
      return imported;
    } catch (error) {
      this.plugin.logger?.error('Failed to import environment:', error);
      throw new Error('Invalid environment data');
    }
  }
  
  // Clone environment
  async clone(environmentId, newName) {
    const original = this.getById(environmentId);
    if (!original) {
      throw new Error('Environment not found');
    }
    
    const cloned = {
      id: Date.now().toString(),
      name: newName || `${original.name} (Copy)`,
      variables: { ...original.variables },
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    this.environments.push(cloned);
    await this.save();
    
    return cloned;
  }
  
  // UI Methods
  showDialog() {
    const activeEnv = this.getActive();
    
    const dialogContent = `
      <div class="environments-dialog">
        <div class="env-list">
          <h4>Environments</h4>
          <div class="env-items">
            ${this.renderEnvironmentsList()}
          </div>
          <button class="btn btn-ghost" onclick="Alexandria.plugins.get('apicarus').environmentManager.createEnvironment()">
            <i class="fa-solid fa-plus"></i> New Environment
          </button>
        </div>
        
        ${activeEnv ? this.renderEnvironmentEditor(activeEnv) : '<p>Select an environment to edit</p>'}
      </div>
      
      <style>
        .environments-dialog {
          display: flex;
          gap: 24px;
          min-height: 400px;
        }
        
        .env-list {
          width: 200px;
          border-right: 1px solid var(--color-border-dark);
          padding-right: 16px;
        }
        
        .env-items {
          margin: 16px 0;
        }
        
        .env-item {
          padding: 8px;
          cursor: pointer;
          border-radius: 4px;
          margin-bottom: 4px;
        }
        
        .env-item:hover {
          background: var(--color-surface-dark);
        }
        
        .env-item.active {
          background: var(--color-primary);
          color: white;
        }
        
        .env-editor {
          flex: 1;
        }
        
        .var-row {
          display: flex;
          gap: 8px;
          margin-bottom: 8px;
        }
        
        .var-row input {
          flex: 1;
        }
      </style>
    `;
    
    this.plugin.ui?.showDialog({
      title: 'Environment Manager',
      content: dialogContent,
      width: '800px',
      buttons: [
        {
          text: 'Close',
          action: 'close'
        }
      ]
    });
  }
  
  renderEnvironmentsList() {
    if (this.environments.length === 0) {
      return '<p style="color: #6b6b6b;">No environments yet</p>';
    }
    
    return this.environments.map(env => `
      <div class="env-item ${this.activeEnvironment === env.id ? 'active' : ''}" 
           onclick="Alexandria.plugins.get('apicarus').environmentManager.selectEnvironment('${env.id}')">
        <i class="fa-solid fa-layer-group"></i> ${env.name}
      </div>
    `).join('');
  }
  
  renderEnvironmentEditor(environment) {
    return `
      <div class="env-editor">
        <h4>${environment.name}</h4>
        <div class="env-actions" style="margin-bottom: 16px;">
          <button class="btn btn-sm btn-secondary" onclick="Alexandria.plugins.get('apicarus').environmentManager.setActive('${environment.id}')">
            <i class="fa-solid fa-check"></i> Set Active
          </button>
          <button class="btn btn-sm btn-ghost" onclick="Alexandria.plugins.get('apicarus').environmentManager.cloneEnvironment('${environment.id}')">
            <i class="fa-solid fa-copy"></i> Clone
          </button>
          <button class="btn btn-sm btn-ghost" onclick="Alexandria.plugins.get('apicarus').environmentManager.exportEnvironmentToFile('${environment.id}')">
            <i class="fa-solid fa-download"></i> Export
          </button>
          <button class="btn btn-sm btn-danger" onclick="Alexandria.plugins.get('apicarus').environmentManager.deleteEnvironment('${environment.id}')">
            <i class="fa-solid fa-trash"></i> Delete
          </button>
        </div>
        
        <h5>Variables</h5>
        <div id="env-variables">
          ${this.renderVariables(environment)}
        </div>
        <button class="btn btn-ghost" onclick="Alexandria.plugins.get('apicarus').environmentManager.addVariable('${environment.id}')">
          <i class="fa-solid fa-plus"></i> Add Variable
        </button>
      </div>
    `;
  }
  
  renderVariables(environment) {
    const variables = environment.variables || {};
    const entries = Object.entries(variables);
    
    if (entries.length === 0) {
      return '<p style="color: #6b6b6b;">No variables defined</p>';
    }
    
    return entries.map(([key, value]) => `
      <div class="var-row">
        <input type="text" value="${key}" class="search-input" readonly />
        <input type="text" value="${value}" class="search-input" 
               onchange="Alexandria.plugins.get('apicarus').environmentManager.updateVariable('${environment.id}', '${key}', this.value)" />
        <button class="btn btn-ghost" onclick="Alexandria.plugins.get('apicarus').environmentManager.deleteVariable('${environment.id}', '${key}')">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>
    `).join('');
  }
  
  async createEnvironment() {
    const name = prompt('Enter environment name:');
    if (!name) return;
    
    const environment = this.create(name);
    this.showDialog(); // Refresh dialog
    
    this.plugin.ui?.showNotification({
      type: 'success',
      title: 'Environment Created',
      message: `Environment "${name}" has been created`
    });
  }
  
  selectEnvironment(environmentId) {
    // This would refresh the dialog to show the selected environment
    this.showDialog();
  }
  
  async addVariable(environmentId) {
    const key = prompt('Variable name:');
    if (!key) return;
    
    const value = prompt('Variable value:');
    if (value === null) return;
    
    await this.setVariable(environmentId, key, value);
    this.showDialog(); // Refresh dialog
  }
  
  async updateVariable(environmentId, key, value) {
    await this.setVariable(environmentId, key, value);
  }
  
  async deleteEnvironment(environmentId) {
    if (!confirm('Are you sure you want to delete this environment?')) return;
    
    await this.delete(environmentId);
    this.showDialog(); // Refresh dialog
    
    this.plugin.ui?.showNotification({
      type: 'success',
      title: 'Environment Deleted',
      message: 'Environment has been deleted'
    });
  }
  
  async cloneEnvironment(environmentId) {
    const newName = prompt('Enter name for cloned environment:');
    if (!newName) return;
    
    await this.clone(environmentId, newName);
    this.showDialog(); // Refresh dialog
    
    this.plugin.ui?.showNotification({
      type: 'success',
      title: 'Environment Cloned',
      message: `Environment has been cloned as "${newName}"`
    });
  }
  
  async exportEnvironmentToFile(environmentId) {
    const environment = this.getById(environmentId);
    if (!environment) return;
    
    const json = this.exportEnvironment(environmentId);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `${environment.name.replace(/\s+/g, '-')}-environment.json`;
    a.click();
    
    URL.revokeObjectURL(url);
  }
}