import { Plugin, UI, Storage, AI, Network } from 'alexandria-sdk';
import { RequestBuilder } from './src/components/RequestBuilder';
import { ResponseViewer } from './src/components/ResponseViewer';
import { CollectionManager } from './src/components/CollectionManager';
import { ProtocolManager } from './src/services/ProtocolManager';
import { AIAssistant } from './src/services/AIAssistant';
import { CodeGenerator } from './src/services/CodeGenerator';

export default class HoppscotchPlugin extends Plugin {
  constructor() {
    super();
    this.name = 'Hoppscotch API Tester';
    this.version = '1.0.0';
    this.activeRequests = new Map();
    this.history = [];
    this.collections = [];
    this.currentEnvironment = null;
  }

  async onActivate(context) {
    this.context = context;
    
    // Initialize services
    this.protocolManager = new ProtocolManager();
    this.aiAssistant = new AIAssistant(AI.getModel('llama2'));
    this.codeGenerator = new CodeGenerator();
    
    // Load saved data
    await this.loadUserData();
    
    // Register UI components
    this.registerUI();
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Initialize WebSocket manager
    this.initializeProtocols();
    
    UI.showNotification({
      type: 'success',
      title: 'Hoppscotch Ready',
      message: 'API testing suite initialized',
      duration: 3000
    });
  }
  async onDeactivate() {
    // Save current state
    await this.saveUserData();
    
    // Cleanup active connections
    this.activeRequests.forEach(request => {
      if (request.abort) request.abort();
    });
    
    // Close WebSocket connections
    this.protocolManager.closeAll();
    
    console.log(`${this.name} deactivated`);
  }

  registerUI() {
    // Main panel - API request builder
    UI.registerPanel({
      id: 'hoppscotch.main',
      location: 'main',
      title: 'API Tester',
      icon: 'fa-solid fa-paper-plane',
      render: () => this.renderMainPanel()
    });

    // Sidebar - Collections and history
    UI.registerPanel({
      id: 'hoppscotch.sidebar',
      location: 'sidebar',
      title: 'Collections',
      icon: 'fa-solid fa-folder-tree',
      render: () => this.renderSidebar()
    });

    // Status bar indicator
    UI.registerPanel({
      id: 'hoppscotch.status',
      location: 'statusbar',
      render: () => this.renderStatusBar()
    });

    // Register commands
    this.registerCommands();
  }
  registerCommands() {
    UI.registerCommand({
      id: 'hoppscotch.newRequest',
      title: 'New API Request',
      handler: () => this.createNewRequest()
    });

    UI.registerCommand({
      id: 'hoppscotch.importCurl',
      title: 'Import cURL Command',
      handler: () => this.showCurlImporter()
    });

    UI.registerCommand({
      id: 'hoppscotch.generateCode',
      title: 'Generate Code Snippet',
      handler: () => this.showCodeGenerator()
    });

    UI.registerCommand({
      id: 'hoppscotch.aiAssist',
      title: 'AI Request Assistant',
      handler: () => this.showAIAssistant()
    });
  }
  renderMainPanel() {
    return `
      <div class="hoppscotch-container">
        <div class="hoppscotch-header">
          <div class="request-builder-header">
            <h1 style="font-size: 20px; font-weight: 700; color: #ffffff;">
              API Request Builder
            </h1>
            <div class="header-actions" style="display: flex; gap: 8px;">
              <button class="btn btn-secondary" onclick="Alexandria.plugins.get('hoppscotch-api-tester').showEnvironments()">
                <i class="fa-solid fa-globe"></i>
                <span id="current-env">No Environment</span>
              </button>
              <button class="btn btn-ghost" onclick="Alexandria.plugins.get('hoppscotch-api-tester').showHistory()">
                <i class="fa-solid fa-clock-rotate-left"></i>
              </button>
              <button class="btn btn-ghost" onclick="Alexandria.plugins.get('hoppscotch-api-tester').showSettings()">
                <i class="fa-solid fa-gear"></i>
              </button>
            </div>
          </div>
        </div>

        <!-- Request Configuration -->
        <div class="request-config card" style="margin-top: 16px;">
          <div class="request-bar" style="display: flex; gap: 8px; padding: 16px;">
            <select id="http-method" class="method-select" style="width: 120px; background-color: var(--color-surface-dark); border: 1px solid var(--color-border-dark); color: var(--color-success); padding: 8px 12px; border-radius: 4px;">
              <option value="GET" style="color: var(--color-success);">GET</option>
              <option value="POST" style="color: var(--color-warning);">POST</option>
              <option value="PUT" style="color: var(--color-primary);">PUT</option>
              <option value="PATCH" style="color: var(--color-secondary);">PATCH</option>
              <option value="DELETE" style="color: var(--color-danger);">DELETE</option>
              <option value="HEAD">HEAD</option>
              <option value="OPTIONS">OPTIONS</option>
              <option value="CUSTOM">CUSTOM</option>
            </select>            
            <input 
              type="text" 
              id="request-url" 
              class="url-input" 
              placeholder="Enter request URL" 
              style="flex: 1; background-color: var(--color-surface-dark); border: 1px solid var(--color-border-dark); color: #e5e5e5; padding: 8px 12px; border-radius: 4px; font-family: 'Monaco', 'Consolas', monospace; font-size: 13px;"
            />
            
            <button class="btn btn-primary" onclick="Alexandria.plugins.get('hoppscotch-api-tester').sendRequest()">
              <i class="fa-solid fa-paper-plane"></i>
              Send
            </button>
            
            <div class="tooltip" style="position: relative;">
              <button class="btn btn-ghost" onclick="Alexandria.plugins.get('hoppscotch-api-tester').saveRequest()">
                <i class="fa-solid fa-bookmark"></i>
              </button>
              <span class="tooltip-content">Save to Collection</span>
            </div>
          </div>

          <!-- Request Tabs -->
          <div class="request-tabs" style="border-top: 1px solid var(--color-border-dark);">
            <div class="tabs-container" style="display: flex; background-color: var(--color-surface-dark);">
              <div class="tab active" data-tab="params" onclick="Alexandria.plugins.get('hoppscotch-api-tester').switchTab('params')">
                <i class="fa-solid fa-sliders tab-icon"></i>
                Params
              </div>
              <div class="tab" data-tab="headers" onclick="Alexandria.plugins.get('hoppscotch-api-tester').switchTab('headers')">
                <i class="fa-solid fa-heading tab-icon"></i>
                Headers
              </div>
              <div class="tab" data-tab="body" onclick="Alexandria.plugins.get('hoppscotch-api-tester').switchTab('body')">
                <i class="fa-solid fa-code tab-icon"></i>
                Body
              </div>