/**
 * Main Panel Component for Apicarus
 * @module components/MainPanel
 */

import { Component } from './Component.js';
import { html, safe, classNames } from '../utils/template.js';
import { UI_CLASSES } from '../config/constants.js';

export class MainPanel extends Component {
  constructor(plugin) {
    super(plugin);
    
    this.state = {
      activeTab: 'params',
      isAIPanelOpen: false
    };
  }

  render() {
    return html`
      <div class="${UI_CLASSES.container}">
        ${safe(this.renderHeader())}
        ${safe(this.renderRequestCard())}
        ${safe(this.renderResponseCard())}
      </div>
      ${safe(this.renderHiddenPanels())}
      <style>${safe(this.getStyles())}</style>
    `;
  }

  renderHeader() {
    return html`
      <div class="${UI_CLASSES.header}">
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          ${safe(this.renderTitleSection())}
          ${safe(this.renderHeaderActions())}
        </div>
      </div>
    `;
  }

  renderTitleSection() {
    return html`
      <div>
        <h1 style="font-size: 24px; font-weight: 700; margin-bottom: 8px;">
          Apicarus
        </h1>
        <p style="color: #8b8b8b; margin-bottom: 24px;">
          Professional API testing with AI-powered insights
        </p>
      </div>
    `;
  }

  renderHeaderActions() {
    return html`
      <div style="display: flex; gap: 8px;">
        <button 
          class="${classNames(UI_CLASSES.button.secondary, 'tooltip')}"
          data-action="browse-shared"
        >
          <i class="fa-solid fa-globe"></i>
          <span class="tooltip-content">Browse Shared Collections</span>
        </button>
        <button 
          class="${classNames(UI_CLASSES.button.ghost, 'tooltip')}"
          data-action="show-settings"
        >
          <i class="fa-solid fa-gear"></i>
          <span class="tooltip-content">Settings</span>
        </button>
      </div>
    `;
  }

  renderRequestCard() {
    return html`
      <div class="${UI_CLASSES.card}">
        <div class="${UI_CLASSES.cardHeader}">
          <h2 class="${UI_CLASSES.cardTitle}">Request</h2>
          ${safe(this.renderRequestActions())}
        </div>
        <div style="padding: 16px;">
          ${safe(this.renderRequestInput())}
          ${safe(this.renderRequestTabs())}
        </div>
      </div>
    `;
  }

  renderRequestActions() {
    return html`
      <div style="display: flex; gap: 8px;">
        <button 
          class="${classNames(UI_CLASSES.button.ghost, 'tooltip')}"
          data-action="show-environments"
        >
          <i class="fa-solid fa-layer-group"></i>
          <span class="tooltip-content">Environments</span>
        </button>
        <button 
          class="${classNames(UI_CLASSES.button.ghost, 'tooltip')}"
          data-action="show-ai-assistant"
        >
          <i class="fa-solid fa-wand-magic-sparkles"></i>
          <span class="tooltip-content">AI Assistant</span>
        </button>
      </div>
    `;
  }

  renderRequestInput() {
    const { method = 'GET', url = '' } = this.plugin.currentRequest || {};
    
    return html`
      <div style="display: flex; gap: 8px; margin-bottom: 16px;">
        <select 
          id="apicarus-method" 
          class="${UI_CLASSES.select}" 
          style="width: 120px;"
          value="${method}"
        >
          <option value="GET">GET</option>
          <option value="POST">POST</option>
          <option value="PUT">PUT</option>
          <option value="PATCH">PATCH</option>
          <option value="DELETE">DELETE</option>
          <option value="HEAD">HEAD</option>
          <option value="OPTIONS">OPTIONS</option>
        </select>
        <input 
          type="text" 
          id="apicarus-url" 
          class="${UI_CLASSES.input}" 
          style="flex: 1;" 
          placeholder="Enter request URL"
          value="${url}"
        />
        <button 
          class="${UI_CLASSES.button.primary}"
          data-action="send-request"
        >
          <i class="fa-solid fa-paper-plane"></i>
          Send
        </button>
      </div>
    `;
  }

  renderRequestTabs() {
    return html`
      <div class="apicarus-tabs">
        <div class="${UI_CLASSES.tabGroup}" style="border-bottom: 1px solid var(--color-border-dark); margin-bottom: 16px;">
          ${safe(this.renderTabButtons())}
        </div>
        <div id="apicarus-tabContent">
          ${safe(this.renderTabContent())}
        </div>
      </div>
    `;
  }

  renderTabButtons() {
    const tabs = ['params', 'headers', 'body', 'auth'];
    
    return tabs.map(tab => html`
      <button 
        class="${classNames(UI_CLASSES.tabButton, { active: this.state.activeTab === tab })}"
        data-tab="${tab}"
      >
        ${this.getTabLabel(tab)}
      </button>
    `).join('');
  }

  getTabLabel(tab) {
    const labels = {
      params: 'Parameters',
      headers: 'Headers',
      body: 'Body',
      auth: 'Authorization'
    };
    return labels[tab] || tab;
  }

  renderTabContent() {
    switch(this.state.activeTab) {
      case 'params':
        return this.renderParamsTab();
      case 'headers':
        return this.renderHeadersTab();
      case 'body':
        return this.renderBodyTab();
      case 'auth':
        return this.renderAuthTab();
      default:
        return '';
    }
  }

  renderParamsTab() {
    const params = this.plugin.currentRequest?.params || [];
    
    return html`
      <div class="key-value-editor">
        <div class="kv-row kv-header">
          <div style="width: 40px;"></div>
          <div style="flex: 1;">Key</div>
          <div style="flex: 1;">Value</div>
          <div style="width: 40px;"></div>
        </div>
        <div id="apicarus-params-list">
          ${safe(this.renderKeyValueRows(params, 'params'))}
        </div>
        <button 
          class="${UI_CLASSES.button.ghost}"
          data-action="add-param"
        >
          <i class="fa-solid fa-plus"></i>
          Add Parameter
        </button>
      </div>
    `;
  }

  renderKeyValueRows(items, type) {
    if (!items || items.length === 0) {
      return '';
    }
    
    return items.map((item, index) => html`
      <div class="kv-row" data-index="${index}">
        <input type="checkbox" ${item.enabled ? 'checked' : ''} />
        <input 
          type="text" 
          name="key" 
          value="${item.key || ''}" 
          placeholder="Key" 
          class="${UI_CLASSES.input}" 
        />
        <input 
          type="text" 
          name="value" 
          value="${item.value || ''}" 
          placeholder="Value" 
          class="${UI_CLASSES.input}" 
        />
        <button 
          class="${UI_CLASSES.button.ghost}"
          data-action="remove-kv"
          data-type="${type}"
          data-index="${index}"
        >
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>
    `).join('');
  }

  renderResponseCard() {
    return html`
      <div class="${UI_CLASSES.card}" style="animation-delay: 0.1s;">
        <div class="${UI_CLASSES.cardHeader}">
          <h2 class="${UI_CLASSES.cardTitle}">Response</h2>
          <div id="apicarus-responseStats" style="display: flex; gap: 16px; font-size: 12px; color: #8b8b8b;">
            <!-- Response stats will be inserted here -->
          </div>
        </div>
        <div id="apicarus-responseContent" style="padding: 16px;">
          ${safe(this.renderEmptyResponse())}
        </div>
      </div>
    `;
  }

  renderEmptyResponse() {
    return html`
      <div style="text-align: center; color: #6b6b6b; padding: 48px;">
        <i class="fa-solid fa-cloud" style="font-size: 48px; margin-bottom: 16px; opacity: 0.3;"></i>
        <p>Send a request to see the response</p>
      </div>
    `;
  }

  renderHiddenPanels() {
    return html`
      <div 
        id="apicarus-aiPanel" 
        class="${classNames('apicarus-ai-panel', { active: this.state.isAIPanelOpen })}"
      ></div>
    `;
  }

  getStyles() {
    return `
      .apicarus-container {
        max-width: 1200px;
        margin: 0 auto;
      }

      .tab-group {
        display: flex;
        gap: 24px;
        padding: 0;
      }

      .tab-button {
        background: none;
        border: none;
        color: #8b8b8b;
        padding: 8px 0;
        cursor: pointer;
        font-size: 13px;
        position: relative;
        transition: color 0.15s ease;
      }

      .tab-button:hover {
        color: #e5e5e5;
      }

      .tab-button.active {
        color: #ffffff;
      }

      .tab-button.active::after {
        content: '';
        position: absolute;
        bottom: -9px;
        left: 0;
        right: 0;
        height: 2px;
        background-color: var(--color-primary);
      }

      .key-value-editor {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .kv-row {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .kv-row input {
        flex: 1;
      }

      .kv-header {
        font-size: 11px;
        color: #6b6b6b;
        text-transform: uppercase;
        font-weight: 600;
      }

      .apicarus-ai-panel {
        position: fixed;
        right: -400px;
        top: var(--titlebar-height);
        bottom: var(--statusbar-height);
        width: 400px;
        background-color: var(--color-card-dark);
        border-left: 1px solid var(--color-border-dark);
        transition: right 0.3s ease;
        z-index: 100;
        display: flex;
        flex-direction: column;
      }

      .apicarus-ai-panel.active {
        right: 0;
      }

      .response-json {
        background-color: var(--color-surface-dark);
        border: 1px solid var(--color-border-dark);
        border-radius: 4px;
        padding: 16px;
        font-family: monospace;
        font-size: 12px;
        overflow-x: auto;
      }
    `;
  }

  setupEventListeners() {
    // Tab switching
    this.delegate('click', '[data-tab]', (e, target) => {
      const tab = target.dataset.tab;
      this.setState({ activeTab: tab });
    });

    // Action buttons
    this.delegate('click', '[data-action]', (e, target) => {
      const action = target.dataset.action;
      this.handleAction(action, target);
    });
  }

  handleAction(action, target) {
    switch(action) {
      case 'send-request':
        this.plugin.sendRequest();
        break;
        
      case 'browse-shared':
        this.plugin.showSharedRepository();
        break;
        
      case 'show-settings':
        this.plugin.showSettings();
        break;
        
      case 'show-environments':
        this.plugin.showEnvironments();
        break;
        
      case 'show-ai-assistant':
        this.toggleAIPanel();
        break;
        
      case 'add-param':
        this.plugin.addParam();
        break;
        
      case 'remove-kv':
        const type = target.dataset.type;
        const index = parseInt(target.dataset.index);
        this.plugin.removeKeyValue(type, index);
        break;
    }
  }

  toggleAIPanel() {
    this.setState({ isAIPanelOpen: !this.state.isAIPanelOpen });
    
    if (this.state.isAIPanelOpen) {
      const panel = document.getElementById('apicarus-aiPanel');
      if (panel && this.plugin.aiAssistant) {
        panel.innerHTML = this.plugin.aiAssistant.renderAssistantPanel();
      }
    }
  }
}