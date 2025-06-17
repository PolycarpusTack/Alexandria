# Apicarus Plugin - Implementation Tasks

This document contains detailed implementation tasks divided into 6 core areas needed to complete the plugin functionality.

---

# 1. Implement Missing Methods (~40-50% more code)

## Task 1.1: Core Request Methods Implementation

### File: `index.js`

```javascript
// TASK: Implement getHeaders() method
getHeaders() {
  const headerRows = document.querySelectorAll('#apicarus-headers-list .kv-row:not(.kv-header)');
  const headers = {};
  
  headerRows.forEach(row => {
    const checkbox = row.querySelector('.kv-checkbox');
    const enabled = !checkbox || checkbox.checked;
    const keyInput = row.querySelector('.kv-key');
    const valueInput = row.querySelector('.kv-value');
    
    if (enabled && keyInput && valueInput) {
      const key = keyInput.value.trim();
      const value = valueInput.value;
      
      if (key) {
        // Apply environment variable interpolation
        const interpolatedValue = this.environmentManager 
          ? this.environmentManager.interpolateVariables(value)
          : value;
        headers[key] = interpolatedValue;
      }
    }
  });
  
  // Add default headers if not present
  if (!headers['User-Agent']) {
    headers['User-Agent'] = 'API-Forge/1.0.0';
  }
  
  return headers;
}

// TASK: Implement getParams() method
getParams() {
  const paramRows = document.querySelectorAll('#apicarus-params-list .kv-row:not(.kv-header)');
  const params = {};
  
  paramRows.forEach(row => {
    const checkbox = row.querySelector('.kv-checkbox');
    const enabled = !checkbox || checkbox.checked;
    const keyInput = row.querySelector('.kv-key');
    const valueInput = row.querySelector('.kv-value');
    
    if (enabled && keyInput) {
      const key = keyInput.value.trim();
      const value = valueInput ? valueInput.value : '';
      
      if (key) {
        const interpolatedValue = this.environmentManager 
          ? this.environmentManager.interpolateVariables(value)
          : value;
        params[key] = interpolatedValue;
      }
    }
  });
  
  return params;
}

// TASK: Implement getRequestBody() method
getRequestBody() {
  const activeBodyTab = document.querySelector('.body-type-tab.active');
  if (!activeBodyTab) return null;
  
  const bodyType = activeBodyTab.dataset.bodyType;
  
  switch (bodyType) {
    case 'none':
      return null;
      
    case 'json': {
      const jsonEditor = document.getElementById('apicarus-body-json');
      if (!jsonEditor || !jsonEditor.value.trim()) return null;
      
      try {
        const jsonString = this.environmentManager 
          ? this.environmentManager.interpolateVariables(jsonEditor.value)
          : jsonEditor.value;
        return JSON.parse(jsonString);
      } catch (error) {
        UI.showNotification({
          type: 'error',
          title: 'Invalid JSON',
          message: error.message
        });
        throw new Error('Invalid JSON in request body');
      }
    }
    
    case 'form-data': {
      const formData = new FormData();
      const formRows = document.querySelectorAll('#apicarus-formdata-list .kv-row:not(.kv-header)');
      
      formRows.forEach(row => {
        const enabled = row.querySelector('.kv-checkbox')?.checked !== false;
        const key = row.querySelector('.kv-key')?.value?.trim();
        const type = row.querySelector('.form-type')?.value || 'text';
        
        if (enabled && key) {
          if (type === 'file') {
            const fileInput = row.querySelector('.form-file-input');
            if (fileInput?.files?.[0]) {
              formData.append(key, fileInput.files[0]);
            }
          } else {
            const value = row.querySelector('.kv-value')?.value || '';
            const interpolatedValue = this.environmentManager 
              ? this.environmentManager.interpolateVariables(value)
              : value;
            formData.append(key, interpolatedValue);
          }
        }
      });
      
      return formData;
    }
    
    case 'raw': {
      const rawEditor = document.getElementById('apicarus-body-raw');
      const contentType = document.getElementById('apicarus-raw-type')?.value || 'text/plain';
      
      if (!rawEditor || !rawEditor.value.trim()) return null;
      
      const rawContent = this.environmentManager 
        ? this.environmentManager.interpolateVariables(rawEditor.value)
        : rawEditor.value;
      
      // Set content-type header
      this.requestBuilder.addHeader('Content-Type', contentType);
      
      return rawContent;
    }
    
    case 'binary': {
      const fileInput = document.getElementById('apicarus-body-binary');
      return fileInput?.files?.[0] || null;
    }
    
    default:
      return null;
  }
}

// TASK: Implement renderKeyValueRows() method
renderKeyValueRows(type, data = []) {
  const rows = data.length ? data : [{ key: '', value: '', enabled: true }];
  
  return `
    <div class="kv-row kv-header">
      <div style="width: 40px;"></div>
      <div style="flex: 1; font-weight: 600;">Key</div>
      <div style="flex: 1; font-weight: 600;">Value</div>
      <div style="width: 40px;"></div>
    </div>
    ${rows.map((row, index) => `
      <div class="kv-row" data-row-index="${index}">
        <div style="width: 40px;">
          <input type="checkbox" class="kv-checkbox" ${row.enabled !== false ? 'checked' : ''}>
        </div>
        <input 
          type="text" 
          class="search-input kv-key" 
          placeholder="Key" 
          value="${this.escapeHtml(row.key || '')}"
          data-type="${type}"
          data-index="${index}"
        >
        <input 
          type="text" 
          class="search-input kv-value" 
          placeholder="Value" 
          value="${this.escapeHtml(row.value || '')}"
          data-type="${type}"
          data-index="${index}"
        >
        <div style="width: 40px;">
          <button class="btn btn-ghost kv-delete" data-type="${type}" data-index="${index}">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      </div>
    `).join('')}
  `;
}

// TASK: Implement URL handling methods
handleUrlChange(url) {
  // Update the request builder
  this.requestBuilder.setUrl(url);
  
  // Parse and sync query parameters
  try {
    const urlObj = new URL(url);
    const params = {};
    
    urlObj.searchParams.forEach((value, key) => {
      params[key] = value;
    });
    
    // Update params tab if it's active
    if (this.activeTab === 'params') {
      this.updateParamsFromUrl(params);
    }
    
    // Store parsed params for later use
    this.parsedUrlParams = params;
  } catch (error) {
    // Invalid URL, clear parsed params
    this.parsedUrlParams = {};
  }
}

// TASK: Implement method change handler
handleMethodChange(method) {
  this.requestBuilder.setMethod(method);
  
  // Show/hide body tab based on method
  const bodyTab = document.querySelector('.tab-button[data-tab="body"]');
  if (bodyTab) {
    if (['POST', 'PUT', 'PATCH'].includes(method)) {
      bodyTab.style.display = 'block';
    } else {
      bodyTab.style.display = 'none';
      // Switch to another tab if body was active
      if (this.activeTab === 'body') {
        this.switchTab('params');
      }
    }
  }
}

// TASK: Implement collection saving
async saveCurrentRequest() {
  const method = document.getElementById('apicarus-method')?.value;
  const url = document.getElementById('apicarus-url')?.value;
  
  if (!url) {
    UI.showNotification({
      type: 'warning',
      title: 'Cannot Save',
      message: 'Please enter a URL first'
    });
    return;
  }
  
  // Build request object
  const request = {
    method,
    url,
    headers: this.getHeaders(),
    params: this.getParams(),
    body: ['POST', 'PUT', 'PATCH'].includes(method) ? this.getRequestBody() : null,
    auth: this.requestBuilder.request.auth
  };
  
  // Show save dialog
  UI.openModal({
    title: 'Save Request',
    content: this.renderSaveRequestDialog(request),
    buttons: [
      {
        label: 'Save',
        action: () => this.performSaveRequest(request),
        style: 'primary'
      },
      {
        label: 'Cancel',
        action: () => UI.closeModal()
      }
    ]
  });
}

// TASK: Implement cURL parsing
parseCurl(curlCommand) {
  const request = {
    method: 'GET',
    url: '',
    headers: {},
    body: null
  };
  
  // Remove line breaks and extra spaces
  const normalized = curlCommand.replace(/\\\n/g, ' ').replace(/\s+/g, ' ').trim();
  
  // Extract method
  const methodMatch = normalized.match(/-X\s+(\w+)/);
  if (methodMatch) {
    request.method = methodMatch[1].toUpperCase();
  }
  
  // Extract URL
  const urlMatch = normalized.match(/curl\s+(?:-[A-Z]\s+\S+\s+)*["']?([^"'\s]+)["']?/);
  if (urlMatch) {
    request.url = urlMatch[1];
  }
  
  // Extract headers
  const headerRegex = /-H\s+["']([^"':]+):\s*([^"']+)["']/g;
  let headerMatch;
  while ((headerMatch = headerRegex.exec(normalized)) !== null) {
    request.headers[headerMatch[1]] = headerMatch[2];
  }
  
  // Extract data/body
  const dataMatch = normalized.match(/(?:-d|--data)\s+["']([^"']+)["']/);
  if (dataMatch) {
    const data = dataMatch[1];
    try {
      request.body = JSON.parse(data);
    } catch {
      request.body = data;
    }
    
    // Set method to POST if not specified
    if (!methodMatch) {
      request.method = 'POST';
    }
  }
  
  return request;
}

// TASK: Implement environment variable preview
showEnvironmentPreview() {
  const url = document.getElementById('apicarus-url')?.value || '';
  const headers = this.getHeaders();
  const params = this.getParams();
  
  const preview = {
    url: this.environmentManager?.interpolateVariables(url) || url,
    headers: {},
    params: {}
  };
  
  // Show original and resolved values
  Object.entries(headers).forEach(([key, value]) => {
    preview.headers[key] = {
      original: value,
      resolved: this.environmentManager?.interpolateVariables(value) || value
    };
  });
  
  Object.entries(params).forEach(([key, value]) => {
    preview.params[key] = {
      original: value,
      resolved: this.environmentManager?.interpolateVariables(value) || value
    };
  });
  
  UI.openModal({
    title: 'Environment Variable Preview',
    content: this.renderEnvironmentPreview(preview)
  });
}

// TASK: Implement request history search
searchHistory(query) {
  if (!query) return this.history;
  
  const lowerQuery = query.toLowerCase();
  
  return this.history.filter(item => {
    return item.url.toLowerCase().includes(lowerQuery) ||
           item.method.toLowerCase().includes(lowerQuery) ||
           (item.status && item.status.toString().includes(query));
  });
}

// TASK: Implement request duplication
duplicateRequest(request) {
  // Apply request to UI
  document.getElementById('apicarus-method').value = request.method;
  document.getElementById('apicarus-url').value = request.url;
  
  // Switch to appropriate tabs and apply data
  if (request.headers && Object.keys(request.headers).length) {
    this.switchTab('headers');
    this.applyHeadersToUI(request.headers);
  }
  
  if (request.body) {
    this.switchTab('body');
    this.applyBodyToUI(request.body);
  }
  
  if (request.auth && request.auth.type !== 'none') {
    this.switchTab('auth');
    this.applyAuthToUI(request.auth);
  }
  
  UI.showNotification({
    type: 'success',
    title: 'Request Duplicated',
    message: 'Request has been loaded into the builder'
  });
}
```

## Task 1.2: Helper Method Implementations

### File: `index.js` (continued)

```javascript
// TASK: Implement HTML escaping for security
escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// TASK: Implement time formatting
formatTime(timestamp) {
  const now = new Date();
  const time = new Date(timestamp);
  const diff = now - time;
  
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
  
  return time.toLocaleDateString();
}

// TASK: Implement method color coding
getMethodColor(method) {
  const colors = {
    GET: '#10b981',     // green
    POST: '#3b82f6',    // blue
    PUT: '#f59e0b',     // yellow
    PATCH: '#8b5cf6',   // purple
    DELETE: '#ef4444',  // red
    HEAD: '#6b7280',    // gray
    OPTIONS: '#06b6d4', // cyan
  };
  
  return colors[method] || '#6b7280';
}

// TASK: Implement status color coding
getStatusColor(status) {
  if (!status) return '#6b7280';
  if (status >= 200 && status < 300) return '#10b981'; // green
  if (status >= 300 && status < 400) return '#f59e0b'; // yellow
  if (status >= 400 && status < 500) return '#f97316'; // orange
  if (status >= 500) return '#ef4444'; // red
  return '#6b7280'; // gray
}

// TASK: Implement error message formatting
getErrorMessage(error) {
  // Network errors
  if (error.code === 'NETWORK_ERROR' || error.code === 'ECONNREFUSED') {
    return 'Could not connect to the server. Please check the URL and your internet connection.';
  }
  
  if (error.code === 'TIMEOUT' || error.code === 'ETIMEDOUT') {
    return 'Request timed out. The server took too long to respond.';
  }
  
  if (error.code === 'CERT_ERROR' || error.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE') {
    return 'SSL certificate error. The server\'s certificate could not be verified.';
  }
  
  // HTTP errors
  if (error.status === 401) {
    return 'Authentication failed. Please check your credentials.';
  }
  
  if (error.status === 403) {
    return 'Access forbidden. You don\'t have permission to access this resource.';
  }
  
  if (error.status === 404) {
    return 'Resource not found. Please check the URL.';
  }
  
  if (error.status === 429) {
    return 'Too many requests. Please try again later.';
  }
  
  if (error.status >= 500) {
    return 'Server error. The server encountered an error processing your request.';
  }
  
  // Generic error with message
  if (error.message) {
    return error.message;
  }
  
  return 'An unexpected error occurred. Please try again.';
}

// TASK: Implement request validation
validateRequest() {
  const url = document.getElementById('apicarus-url')?.value;
  
  if (!url) {
    throw new Error('URL is required');
  }
  
  // Validate URL format
  try {
    new URL(url);
  } catch {
    // Try with base URL if it's a relative path
    try {
      new URL(url, 'http://example.com');
    } catch {
      throw new Error('Invalid URL format');
    }
  }
  
  // Validate headers
  const headers = this.getHeaders();
  const invalidHeaders = Object.keys(headers).filter(key => 
    !key || key.includes(' ') || key.includes(':')
  );
  
  if (invalidHeaders.length) {
    throw new Error(`Invalid header names: ${invalidHeaders.join(', ')}`);
  }
  
  // Validate body for certain methods
  const method = document.getElementById('apicarus-method')?.value;
  if (['POST', 'PUT', 'PATCH'].includes(method)) {
    try {
      this.getRequestBody();
    } catch (error) {
      throw new Error(`Invalid request body: ${error.message}`);
    }
  }
  
  return true;
}

// TASK: Implement request metrics calculation
calculateMetrics(startTime, endTime, response) {
  const duration = endTime - startTime;
  
  const metrics = {
    duration,
    dnsLookup: 0, // Would need proper timing API
    tcpHandshake: 0,
    tlsHandshake: 0,
    requestSent: 0,
    waiting: 0,
    contentDownload: 0,
    total: duration
  };
  
  // Calculate size metrics
  metrics.requestSize = this.calculateRequestSize();
  metrics.responseSize = this.calculateResponseSize(response);
  metrics.totalSize = metrics.requestSize + metrics.responseSize;
  
  return metrics;
}

// TASK: Implement request size calculation
calculateRequestSize() {
  const method = document.getElementById('apicarus-method')?.value || 'GET';
  const url = document.getElementById('apicarus-url')?.value || '';
  const headers = this.getHeaders();
  
  // Estimate request line size
  let size = method.length + url.length + 11; // "GET /path HTTP/1.1\r\n"
  
  // Add headers size
  Object.entries(headers).forEach(([key, value]) => {
    size += key.length + value.length + 4; // "key: value\r\n"
  });
  
  // Add body size if present
  if (['POST', 'PUT', 'PATCH'].includes(method)) {
    try {
      const body = this.getRequestBody();
      if (body) {
        if (body instanceof FormData) {
          // Estimate FormData size
          for (let [key, value] of body) {
            size += key.length + value.length + 100; // Rough estimate for multipart overhead
          }
        } else if (typeof body === 'string') {
          size += body.length;
        } else {
          size += JSON.stringify(body).length;
        }
      }
    } catch {
      // Ignore body errors for size calculation
    }
  }
  
  return size;
}

// TASK: Implement response size calculation
calculateResponseSize(response) {
  let size = 15; // "HTTP/1.1 200 OK\r\n"
  
  // Add headers size
  if (response.headers) {
    Object.entries(response.headers).forEach(([key, value]) => {
      size += key.length + value.length + 4;
    });
  }
  
  // Add body size
  if (response.data) {
    if (typeof response.data === 'string') {
      size += response.data.length;
    } else if (response.data instanceof ArrayBuffer) {
      size += response.data.byteLength;
    } else {
      size += JSON.stringify(response.data).length;
    }
  }
  
  return size;
}
```

---

# 2. Add DOM Manipulation Logic

## Task 2.1: Dynamic UI Updates

### File: `index.js` - DOM Manipulation Methods

```javascript
// TASK: Implement dynamic row addition for key-value editors
attachKeyValueListeners(container, type) {
  // Add event delegation for better performance
  container.addEventListener('input', (e) => {
    if (e.target.matches('.kv-key, .kv-value')) {
      this.handleKeyValueInput(e, type);
    }
  });
  
  container.addEventListener('click', (e) => {
    if (e.target.closest('.kv-delete')) {
      this.handleKeyValueDelete(e, type);
    }
  });
  
  container.addEventListener('change', (e) => {
    if (e.target.matches('.kv-checkbox')) {
      this.handleKeyValueToggle(e, type);
    }
  });
}

// TASK: Handle key-value input changes
handleKeyValueInput(event, type) {
  const row = event.target.closest('.kv-row');
  const isLastRow = !row.nextElementSibling || row.nextElementSibling.matches('.kv-add-button');
  const keyInput = row.querySelector('.kv-key');
  const valueInput = row.querySelector('.kv-value');
  
  // Auto-add new row if typing in the last row
  if (isLastRow && (keyInput.value || valueInput.value)) {
    this.addKeyValueRow(type, row.parentElement);
  }
  
  // Update data model
  this.updateKeyValueData(type);
  
  // Handle auto-complete for common headers
  if (type === 'headers' && event.target.matches('.kv-key')) {
    this.showHeaderSuggestions(event.target);
  }
}

// TASK: Add new key-value row
addKeyValueRow(type, container, data = {}) {
  const rowCount = container.querySelectorAll('.kv-row:not(.kv-header)').length;
  const row = document.createElement('div');
  row.className = 'kv-row animate-slideUp';
  row.dataset.rowIndex = rowCount;
  
  row.innerHTML = `
    <div style="width: 40px;">
      <input type="checkbox" class="kv-checkbox" ${data.enabled !== false ? 'checked' : ''}>
    </div>
    <input 
      type="text" 
      class="search-input kv-key" 
      placeholder="Key" 
      value="${this.escapeHtml(data.key || '')}"
      autocomplete="off"
    >
    <input 
      type="text" 
      class="search-input kv-value" 
      placeholder="Value" 
      value="${this.escapeHtml(data.value || '')}"
      autocomplete="off"
    >
    <div style="width: 40px;">
      <button class="btn btn-ghost kv-delete">
        <i class="fa-solid fa-trash"></i>
      </button>
    </div>
  `;
  
  container.appendChild(row);
  
  // Focus on key input if it's empty
  if (!data.key) {
    row.querySelector('.kv-key').focus();
  }
  
  return row;
}

// TASK: Delete key-value row
handleKeyValueDelete(event, type) {
  const row = event.target.closest('.kv-row');
  const container = row.parentElement;
  
  // Don't delete if it's the last row
  const remainingRows = container.querySelectorAll('.kv-row:not(.kv-header)').length;
  if (remainingRows <= 1) {
    // Just clear the values
    row.querySelector('.kv-key').value = '';
    row.querySelector('.kv-value').value = '';
    return;
  }
  
  // Animate removal
  row.style.opacity = '0';
  row.style.transform = 'translateX(-20px)';
  
  setTimeout(() => {
    row.remove();
    this.updateKeyValueData(type);
    this.reindexRows(container);
  }, 200);
}

// TASK: Toggle key-value row enabled state
handleKeyValueToggle(event, type) {
  const row = event.target.closest('.kv-row');
  const enabled = event.target.checked;
  
  // Visual feedback
  if (enabled) {
    row.classList.remove('disabled');
  } else {
    row.classList.add('disabled');
  }
  
  this.updateKeyValueData(type);
}

// TASK: Update row indices after deletion
reindexRows(container) {
  const rows = container.querySelectorAll('.kv-row:not(.kv-header)');
  rows.forEach((row, index) => {
    row.dataset.rowIndex = index;
  });
}

// TASK: Show header suggestions
showHeaderSuggestions(input) {
  const suggestions = [
    'Accept',
    'Accept-Encoding',
    'Accept-Language',
    'Authorization',
    'Cache-Control',
    'Content-Type',
    'Cookie',
    'Host',
    'Origin',
    'Referer',
    'User-Agent',
    'X-API-Key',
    'X-Auth-Token',
    'X-CSRF-Token',
    'X-Requested-With'
  ];
  
  const value = input.value.toLowerCase();
  const matches = suggestions.filter(s => 
    s.toLowerCase().startsWith(value) && s.toLowerCase() !== value
  );
  
  if (matches.length === 0 || !value) {
    this.hideSuggestions();
    return;
  }
  
  this.showSuggestions(input, matches);
}

// TASK: Show autocomplete suggestions
showSuggestions(input, suggestions) {
  // Remove existing suggestions
  this.hideSuggestions();
  
  const dropdown = document.createElement('div');
  dropdown.className = 'suggestions-dropdown';
  dropdown.style.cssText = `
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    background: var(--color-card-dark);
    border: 1px solid var(--color-border-light);
    border-radius: 4px;
    margin-top: 2px;
    max-height: 200px;
    overflow-y: auto;
    z-index: 1000;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
  `;
  
  suggestions.forEach((suggestion, index) => {
    const item = document.createElement('div');
    item.className = 'suggestion-item';
    item.textContent = suggestion;
    item.style.cssText = `
      padding: 8px 12px;
      cursor: pointer;
      color: #cccccc;
      font-size: 12px;
    `;
    
    item.addEventListener('mouseenter', () => {
      item.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
    });
    
    item.addEventListener('mouseleave', () => {
      item.style.backgroundColor = 'transparent';
    });
    
    item.addEventListener('click', () => {
      input.value = suggestion;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      this.hideSuggestions();
      
      // Focus on value input
      const valueInput = input.parentElement.querySelector('.kv-value');
      if (valueInput) valueInput.focus();
    });
    
    dropdown.appendChild(item);
  });
  
  // Position relative to input
  const inputContainer = input.parentElement;
  inputContainer.style.position = 'relative';
  inputContainer.appendChild(dropdown);
  
  // Handle keyboard navigation
  this.setupSuggestionKeyboardNav(input, dropdown);
}

// TASK: Hide autocomplete suggestions
hideSuggestions() {
  const existing = document.querySelector('.suggestions-dropdown');
  if (existing) existing.remove();
}

// TASK: Setup keyboard navigation for suggestions
setupSuggestionKeyboardNav(input, dropdown) {
  let selectedIndex = -1;
  const items = dropdown.querySelectorAll('.suggestion-item');
  
  const selectItem = (index) => {
    items.forEach((item, i) => {
      if (i === index) {
        item.style.backgroundColor = 'rgba(59, 130, 246, 0.2)';
        item.scrollIntoView({ block: 'nearest' });
      } else {
        item.style.backgroundColor = 'transparent';
      }
    });
  };
  
  input.addEventListener('keydown', (e) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
        selectItem(selectedIndex);
        break;
        
      case 'ArrowUp':
        e.preventDefault();
        selectedIndex = Math.max(selectedIndex - 1, -1);
        selectItem(selectedIndex);
        break;
        
      case 'Enter':
        if (selectedIndex >= 0) {
          e.preventDefault();
          items[selectedIndex].click();
        }
        break;
        
      case 'Escape':
        this.hideSuggestions();
        break;
    }
  });
}

// TASK: Update sidebar UI
updateSidebarUI() {
  const collectionsContent = document.querySelector('.sidebar-content[data-view="collections"]');
  if (collectionsContent) {
    collectionsContent.innerHTML = this.renderCollections();
  }
  
  const historyContent = document.querySelector('.sidebar-content[data-view="history"]');
  if (historyContent) {
    historyContent.innerHTML = this.renderHistory();
  }
}

// TASK: Update history UI
updateHistoryUI() {
  const historyContainer = document.querySelector('#apicarus-history');
  if (historyContainer) {
    historyContainer.innerHTML = this.renderHistory();
    
    // Add click handlers for history items
    historyContainer.querySelectorAll('.history-item').forEach(item => {
      item.addEventListener('click', () => {
        const data = JSON.parse(item.dataset.history);
        this.loadHistoryItem(data);
      });
    });
  }
}

// TASK: Load history item into UI
loadHistoryItem(historyData) {
  document.getElementById('apicarus-method').value = historyData.method;
  document.getElementById('apicarus-url').value = historyData.url;
  
  if (historyData.headers) {
    this.switchTab('headers');
    this.applyHeadersToUI(historyData.headers);
  }
  
  if (historyData.params) {
    this.switchTab('params');
    this.applyParamsToUI(historyData.params);
  }
  
  UI.showNotification({
    type: 'info',
    title: 'History Loaded',
    message: 'Request loaded from history'
  });
}

// TASK: Apply headers to UI
applyHeadersToUI(headers) {
  const container = document.getElementById('apicarus-headers-list');
  if (!container) return;
  
  // Clear existing rows except header
  container.querySelectorAll('.kv-row:not(.kv-header)').forEach(row => row.remove());
  
  // Add header rows
  Object.entries(headers).forEach(([key, value]) => {
    this.addKeyValueRow('headers', container, { key, value, enabled: true });
  });
  
  // Add empty row for new entries
  this.addKeyValueRow('headers', container);
}

// TASK: Apply params to UI
applyParamsToUI(params) {
  const container = document.getElementById('apicarus-params-list');
  if (!container) return;
  
  // Clear existing rows except header
  container.querySelectorAll('.kv-row:not(.kv-header)').forEach(row => row.remove());
  
  // Add param rows
  Object.entries(params).forEach(([key, value]) => {
    this.addKeyValueRow('params', container, { key, value, enabled: true });
  });
  
  // Add empty row for new entries
  this.addKeyValueRow('params', container);
}
```

## Task 2.2: Tab System DOM Management

### File: `index.js` - Tab Management

```javascript
// TASK: Implement tab content rendering
renderTabContent(tab) {
  switch (tab) {
    case 'params':
      return this.renderParamsTab();
    case 'headers':
      return this.renderHeadersTab();
    case 'body':
      return this.renderBodyTab();
    case 'auth':
      return this.renderAuthTab();
    default:
      return '<div>Unknown tab</div>';
  }
}

// TASK: Render params tab
renderParamsTab() {
  const params = this.parsedUrlParams || {};
  const paramsList = Object.entries(params).map(([key, value]) => ({
    key,
    value,
    enabled: true
  }));
  
  return `
    <div class="tab-panel">
      <div class="tab-description">
        Query parameters are automatically parsed from the URL. You can also add custom parameters below.
      </div>
      <div id="apicarus-params-list" class="key-value-editor">
        ${this.renderKeyValueRows('params', paramsList)}
      </div>
      <button class="btn btn-ghost" onclick="Alexandria.plugins.get('apicarus').addParam()">
        <i class="fa-solid fa-plus"></i>
        Add Parameter
      </button>
    </div>
  `;
}

// TASK: Render headers tab
renderHeadersTab() {
  const defaultHeaders = [
    { key: 'Content-Type', value: 'application/json', enabled: true }
  ];
  
  return `
    <div class="tab-panel">
      <div class="tab-description">
        HTTP headers let you pass additional information with your request.
      </div>
      <div id="apicarus-headers-list" class="key-value-editor">
        ${this.renderKeyValueRows('headers', defaultHeaders)}
      </div>
      <button class="btn btn-ghost" onclick="Alexandria.plugins.get('apicarus').addHeader()">
        <i class="fa-solid fa-plus"></i>
        Add Header
      </button>
      <div style="margin-top: 16px;">
        <button class="btn btn-secondary" onclick="Alexandria.plugins.get('apicarus').addCommonHeaders()">
          <i class="fa-solid fa-wand-magic-sparkles"></i>
          Add Common Headers
        </button>
      </div>
    </div>
  `;
}

// TASK: Render body tab
renderBodyTab() {
  return `
    <div class="tab-panel">
      <div class="body-type-selector">
        <label class="body-type-tab active" data-body-type="none">
          <input type="radio" name="body-type" value="none" checked>
          None
        </label>
        <label class="body-type-tab" data-body-type="json">
          <input type="radio" name="body-type" value="json">
          JSON
        </label>
        <label class="body-type-tab" data-body-type="form-data">
          <input type="radio" name="body-type" value="form-data">
          Form Data
        </label>
        <label class="body-type-tab" data-body-type="raw">
          <input type="radio" name="body-type" value="raw">
          Raw
        </label>
        <label class="body-type-tab" data-body-type="binary">
          <input type="radio" name="body-type" value="binary">
          Binary
        </label>
      </div>
      
      <div id="body-content">
        ${this.renderBodyContent('none')}
      </div>
    </div>
  `;
}

// TASK: Render body content based on type
renderBodyContent(type) {
  switch (type) {
    case 'none':
      return '<div class="empty-state">This request does not have a body</div>';
      
    case 'json':
      return `
        <div class="json-editor-container">
          <div class="editor-toolbar">
            <button class="btn btn-ghost" onclick="Alexandria.plugins.get('apicarus').beautifyJSON()">
              <i class="fa-solid fa-indent"></i>
              Beautify
            </button>
            <button class="btn btn-ghost" onclick="Alexandria.plugins.get('apicarus').minifyJSON()">
              <i class="fa-solid fa-compress"></i>
              Minify
            </button>
          </div>
          <textarea 
            id="apicarus-body-json" 
            class="code-editor"
            placeholder='{\n  "key": "value"\n}'
            spellcheck="false"
          ></textarea>
          <div class="editor-status">
            <span id="json-status" class="status-indicator"></span>
          </div>
        </div>
      `;
      
    case 'form-data':
      return `
        <div id="apicarus-formdata-list" class="key-value-editor">
          ${this.renderFormDataRows()}
        </div>
        <button class="btn btn-ghost" onclick="Alexandria.plugins.get('apicarus').addFormDataRow()">
          <i class="fa-solid fa-plus"></i>
          Add Field
        </button>
      `;
      
    case 'raw':
      return `
        <div class="raw-editor-container">
          <select id="apicarus-raw-type" class="search-input" style="width: 200px; margin-bottom: 8px;">
            <option value="text/plain">Text</option>
            <option value="application/javascript">JavaScript</option>
            <option value="application/xml">XML</option>
            <option value="text/html">HTML</option>
          </select>
          <textarea 
            id="apicarus-body-raw" 
            class="code-editor"
            placeholder="Enter raw content..."
            spellcheck="false"
          ></textarea>
        </div>
      `;
      
    case 'binary':
      return `
        <div class="file-upload-container">
          <input 
            type="file" 
            id="apicarus-body-binary" 
            class="file-input"
            style="display: none;"
          >
          <label for="apicarus-body-binary" class="file-upload-label">
            <i class="fa-solid fa-upload"></i>
            <span>Choose file...</span>
          </label>
          <div id="selected-file" class="selected-file"></div>
        </div>
      `;
      
    default:
      return '';
  }
}

// TASK: Render auth tab
renderAuthTab() {
  return `
    <div class="tab-panel">
      <div class="auth-type-selector">
        <select id="apicarus-auth-type" class="search-input" onchange="Alexandria.plugins.get('apicarus').changeAuthType(this.value)">
          <option value="none">No Auth</option>
          <option value="bearer">Bearer Token</option>
          <option value="basic">Basic Auth</option>
          <option value="apikey">API Key</option>
          <option value="oauth2">OAuth 2.0</option>
        </select>
      </div>
      
      <div id="auth-content">
        ${this.renderAuthContent('none')}
      </div>
    </div>
  `;
}

// TASK: Render auth content based on type
renderAuthContent(type) {
  switch (type) {
    case 'none':
      return '<div class="empty-state">This request does not use any authorization</div>';
      
    case 'bearer':
      return `
        <div class="auth-form">
          <div class="form-group">
            <label>Token</label>
            <input 
              type="text" 
              id="auth-bearer-token" 
              class="search-input" 
              placeholder="Enter bearer token..."
            >
          </div>
          <div class="auth-preview">
            <label>Header Preview</label>
            <code>Authorization: Bearer &lt;token&gt;</code>
          </div>
        </div>
      `;
      
    case 'basic':
      return `
        <div class="auth-form">
          <div class="form-group">
            <label>Username</label>
            <input 
              type="text" 
              id="auth-basic-username" 
              class="search-input" 
              placeholder="Username"
            >
          </div>
          <div class="form-group">
            <label>Password</label>
            <input 
              type="password" 
              id="auth-basic-password" 
              class="search-input" 
              placeholder="Password"
            >
          </div>
          <div class="auth-preview">
            <label>Header Preview</label>
            <code>Authorization: Basic &lt;base64&gt;</code>
          </div>
        </div>
      `;
      
    case 'apikey':
      return `
        <div class="auth-form">
          <div class="form-group">
            <label>Add to</label>
            <select id="auth-apikey-location" class="search-input">
              <option value="header">Header</option>
              <option value="query">Query Params</option>
            </select>
          </div>
          <div class="form-group">
            <label>Key Name</label>
            <input 
              type="text" 
              id="auth-apikey-name" 
              class="search-input" 
              placeholder="X-API-Key"
              value="X-API-Key"
            >
          </div>
          <div class="form-group">
            <label>Value</label>
            <input 
              type="text" 
              id="auth-apikey-value" 
              class="search-input" 
              placeholder="Enter API key..."
            >
          </div>
        </div>
      `;
      
    case 'oauth2':
      return `
        <div class="auth-form">
          <div class="oauth-notice">
            <i class="fa-solid fa-info-circle"></i>
            OAuth 2.0 configuration coming soon. For now, manually add the Authorization header.
          </div>
          <button class="btn btn-primary">
            <i class="fa-solid fa-key"></i>
            Configure OAuth 2.0
          </button>
        </div>
      `;
      
    default:
      return '';
  }
}

// TASK: Attach tab event listeners
attachTabEventListeners(tab) {
  const tabContent = document.getElementById('apicarus-tabContent');
  
  switch (tab) {
    case 'params':
      const paramsList = tabContent.querySelector('#apicarus-params-list');
      if (paramsList) {
        this.attachKeyValueListeners(paramsList, 'params');
      }
      break;
      
    case 'headers':
      const headersList = tabContent.querySelector('#apicarus-headers-list');
      if (headersList) {
        this.attachKeyValueListeners(headersList, 'headers');
      }
      break;
      
    case 'body':
      this.attachBodyListeners();
      break;
      
    case 'auth':
      this.attachAuthListeners();
      break;
  }
}

// TASK: Attach body tab listeners
attachBodyListeners() {
  // Body type selector
  const bodyTypeInputs = document.querySelectorAll('input[name="body-type"]');
  bodyTypeInputs.forEach(input => {
    input.addEventListener('change', (e) => {
      this.changeBodyType(e.target.value);
    });
  });
  
  // JSON editor
  const jsonEditor = document.getElementById('apicarus-body-json');
  if (jsonEditor) {
    jsonEditor.addEventListener('input', () => this.validateJSON());
  }
  
  // File input
  const fileInput = document.getElementById('apicarus-body-binary');
  if (fileInput) {
    fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
  }
}

// TASK: Change body type
changeBodyType(type) {
  // Update active tab
  document.querySelectorAll('.body-type-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.bodyType === type);
  });
  
  // Update content
  const bodyContent = document.getElementById('body-content');
  if (bodyContent) {
    bodyContent.innerHTML = this.renderBodyContent(type);
    
    // Re-attach listeners for new content
    if (type === 'json') {
      const jsonEditor = document.getElementById('apicarus-body-json');
      if (jsonEditor) {
        jsonEditor.addEventListener('input', () => this.validateJSON());
      }
    } else if (type === 'form-data') {
      const formDataList = document.getElementById('apicarus-formdata-list');
      if (formDataList) {
        this.attachKeyValueListeners(formDataList, 'form-data');
      }
    }
  }
}

// TASK: Validate JSON in editor
validateJSON() {
  const editor = document.getElementById('apicarus-body-json');
  const status = document.getElementById('json-status');
  
  if (!editor || !status) return;
  
  const value = editor.value.trim();
  if (!value) {
    status.textContent = '';
    status.className = 'status-indicator';
    return;
  }
  
  try {
    JSON.parse(value);
    status.textContent = 'Valid JSON';
    status.className = 'status-indicator valid';
    editor.classList.remove('error');
  } catch (error) {
    status.textContent = `Invalid JSON: ${error.message}`;
    status.className = 'status-indicator invalid';
    editor.classList.add('error');
  }
}

// TASK: Beautify JSON
beautifyJSON() {
  const editor = document.getElementById('apicarus-body-json');
  if (!editor) return;
  
  try {
    const json = JSON.parse(editor.value);
    editor.value = JSON.stringify(json, null, 2);
    this.validateJSON();
  } catch (error) {
    UI.showNotification({
      type: 'error',
      title: 'Invalid JSON',
      message: 'Cannot beautify invalid JSON'
    });
  }
}

// TASK: Minify JSON
minifyJSON() {
  const editor = document.getElementById('apicarus-body-json');
  if (!editor) return;
  
  try {
    const json = JSON.parse(editor.value);
    editor.value = JSON.stringify(json);
    this.validateJSON();
  } catch (error) {
    UI.showNotification({
      type: 'error',
      title: 'Invalid JSON',
      message: 'Cannot minify invalid JSON'
    });
  }
}
```

---

# 3. Connect Event Handlers

## Task 3.1: Global Event Handling

### File: `index.js` - Event Handler Setup

```javascript
// TASK: Setup all event listeners
setupEventListeners() {
  // Keyboard shortcuts
  document.addEventListener('keydown', this.handleKeyboardShortcuts.bind(this));
  
  // URL input handling
  const urlInput = document.getElementById('apicarus-url');
  if (urlInput) {
    urlInput.addEventListener('input', (e) => this.handleUrlChange(e.target.value));
    urlInput.addEventListener('paste', (e) => {
      setTimeout(() => this.handleUrlChange(e.target.value), 0);
    });
  }
  
  // Method selector
  const methodSelect = document.getElementById('apicarus-method');
  if (methodSelect) {
    methodSelect.addEventListener('change', (e) => this.handleMethodChange(e.target.value));
  }
  
  // Window resize
  window.addEventListener('resize', this.handleResize.bind(this));
  
  // Click outside to close dropdowns
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.suggestions-dropdown') && !e.target.matches('.kv-key')) {
      this.hideSuggestions();
    }
  });
  
  // Environment variable hints
  document.addEventListener('focus', (e) => {
    if (e.target.matches('input[type="text"], textarea')) {
      this.checkForVariableHints(e.target);
    }
  }, true);
  
  // Collection drag and drop
  this.setupCollectionDragDrop();
  
  // Response actions
  this.setupResponseActions();
}

// TASK: Remove event listeners on deactivation
removeEventListeners() {
  document.removeEventListener('keydown', this.handleKeyboardShortcuts);
  window.removeEventListener('resize', this.handleResize);
  
  // Remove all delegated listeners
  const containers = document.querySelectorAll('.key-value-editor');
  containers.forEach(container => {
    container.replaceWith(container.cloneNode(true));
  });
}

// TASK: Check for environment variable hints
checkForVariableHints(input) {
  if (!this.environmentManager.activeEnvironment) return;
  
  input.addEventListener('input', (e) => {
    const value = e.target.value;
    const match = value.match(/\{\{(\w*)$/);
    
    if (match) {
      const partial = match[1];
      const variables = Object.keys(this.environmentManager.activeEnvironment.variables);
      const suggestions = variables.filter(v => 
        v.toLowerCase().startsWith(partial.toLowerCase())
      );
      
      if (suggestions.length > 0) {
        this.showVariableSuggestions(input, suggestions, match.index);
      }
    }
  });
}

// TASK: Show variable suggestions
showVariableSuggestions(input, variables, startIndex) {
  const dropdown = document.createElement('div');
  dropdown.className = 'variable-suggestions';
  dropdown.style.cssText = `
    position: absolute;
    background: var(--color-card-dark);
    border: 1px solid var(--color-border-light);
    border-radius: 4px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
    z-index: 1000;
    max-height: 200px;
    overflow-y: auto;
  `;
  
  variables.forEach(variable => {
    const item = document.createElement('div');
    item.className = 'variable-item';
    item.style.cssText = `
      padding: 8px 12px;
      cursor: pointer;
      display: flex;
      justify-content: space-between;
      align-items: center;
    `;
    
    const name = document.createElement('span');
    name.textContent = `{{${variable}}}`;
    name.style.color = '#3b82f6';
    
    const value = document.createElement('span');
    value.textContent = this.environmentManager.activeEnvironment.variables[variable];
    value.style.cssText = `
      color: #6b6b6b;
      font-size: 11px;
      margin-left: 12px;
      max-width: 200px;
      overflow: hidden;
      text-overflow: ellipsis;
    `;
    
    item.appendChild(name);
    item.appendChild(value);
    
    item.addEventListener('click', () => {
      const currentValue = input.value;
      const beforeMatch = currentValue.substring(0, startIndex);
      const afterMatch = currentValue.substring(input.selectionStart);
      input.value = beforeMatch + `{{${variable}}}` + afterMatch;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      dropdown.remove();
    });
    
    dropdown.appendChild(item);
  });
  
  // Position dropdown
  const rect = input.getBoundingClientRect();
  dropdown.style.top = `${rect.bottom + 2}px`;
  dropdown.style.left = `${rect.left}px`;
  dropdown.style.width = `${rect.width}px`;
  
  document.body.appendChild(dropdown);
  
  // Remove on click outside
  const removeDropdown = (e) => {
    if (!dropdown.contains(e.target) && e.target !== input) {
      dropdown.remove();
      document.removeEventListener('click', removeDropdown);
    }
  };
  
  setTimeout(() => {
    document.addEventListener('click', removeDropdown);
  }, 0);
}

// TASK: Setup collection drag and drop
setupCollectionDragDrop() {
  let draggedItem = null;
  
  document.addEventListener('dragstart', (e) => {
    if (e.target.matches('.collection-item, .request-item')) {
      draggedItem = e.target;
      e.target.style.opacity = '0.5';
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/html', e.target.innerHTML);
    }
  });
  
  document.addEventListener('dragend', (e) => {
    if (e.target.matches('.collection-item, .request-item')) {
      e.target.style.opacity = '';
    }
  });
  
  document.addEventListener('dragover', (e) => {
    if (e.target.matches('.collection-item, .collection-folder')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      
      const afterElement = this.getDragAfterElement(e.target.parentElement, e.clientY);
      if (afterElement == null) {
        e.target.parentElement.appendChild(draggedItem);
      } else {
        e.target.parentElement.insertBefore(draggedItem, afterElement);
      }
    }
  });
  
  document.addEventListener('drop', (e) => {
    if (e.target.matches('.collection-item, .collection-folder')) {
      e.preventDefault();
      
      // Update collection order in data model
      this.updateCollectionOrder();
    }
  });
}

// TASK: Get element after drag position
getDragAfterElement(container, y) {
  const draggableElements = [...container.querySelectorAll('.collection-item:not(.dragging)')];
  
  return draggableElements.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    
    if (offset < 0 && offset > closest.offset) {
      return { offset: offset, element: child };
    } else {
      return closest;
    }
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

// TASK: Setup response action buttons
setupResponseActions() {
  // Copy response
  document.addEventListener('click', (e) => {
    if (e.target.matches('[data-action="copy-response"]')) {
      this.copyResponse();
    }
  });
  
  // Download response
  document.addEventListener('click', (e) => {
    if (e.target.matches('[data-action="download-response"]')) {
      this.downloadResponse();
    }
  });
  
  // Save to collection
  document.addEventListener('click', (e) => {
    if (e.target.matches('[data-action="save-response"]')) {
      this.saveResponseToCollection();
    }
  });
}

// TASK: Handle window resize
handleResize() {
  // Adjust layout for responsive design
  const width = window.innerWidth;
  
  if (width < 768) {
    // Mobile layout
    document.body.classList.add('mobile-layout');
  } else {
    document.body.classList.remove('mobile-layout');
  }
  
  // Recalculate dropdown positions
  this.hideSuggestions();
}

// TASK: Handle keyboard shortcuts with proper context
handleKeyboardShortcuts(e) {
  // Don't trigger shortcuts when typing in inputs (unless it's Cmd/Ctrl combinations)
  const isTyping = ['INPUT', 'TEXTAREA'].includes(e.target.tagName) && 
                   !e.metaKey && !e.ctrlKey;
  if (isTyping) return;
  
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const cmdKey = isMac ? e.metaKey : e.ctrlKey;
  
  // Cmd+Enter - Send request
  if (cmdKey && e.key === 'Enter') {
    e.preventDefault();
    this.sendRequest();
    return;
  }
  
  // Cmd+S - Save request
  if (cmdKey && e.key === 's') {
    e.preventDefault();
    this.saveCurrentRequest();
    return;
  }
  
  // Cmd+D - Duplicate request
  if (cmdKey && e.key === 'd') {
    e.preventDefault();
    this.duplicateCurrentRequest();
    return;
  }
  
  // Cmd+K - Focus URL bar
  if (cmdKey && e.key === 'k') {
    e.preventDefault();
    document.getElementById('apicarus-url')?.focus();
    return;
  }
  
  // Tab navigation with Cmd+1-4
  if (cmdKey && e.key >= '1' && e.key <= '4') {
    e.preventDefault();
    const tabs = ['params', 'headers', 'body', 'auth'];
    const tabIndex = parseInt(e.key) - 1;
    if (tabs[tabIndex]) {
      this.switchTab(tabs[tabIndex]);
    }
    return;
  }
  
  // Escape - Close modals/dropdowns
  if (e.key === 'Escape') {
    this.hideSuggestions();
    const activeModal = document.querySelector('.modal.active');
    if (activeModal) {
      UI.closeModal();
    }
  }
}

// TASK: Setup request form validation
setupFormValidation() {
  const urlInput = document.getElementById('apicarus-url');
  
  if (urlInput) {
    urlInput.addEventListener('blur', () => {
      const value = urlInput.value.trim();
      
      if (value && !this.isValidUrl(value)) {
        urlInput.classList.add('error');
        this.showFieldError(urlInput, 'Please enter a valid URL');
      } else {
        urlInput.classList.remove('error');
        this.hideFieldError(urlInput);
      }
    });
  }
}

// TASK: Validate URL format
isValidUrl(string) {
  try {
    new URL(string);
    return true;
  } catch {
    // Try with a base URL for relative paths
    try {
      new URL(string, 'http://example.com');
      return true;
    } catch {
      return false;
    }
  }
}

// TASK: Show field error
showFieldError(field, message) {
  const existing = field.parentElement.querySelector('.field-error');
  if (existing) existing.remove();
  
  const error = document.createElement('div');
  error.className = 'field-error';
  error.textContent = message;
  error.style.cssText = `
    color: var(--color-danger);
    font-size: 11px;
    margin-top: 4px;
  `;
  
  field.parentElement.appendChild(error);
}

// TASK: Hide field error
hideFieldError(field) {
  const error = field.parentElement.querySelector('.field-error');
  if (error) error.remove();
}
```

---

# 4. Implement Network Layer

## Task 4.1: HTTP Request Implementation

### File: `src/services/NetworkService.js` (New File)

```javascript
import { Network } from 'alexandria-sdk';

export class NetworkService {
  constructor(plugin) {
    this.plugin = plugin;
    this.activeRequests = new Map();
  }
  
  // TASK: Make HTTP request with full configuration
  async request(url, config = {}) {
    const requestId = this.generateRequestId();
    const abortController = new AbortController();
    
    // Store active request for cancellation
    this.activeRequests.set(requestId, abortController);
    
    try {
      // Build request options
      const options = this.buildRequestOptions(config, abortController.signal);
      
      // Add timing marks
      const startTime = performance.now();
      const timingMarks = {
        start: startTime,
        dnsStart: 0,
        dnsEnd: 0,
        connectStart: 0,
        connectEnd: 0,
        requestStart: 0,
        responseStart: 0,
        responseEnd: 0
      };
      
      // Make the request
      const response = await this.performRequest(url, options, timingMarks);
      
      // Process response
      const processedResponse = await this.processResponse(response, timingMarks);
      
      // Clean up
      this.activeRequests.delete(requestId);
      
      return processedResponse;
      
    } catch (error) {
      this.activeRequests.delete(requestId);
      throw this.enhanceError(error);
    }
  }
  
  // TASK: Build request options
  buildRequestOptions(config, signal) {
    const options = {
      method: config.method || 'GET',
      headers: this.buildHeaders(config.headers),
      signal,
      redirect: config.followRedirect === false ? 'manual' : 'follow',
      credentials: config.credentials || 'same-origin'
    };
    
    // Add timeout
    if (config.timeout) {
      setTimeout(() => signal.abort(), config.timeout);
    }
    
    // Add body for appropriate methods
    if (config.body && ['POST', 'PUT', 'PATCH'].includes(options.method)) {
      options.body = this.prepareRequestBody(config.body, options.headers);
    }
    
    // Handle authentication
    if (config.auth) {
      this.applyAuthentication(options, config.auth);
    }
    
    return options;
  }
  
  // TASK: Build headers object
  buildHeaders(headers = {}) {
    const defaultHeaders = {
      'User-Agent': 'API-Forge/1.0.0 (Alexandria Platform)'
    };
    
    // Merge with user headers
    const mergedHeaders = { ...defaultHeaders, ...headers };
    
    // Remove undefined values
    Object.keys(mergedHeaders).forEach(key => {
      if (mergedHeaders[key] === undefined || mergedHeaders[key] === null) {
        delete mergedHeaders[key];
      }
    });
    
    return mergedHeaders;
  }
  
  // TASK: Prepare request body
  prepareRequestBody(body, headers) {
    // FormData - return as is
    if (body instanceof FormData) {
      // Remove Content-Type to let browser set boundary
      delete headers['Content-Type'];
      return body;
    }
    
    // File/Blob - return as is
    if (body instanceof File || body instanceof Blob) {
      return body;
    }
    
    // String - return as is
    if (typeof body === 'string') {
      return body;
    }
    
    // Object - stringify as JSON
    if (typeof body === 'object') {
      headers['Content-Type'] = headers['Content-Type'] || 'application/json';
      return JSON.stringify(body);
    }
    
    return body;
  }
  
  // TASK: Apply authentication to request
  applyAuthentication(options, auth) {
    switch (auth.type) {
      case 'bearer':
        options.headers['Authorization'] = `Bearer ${auth.token}`;
        break;
        
      case 'basic':
        const credentials = btoa(`${auth.username}:${auth.password}`);
        options.headers['Authorization'] = `Basic ${credentials}`;
        break;
        
      case 'apikey':
        if (auth.addTo === 'header') {
          options.headers[auth.key] = auth.value;
        }
        // Query params handled elsewhere
        break;
        
      case 'oauth2':
        if (auth.accessToken) {
          options.headers['Authorization'] = `Bearer ${auth.accessToken}`;
        }
        break;
    }
  }
  
  // TASK: Perform the actual request
  async performRequest(url, options, timingMarks) {
    // Use Alexandria's Network API if available
    if (Network && Network.request) {
      return Network.request(url, options);
    }
    
    // Fallback to fetch
    timingMarks.requestStart = performance.now();
    
    const response = await fetch(url, options);
    
    timingMarks.responseStart = performance.now();
    
    return response;
  }
  
  // TASK: Process response
  async processResponse(response, timingMarks) {
    const processed = {
      status: response.status,
      statusText: response.statusText,
      headers: this.parseHeaders(response.headers),
      url: response.url,
      redirected: response.redirected,
      type: response.type
    };
    
    // Parse body based on content type
    const contentType = processed.headers['content-type'] || '';
    
    try {
      if (contentType.includes('application/json')) {
        processed.data = await response.json();
      } else if (contentType.includes('text/')) {
        processed.data = await response.text();
      } else if (contentType.includes('image/')) {
        processed.data = await response.arrayBuffer();
      } else if (contentType.includes('application/xml')) {
        processed.data = await response.text();
      } else {
        // Default to array buffer for binary data
        processed.data = await response.arrayBuffer();
      }
    } catch (error) {
      // If body parsing fails, try to get as text
      try {
        processed.data = await response.text();
      } catch {
        processed.data = null;
      }
    }
    
    timingMarks.responseEnd = performance.now();
    
    // Calculate sizes
    processed.size = this.calculateResponseSize(processed);
    
    // Add timing information
    processed.timing = {
      total: timingMarks.responseEnd - timingMarks.start,
      dns: timingMarks.dnsEnd - timingMarks.dnsStart,
      connect: timingMarks.connectEnd - timingMarks.connectStart,
      request: timingMarks.responseStart - timingMarks.requestStart,
      response: timingMarks.responseEnd - timingMarks.responseStart
    };
    
    return processed;
  }
  
  // TASK: Parse headers
  parseHeaders(headers) {
    const parsed = {};
    
    if (headers instanceof Headers) {
      headers.forEach((value, key) => {
        parsed[key.toLowerCase()] = value;
      });
    } else if (typeof headers === 'object') {
      Object.entries(headers).forEach(([key, value]) => {
        parsed[key.toLowerCase()] = value;
      });
    }
    
    return parsed;
  }
  
  // TASK: Calculate response size
  calculateResponseSize(response) {
    let size = 0;
    
    // Estimate header size
    Object.entries(response.headers).forEach(([key, value]) => {
      size += key.length + value.length + 4; // ": " and "\r\n"
    });
    
    // Add status line
    size += response.status.toString().length + response.statusText.length + 12;
    
    // Add body size
    if (response.data) {
      if (typeof response.data === 'string') {
        size += new Blob([response.data]).size;
      } else if (response.data instanceof ArrayBuffer) {
        size += response.data.byteLength;
      } else {
        size += new Blob([JSON.stringify(response.data)]).size;
      }
    }
    
    return size;
  }
  
  // TASK: Enhance error with additional information
  enhanceError(error) {
    const enhanced = new Error(error.message);
    enhanced.code = error.code || 'UNKNOWN_ERROR';
    enhanced.originalError = error;
    
    // Add network-specific error codes
    if (error.name === 'AbortError') {
      enhanced.code = 'REQUEST_ABORTED';
      enhanced.message = 'Request was cancelled';
    } else if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
      enhanced.code = 'NETWORK_ERROR';
      enhanced.message = 'Network error - could not connect to server';
    } else if (error.message.includes('timeout')) {
      enhanced.code = 'TIMEOUT';
      enhanced.message = 'Request timed out';
    }
    
    return enhanced;
  }
  
  // TASK: Cancel request
  cancelRequest(requestId) {
    const controller = this.activeRequests.get(requestId);
    if (controller) {
      controller.abort();
      this.activeRequests.delete(requestId);
    }
  }
  
  // TASK: Cancel all active requests
  cancelAllRequests() {
    this.activeRequests.forEach(controller => controller.abort());
    this.activeRequests.clear();
  }
  
  // TASK: Generate unique request ID
  generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// TASK: Request interceptor system
export class RequestInterceptor {
  constructor() {
    this.interceptors = [];
  }
  
  use(interceptor) {
    this.interceptors.push(interceptor);
    return () => {
      const index = this.interceptors.indexOf(interceptor);
      if (index !== -1) {
        this.interceptors.splice(index, 1);
      }
    };
  }
  
  async processRequest(config) {
    let processedConfig = config;
    
    for (const interceptor of this.interceptors) {
      if (interceptor.request) {
        processedConfig = await interceptor.request(processedConfig);
      }
    }
    
    return processedConfig;
  }
  
  async processResponse(response) {
    let processedResponse = response;
    
    for (const interceptor of this.interceptors) {
      if (interceptor.response) {
        processedResponse = await interceptor.response(processedResponse);
      }
    }
    
    return processedResponse;
  }
  
  async processError(error) {
    let processedError = error;
    
    for (const interceptor of this.interceptors) {
      if (interceptor.error) {
        processedError = await interceptor.error(processedError);
      }
    }
    
    return processedError;
  }
}
```

## Task 4.2: WebSocket Implementation

### File: `src/services/WebSocketService.js` (New File)

```javascript
export class WebSocketService {
  constructor(plugin) {
    this.plugin = plugin;
    this.connections = new Map();
  }
  
  // TASK: Create WebSocket connection
  connect(url, options = {}) {
    const connectionId = this.generateConnectionId();
    
    const ws = new WebSocket(url, options.protocols);
    
    const connection = {
      id: connectionId,
      url,
      ws,
      status: 'connecting',
      messages: [],
      listeners: new Map(),
      created: new Date()
    };
    
    this.setupEventHandlers(connection);
    this.connections.set(connectionId, connection);
    
    return connectionId;
  }
  
  // TASK: Setup WebSocket event handlers
  setupEventHandlers(connection) {
    const { ws } = connection;
    
    ws.onopen = (event) => {
      connection.status = 'connected';
      connection.connectedAt = new Date();
      this.notifyListeners(connection.id, 'open', event);
      this.updateUI(connection.id);
    };
    
    ws.onmessage = (event) => {
      const message = {
        type: 'received',
        data: event.data,
        timestamp: new Date(),
        size: event.data.length
      };
      
      connection.messages.push(message);
      this.notifyListeners(connection.id, 'message', message);
      this.updateUI(connection.id);
    };
    
    ws.onerror = (event) => {
      connection.status = 'error';
      this.notifyListeners(connection.id, 'error', event);
      this.updateUI(connection.id);
    };
    
    ws.onclose = (event) => {
      connection.status = 'closed';
      connection.closedAt = new Date();
      connection.closeCode = event.code;
      connection.closeReason = event.reason;
      
      this.notifyListeners(connection.id, 'close', event);
      this.updateUI(connection.id);
    };
  }
  
  // TASK: Send WebSocket message
  send(connectionId, data) {
    const connection = this.connections.get(connectionId);
    if (!connection || connection.status !== 'connected') {
      throw new Error('WebSocket is not connected');
    }
    
    connection.ws.send(data);
    
    const message = {
      type: 'sent',
      data,
      timestamp: new Date(),
      size: data.length
    };
    
    connection.messages.push(message);
    this.updateUI(connectionId);
  }
  
  // TASK: Close WebSocket connection
  close(connectionId, code = 1000, reason = '') {
    const connection = this.connections.get(connectionId);
    if (!connection) return;
    
    if (connection.ws.readyState === WebSocket.OPEN) {
      connection.ws.close(code, reason);
    }
    
    this.connections.delete(connectionId);
  }
  
  // TASK: Add event listener
  addEventListener(connectionId, event, callback) {
    const connection = this.connections.get(connectionId);
    if (!connection) return;
    
    if (!connection.listeners.has(event)) {
      connection.listeners.set(event, []);
    }
    
    connection.listeners.get(event).push(callback);
  }
  
  // TASK: Notify listeners
  notifyListeners(connectionId, event, data) {
    const connection = this.connections.get(connectionId);
    if (!connection) return;
    
    const listeners = connection.listeners.get(event) || [];
    listeners.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error('WebSocket listener error:', error);
      }
    });
  }
  
  // TASK: Update UI with connection status
  updateUI(connectionId) {
    const connection = this.connections.get(connectionId);
    if (!connection) return;
    
    // Update connection status indicator
    const statusElement = document.querySelector(`[data-ws-id="${connectionId}"] .ws-status`);
    if (statusElement) {
      statusElement.textContent = connection.status;
      statusElement.className = `ws-status ws-status-${connection.status}`;
    }
    
    // Update message list
    const messagesElement = document.querySelector(`[data-ws-id="${connectionId}"] .ws-messages`);
    if (messagesElement) {
      this.renderMessages(messagesElement, connection.messages);
    }
  }
  
  // TASK: Render WebSocket messages
  renderMessages(container, messages) {
    const lastMessages = messages.slice(-100); // Show last 100 messages
    
    container.innerHTML = lastMessages.map(msg => `
      <div class="ws-message ws-message-${msg.type}">
        <div class="ws-message-header">
          <span class="ws-message-type">${msg.type.toUpperCase()}</span>
          <span class="ws-message-time">${msg.timestamp.toLocaleTimeString()}</span>
          <span class="ws-message-size">${this.formatSize(msg.size)}</span>
        </div>
        <div class="ws-message-data">
          ${this.formatMessageData(msg.data)}
        </div>
      </div>
    `).join('');
    
    // Scroll to bottom
    container.scrollTop = container.scrollHeight;
  }
  
  // TASK: Format message data for display
  formatMessageData(data) {
    try {
      // Try to parse as JSON
      const parsed = JSON.parse(data);
      return `<pre>${JSON.stringify(parsed, null, 2)}</pre>`;
    } catch {
      // Display as text
      return `<pre>${this.escapeHtml(data)}</pre>`;
    }
  }
  
  formatSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
  
  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
  
  generateConnectionId() {
    return `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

---

# 5. Add Real State Management

## Task 5.1: State Management System

### File: `src/services/StateManager.js` (New File)

```javascript
export class StateManager {
  constructor(plugin) {
    this.plugin = plugin;
    this.state = this.getInitialState();
    this.listeners = new Map();
    this.history = [];
    this.historyIndex = -1;
    this.maxHistorySize = 50;
  }
  
  // TASK: Define initial state structure
  getInitialState() {
    return {
      request: {
        method: 'GET',
        url: '',
        headers: {},
        params: {},
        body: null,
        auth: {
          type: 'none',
          credentials: {}
        }
      },
      response: null,
      loading: false,
      error: null,
      activeTab: 'params',
      activeBodyType: 'none',
      activeAuthType: 'none',
      ui: {
        sidebarVisible: true,
        responsePanelVisible: true,
        aiPanelVisible: false,
        commandPaletteVisible: false
      },
      collections: [],
      environments: [],
      activeEnvironment: null,
      history: [],
      favorites: [],
      settings: {
        timeout: 30000,
        followRedirects: true,
        validateSSL: true,
        proxyEnabled: false,
        proxyUrl: ''
      }
    };
  }
  
  // TASK: Get current state
  getState() {
    return this.state;
  }
  
  // TASK: Update state with immutability
  setState(updates, options = {}) {
    const prevState = this.state;
    
    // Deep merge updates
    this.state = this.deepMerge(this.state, updates);
    
    // Add to history if not a history navigation
    if (!options.skipHistory) {
      this.addToHistory(prevState);
    }
    
    // Notify listeners
    this.notifyListeners(updates, prevState);
    
    // Persist to storage if needed
    if (!options.skipPersist) {
      this.persistState();
    }
    
    return this.state;
  }
  
  // TASK: Deep merge objects
  deepMerge(target, source) {
    const output = { ...target };
    
    Object.keys(source).forEach(key => {
      if (source[key] instanceof Object && key in target) {
        output[key] = this.deepMerge(target[key], source[key]);
      } else {
        output[key] = source[key];
      }
    });
    
    return output;
  }
  
  // TASK: Subscribe to state changes
  subscribe(path, callback) {
    if (!this.listeners.has(path)) {
      this.listeners.set(path, []);
    }
    
    this.listeners.get(path).push(callback);
    
    // Return unsubscribe function
    return () => {
      const listeners = this.listeners.get(path);
      const index = listeners.indexOf(callback);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    };
  }
  
  // TASK: Notify listeners of state changes
  notifyListeners(updates, prevState) {
    const changedPaths = this.getChangedPaths(updates, prevState);
    
    changedPaths.forEach(path => {
      const listeners = this.listeners.get(path) || [];
      const value = this.getValueAtPath(this.state, path);
      const prevValue = this.getValueAtPath(prevState, path);
      
      listeners.forEach(callback => {
        try {
          callback(value, prevValue, path);
        } catch (error) {
          console.error('State listener error:', error);
        }
      });
    });
    
    // Notify wildcard listeners
    const wildcardListeners = this.listeners.get('*') || [];
    wildcardListeners.forEach(callback => {
      try {
        callback(this.state, prevState, changedPaths);
      } catch (error) {
        console.error('State listener error:', error);
      }
    });
  }
  
  // TASK: Get changed paths between states
  getChangedPaths(updates, prevState, parentPath = '') {
    const paths = [];
    
    Object.keys(updates).forEach(key => {
      const path = parentPath ? `${parentPath}.${key}` : key;
      const updateValue = updates[key];
      const prevValue = prevState[key];
      
      if (updateValue !== prevValue) {
        paths.push(path);
        
        if (updateValue instanceof Object && prevValue instanceof Object) {
          // Recursively check nested objects
          paths.push(...this.getChangedPaths(updateValue, prevValue, path));
        }
      }
    });
    
    return paths;
  }
  
  // TASK: Get value at path
  getValueAtPath(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }
  
  // TASK: Set value at path
  setValueAtPath(path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    
    const target = keys.reduce((current, key) => {
      if (!current[key]) {
        current[key] = {};
      }
      return current[key];
    }, this.state);
    
    target[lastKey] = value;
    
    this.notifyListeners({ [path]: value }, this.state);
    this.persistState();
  }
  
  // TASK: Add to history for undo/redo
  addToHistory(state) {
    // Remove any states after current index
    this.history = this.history.slice(0, this.historyIndex + 1);
    
    // Add new state
    this.history.push(JSON.parse(JSON.stringify(state)));
    
    // Limit history size
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    } else {
      this.historyIndex++;
    }
  }
  
  // TASK: Undo state change
  undo() {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      const previousState = this.history[this.historyIndex];
      this.setState(previousState, { skipHistory: true });
    }
  }
  
  // TASK: Redo state change
  redo() {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      const nextState = this.history[this.historyIndex];
      this.setState(nextState, { skipHistory: true });
    }
  }
  
  // TASK: Persist state to storage
  async persistState() {
    try {
      const stateToPersist = {
        request: this.state.request,
        activeTab: this.state.activeTab,
        activeBodyType: this.state.activeBodyType,
        activeAuthType: this.state.activeAuthType,
        collections: this.state.collections,
        environments: this.state.environments,
        activeEnvironment: this.state.activeEnvironment,
        favorites: this.state.favorites,
        settings: this.state.settings
      };
      
      await this.plugin.context.storage.set('state', stateToPersist);
    } catch (error) {
      console.error('Failed to persist state:', error);
    }
  }
  
  // TASK: Load state from storage
  async loadState() {
    try {
      const savedState = await this.plugin.context.storage.get('state');
      if (savedState) {
        this.setState(savedState, { skipPersist: true });
      }
    } catch (error) {
      console.error('Failed to load state:', error);
    }
  }
  
  // TASK: Create computed values
  createComputed(name, dependencies, compute) {
    let cachedValue;
    let isStale = true;
    
    // Subscribe to dependencies
    dependencies.forEach(dep => {
      this.subscribe(dep, () => {
        isStale = true;
      });
    });
    
    // Define getter
    Object.defineProperty(this, name, {
      get: () => {
        if (isStale) {
          const depValues = dependencies.map(dep => 
            this.getValueAtPath(this.state, dep)
          );
          cachedValue = compute(...depValues);
          isStale = false;
        }
        return cachedValue;
      }
    });
  }
  
  // TASK: Batch state updates
  batchUpdate(updateFn) {
    const updates = {};
    const batchedSetState = (path, value) => {
      this.setNestedValue(updates, path, value);
    };
    
    updateFn(batchedSetState);
    
    this.setState(updates);
  }
  
  // TASK: Set nested value in object
  setNestedValue(obj, path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    
    const target = keys.reduce((current, key) => {
      if (!current[key]) {
        current[key] = {};
      }
      return current[key];
    }, obj);
    
    target[lastKey] = value;
  }
}

// TASK: Create state selectors
export class StateSelectors {
  static getRequest(state) {
    return state.request;
  }
  
  static getRequestUrl(state) {
    return state.request.url;
  }
  
  static getRequestMethod(state) {
    return state.request.method;
  }
  
  static getRequestHeaders(state) {
    return state.request.headers;
  }
  
  static getActiveEnvironment(state) {
    return state.environments.find(env => env.id === state.activeEnvironment);
  }
  
  static getInterpolatedUrl(state) {
    const env = StateSelectors.getActiveEnvironment(state);
    if (!env) return state.request.url;
    
    return Object.entries(env.variables).reduce((url, [key, value]) => {
      return url.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }, state.request.url);
  }
  
  static isRequestValid(state) {
    return !!state.request.url && !!state.request.method;
  }
  
  static getRequestCount(state) {
    return state.history.length;
  }
  
  static getCollectionById(state, collectionId) {
    return state.collections.find(c => c.id === collectionId);
  }
}

// TASK: Create state actions
export class StateActions {
  constructor(stateManager) {
    this.state = stateManager;
  }
  
  setRequestUrl(url) {
    this.state.setState({ request: { ...this.state.getState().request, url } });
  }
  
  setRequestMethod(method) {
    this.state.setState({ request: { ...this.state.getState().request, method } });
  }
  
  setRequestHeader(key, value) {
    const headers = { ...this.state.getState().request.headers };
    if (value === undefined || value === null || value === '') {
      delete headers[key];
    } else {
      headers[key] = value;
    }
    this.state.setState({ request: { ...this.state.getState().request, headers } });
  }
  
  setRequestParam(key, value) {
    const params = { ...this.state.getState().request.params };
    if (value === undefined || value === null || value === '') {
      delete params[key];
    } else {
      params[key] = value;
    }
    this.state.setState({ request: { ...this.state.getState().request, params } });
  }
  
  setRequestBody(body) {
    this.state.setState({ request: { ...this.state.getState().request, body } });
  }
  
  setRequestAuth(auth) {
    this.state.setState({ request: { ...this.state.getState().request, auth } });
  }
  
  setActiveTab(tab) {
    this.state.setState({ activeTab: tab });
  }
  
  setLoading(loading) {
    this.state.setState({ loading });
  }
  
  setResponse(response) {
    this.state.setState({ response, error: null });
  }
  
  setError(error) {
    this.state.setState({ error, response: null });
  }
  
  addToHistory(entry) {
    const history = [...this.state.getState().history];
    history.unshift(entry);
    if (history.length > 100) {
      history.pop();
    }
    this.state.setState({ history });
  }
  
  toggleSidebar() {
    const current = this.state.getState().ui.sidebarVisible;
    this.state.setState({ ui: { ...this.state.getState().ui, sidebarVisible: !current } });
  }
  
  toggleAIPanel() {
    const current = this.state.getState().ui.aiPanelVisible;
    this.state.setState({ ui: { ...this.state.getState().ui, aiPanelVisible: !current } });
  }
}
```

---

# 6. Complete UI Interactions

## Task 6.1: Advanced UI Components

### File: `src/components/UIComponents.js` (New File)

```javascript
// TASK: Create reusable UI components
export class UIComponents {
  // TASK: Create dropdown component
  static createDropdown(options) {
    const {
      trigger,
      items,
      position = 'bottom-left',
      width = '200px',
      onSelect
    } = options;
    
    const dropdown = document.createElement('div');
    dropdown.className = 'dropdown-menu';
    dropdown.style.cssText = `
      position: absolute;
      background: var(--color-card-dark);
      border: 1px solid var(--color-border-light);
      border-radius: 6px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      width: ${width};
      z-index: 1000;
      opacity: 0;
      transform: translateY(-10px);
      transition: all 0.2s ease;
      pointer-events: none;
    `;
    
    // Create items
    items.forEach(item => {
      if (item.separator) {
        const separator = document.createElement('div');
        separator.className = 'dropdown-separator';
        dropdown.appendChild(separator);
      } else {
        const menuItem = document.createElement('div');
        menuItem.className = 'dropdown-item';
        menuItem.innerHTML = `
          ${item.icon ? `<i class="${item.icon}"></i>` : ''}
          <span>${item.label}</span>
          ${item.shortcut ? `<span class="shortcut">${item.shortcut}</span>` : ''}
        `;
        
        menuItem.addEventListener('click', () => {
          if (onSelect) onSelect(item);
          this.hideDropdown(dropdown);
        });
        
        dropdown.appendChild(menuItem);
      }
    });
    
    // Position dropdown
    this.positionDropdown(dropdown, trigger, position);
    
    // Add to body
    document.body.appendChild(dropdown);
    
    // Show with animation
    requestAnimationFrame(() => {
      dropdown.style.opacity = '1';
      dropdown.style.transform = 'translateY(0)';
      dropdown.style.pointerEvents = 'auto';
    });
    
    // Close on outside click
    const closeHandler = (e) => {
      if (!dropdown.contains(e.target) && e.target !== trigger) {
        this.hideDropdown(dropdown);
        document.removeEventListener('click', closeHandler);
      }
    };
    
    setTimeout(() => {
      document.addEventListener('click', closeHandler);
    }, 0);
    
    return dropdown;
  }
  
  // TASK: Position dropdown relative to trigger
  static positionDropdown(dropdown, trigger, position) {
    const triggerRect = trigger.getBoundingClientRect();
    const dropdownRect = dropdown.getBoundingClientRect();
    
    let top, left;
    
    switch (position) {
      case 'bottom-left':
        top = triggerRect.bottom + 4;
        left = triggerRect.left;
        break;
      case 'bottom-right':
        top = triggerRect.bottom + 4;
        left = triggerRect.right - dropdownRect.width;
        break;
      case 'top-left':
        top = triggerRect.top - dropdownRect.height - 4;
        left = triggerRect.left;
        break;
      case 'top-right':
        top = triggerRect.top - dropdownRect.height - 4;
        left = triggerRect.right - dropdownRect.width;
        break;
    }
    
    // Ensure dropdown stays within viewport
    const padding = 8;
    if (left < padding) left = padding;
    if (left + dropdownRect.width > window.innerWidth - padding) {
      left = window.innerWidth - dropdownRect.width - padding;
    }
    if (top < padding) top = triggerRect.bottom + 4;
    if (top + dropdownRect.height > window.innerHeight - padding) {
      top = triggerRect.top - dropdownRect.height - 4;
    }
    
    dropdown.style.top = `${top}px`;
    dropdown.style.left = `${left}px`;
  }
  
  // TASK: Hide dropdown with animation
  static hideDropdown(dropdown) {
    dropdown.style.opacity = '0';
    dropdown.style.transform = 'translateY(-10px)';
    dropdown.style.pointerEvents = 'none';
    
    setTimeout(() => {
      dropdown.remove();
    }, 200);
  }
  
  // TASK: Create tooltip
  static createTooltip(element, text, options = {}) {
    const {
      position = 'top',
      delay = 500,
      maxWidth = '200px'
    } = options;
    
    let tooltip;
    let showTimeout;
    
    const show = () => {
      tooltip = document.createElement('div');
      tooltip.className = 'tooltip';
      tooltip.textContent = text;
      tooltip.style.cssText = `
        position: absolute;
        background: var(--color-surface-dark);
        border: 1px solid var(--color-border-light);
        border-radius: 4px;
        padding: 6px 10px;
        font-size: 11px;
        color: #e5e5e5;
        max-width: ${maxWidth};
        z-index: 10000;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.15s ease;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
      `;
      
      document.body.appendChild(tooltip);
      
      // Position tooltip
      const elementRect = element.getBoundingClientRect();
      const tooltipRect = tooltip.getBoundingClientRect();
      
      let top, left;
      
      switch (position) {
        case 'top':
          top = elementRect.top - tooltipRect.height - 8;
          left = elementRect.left + (elementRect.width - tooltipRect.width) / 2;
          break;
        case 'bottom':
          top = elementRect.bottom + 8;
          left = elementRect.left + (elementRect.width - tooltipRect.width) / 2;
          break;
        case 'left':
          top = elementRect.top + (elementRect.height - tooltipRect.height) / 2;
          left = elementRect.left - tooltipRect.width - 8;
          break;
        case 'right':
          top = elementRect.top + (elementRect.height - tooltipRect.height) / 2;
          left = elementRect.right + 8;
          break;
      }
      
      tooltip.style.top = `${top}px`;
      tooltip.style.left = `${left}px`;
      
      // Show tooltip
      requestAnimationFrame(() => {
        tooltip.style.opacity = '1';
      });
    };
    
    const hide = () => {
      clearTimeout(showTimeout);
      if (tooltip) {
        tooltip.style.opacity = '0';
        setTimeout(() => {
          tooltip?.remove();
          tooltip = null;
        }, 150);
      }
    };
    
    element.addEventListener('mouseenter', () => {
      showTimeout = setTimeout(show, delay);
    });
    
    element.addEventListener('mouseleave', hide);
    element.addEventListener('click', hide);
    
    // Return cleanup function
    return () => {
      element.removeEventListener('mouseenter', show);
      element.removeEventListener('mouseleave', hide);
      element.removeEventListener('click', hide);
      hide();
    };
  }
  
  // TASK: Create progress bar
  static createProgressBar(options = {}) {
    const {
      container,
      value = 0,
      max = 100,
      color = 'var(--color-primary)',
      height = '4px',
      animated = true
    } = options;
    
    const wrapper = document.createElement('div');
    wrapper.className = 'progress-bar-wrapper';
    wrapper.style.cssText = `
      width: 100%;
      height: ${height};
      background: rgba(255, 255, 255, 0.1);
      border-radius: ${parseInt(height) / 2}px;
      overflow: hidden;
    `;
    
    const bar = document.createElement('div');
    bar.className = 'progress-bar';
    bar.style.cssText = `
      height: 100%;
      background: ${color};
      width: ${(value / max) * 100}%
      transition: ${animated ? 'width 0.3s ease' : 'none'};
    `;
    
    wrapper.appendChild(bar);
    
    if (container) {
      container.appendChild(wrapper);
    }
    
    return {
      element: wrapper,
      update: (newValue) => {
        bar.style.width = `${(newValue / max) * 100}%`;
      },
      setColor: (newColor) => {
        bar.style.background = newColor;
      }
    };
  }
  
  // TASK: Create toast notification
  static showToast(message, options = {}) {
    const {
      type = 'info',
      duration = 3000,
      position = 'bottom-right',
      action
    } = options;
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.style.cssText = `
      background: var(--color-card-dark);
      border: 1px solid var(--color-border-light);
      border-radius: 6px;
      padding: 12px 16px;
      margin: 8px;
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 250px;
      max-width: 400px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      opacity: 0;
      transform: translateX(100%);
      transition: all 0.3s ease;
    `;
    
    // Icon
    const icons = {
      info: 'fa-info-circle',
      success: 'fa-check-circle',
      warning: 'fa-exclamation-triangle',
      error: 'fa-times-circle'
    };
    
    const icon = document.createElement('i');
    icon.className = `fa-solid ${icons[type]}`;
    icon.style.color = `var(--color-${type})`;
    icon.style.fontSize = '18px';
    
    // Message
    const messageEl = document.createElement('span');
    messageEl.textContent = message;
    messageEl.style.flex = '1';
    
    toast.appendChild(icon);
    toast.appendChild(messageEl);
    
    // Action button
    if (action) {
      const actionBtn = document.createElement('button');
      actionBtn.className = 'btn btn-ghost';
      actionBtn.textContent = action.label;
      actionBtn.addEventListener('click', () => {
        action.callback();
        removeToast();
      });
      toast.appendChild(actionBtn);
    }
    
    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'btn btn-ghost';
    closeBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
    closeBtn.addEventListener('click', removeToast);
    toast.appendChild(closeBtn);
    
    // Container
    let container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      container.style.cssText = `
        position: fixed;
        ${position.includes('top') ? 'top: 20px' : 'bottom: 20px'};
        ${position.includes('left') ? 'left: 20px' : 'right: 20px'};
        z-index: 10000;
        pointer-events: none;
      `;
      document.body.appendChild(container);
    }
    
    toast.style.pointerEvents = 'auto';
    container.appendChild(toast);
    
    // Animate in
    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateX(0)';
    });
    
    // Auto remove
    let removeTimeout;
    if (duration > 0) {
      removeTimeout = setTimeout(removeToast, duration);
    }
    
    function removeToast() {
      clearTimeout(removeTimeout);
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      
      setTimeout(() => {
        toast.remove();
        if (container.children.length === 0) {
          container.remove();
        }
      }, 300);
    }
    
    return removeToast;
  }
  
  // TASK: Create split pane
  static createSplitPane(options) {
    const {
      container,
      orientation = 'horizontal',
      initialSplit = 50,
      minSize = 100,
      onResize
    } = options;
    
    const splitPane = document.createElement('div');
    splitPane.className = `split-pane split-pane-${orientation}`;
    splitPane.style.cssText = `
      display: flex;
      flex-direction: ${orientation === 'horizontal' ? 'row' : 'column'};
      height: 100%;
      width: 100%;
    `;
    
    const pane1 = document.createElement('div');
    pane1.className = 'split-pane-1';
    pane1.style.cssText = `
      ${orientation === 'horizontal' ? 'width' : 'height'}: ${initialSplit}%;
      overflow: auto;
    `;
    
    const divider = document.createElement('div');
    divider.className = 'split-divider';
    divider.style.cssText = `
      ${orientation === 'horizontal' ? 'width: 1px' : 'height: 1px'};
      background: var(--color-border-dark);
      cursor: ${orientation === 'horizontal' ? 'col-resize' : 'row-resize'};
      position: relative;
      flex-shrink: 0;
    `;
    
    const pane2 = document.createElement('div');
    pane2.className = 'split-pane-2';
    pane2.style.cssText = `
      flex: 1;
      overflow: auto;
    `;
    
    splitPane.appendChild(pane1);
    splitPane.appendChild(divider);
    splitPane.appendChild(pane2);
    
    // Handle resizing
    let isResizing = false;
    
    divider.addEventListener('mousedown', (e) => {
      isResizing = true;
      document.body.style.cursor = orientation === 'horizontal' ? 'col-resize' : 'row-resize';
    });
    
    document.addEventListener('mousemove', (e) => {
      if (!isResizing) return;
      
      const rect = splitPane.getBoundingClientRect();
      let size;
      
      if (orientation === 'horizontal') {
        size = ((e.clientX - rect.left) / rect.width) * 100;
      } else {
        size = ((e.clientY - rect.top) / rect.height) * 100;
      }
      
      // Apply min size constraint
      const minPercent = (minSize / (orientation === 'horizontal' ? rect.width : rect.height)) * 100;
      size = Math.max(minPercent, Math.min(100 - minPercent, size));
      
      pane1.style[orientation === 'horizontal' ? 'width' : 'height'] = `${size}%`;
      
      if (onResize) {
        onResize(size);
      }
    });
    
    document.addEventListener('mouseup', () => {
      if (isResizing) {
        isResizing = false;
        document.body.style.cursor = '';
      }
    });
    
    if (container) {
      container.appendChild(splitPane);
    }
    
    return {
      element: splitPane,
      pane1,
      pane2,
      setSize: (size) => {
        pane1.style[orientation === 'horizontal' ? 'width' : 'height'] = `${size}%`;
      }
    };
  }
  
  // TASK: Create tabs component
  static createTabs(options) {
    const {
      container,
      tabs,
      activeTab = 0,
      onTabChange
    } = options;
    
    const tabsContainer = document.createElement('div');
    tabsContainer.className = 'tabs-component';
    
    const tabHeader = document.createElement('div');
    tabHeader.className = 'tab-header';
    tabHeader.style.cssText = `
      display: flex;
      border-bottom: 1px solid var(--color-border-dark);
      margin-bottom: 16px;
    `;
    
    const tabContent = document.createElement('div');
    tabContent.className = 'tab-content';
    
    tabs.forEach((tab, index) => {
      // Create tab button
      const tabBtn = document.createElement('button');
      tabBtn.className = `tab-button ${index === activeTab ? 'active' : ''}`;
      tabBtn.innerHTML = `
        ${tab.icon ? `<i class="${tab.icon}"></i>` : ''}
        <span>${tab.label}</span>
        ${tab.badge ? `<span class="tab-badge">${tab.badge}</span>` : ''}
      `;
      
      tabBtn.addEventListener('click', () => {
        // Update active states
        tabHeader.querySelectorAll('.tab-button').forEach(btn => {
          btn.classList.remove('active');
        });
        tabBtn.classList.add('active');
        
        // Update content
        tabContent.innerHTML = '';
        if (tab.content) {
          if (typeof tab.content === 'string') {
            tabContent.innerHTML = tab.content;
          } else {
            tabContent.appendChild(tab.content);
          }
        }
        
        if (onTabChange) {
          onTabChange(index, tab);
        }
      });
      
      tabHeader.appendChild(tabBtn);
      
      // Set initial content
      if (index === activeTab && tab.content) {
        if (typeof tab.content === 'string') {
          tabContent.innerHTML = tab.content;
        } else {
          tabContent.appendChild(tab.content);
        }
      }
    });
    
    tabsContainer.appendChild(tabHeader);
    tabsContainer.appendChild(tabContent);
    
    if (container) {
      container.appendChild(tabsContainer);
    }
    
    return {
      element: tabsContainer,
      setActiveTab: (index) => {
        const buttons = tabHeader.querySelectorAll('.tab-button');
        if (buttons[index]) {
          buttons[index].click();
        }
      },
      updateBadge: (index, badge) => {
        const buttons = tabHeader.querySelectorAll('.tab-button');
        if (buttons[index]) {
          const badgeEl = buttons[index].querySelector('.tab-badge');
          if (badgeEl) {
            badgeEl.textContent = badge;
          } else if (badge) {
            const newBadge = document.createElement('span');
            newBadge.className = 'tab-badge';
            newBadge.textContent = badge;
            buttons[index].appendChild(newBadge);
          }
        }
      }
    };
  }
  
  // TASK: Create virtual list for performance
  static createVirtualList(options) {
    const {
      container,
      items,
      itemHeight,
      renderItem,
      buffer = 5
    } = options;
    
    const viewport = document.createElement('div');
    viewport.className = 'virtual-list-viewport';
    viewport.style.cssText = `
      height: 100%;
      overflow-y: auto;
      position: relative;
    `;
    
    const content = document.createElement('div');
    content.className = 'virtual-list-content';
    content.style.cssText = `
      height: ${items.length * itemHeight}px;
      position: relative;
    `;
    
    viewport.appendChild(content);
    
    let visibleStart = 0;
    let visibleEnd = 0;
    
    const updateVisibleItems = () => {
      const scrollTop = viewport.scrollTop;
      const viewportHeight = viewport.clientHeight;
      
      visibleStart = Math.max(0, Math.floor(scrollTop / itemHeight) - buffer);
      visibleEnd = Math.min(
        items.length,
        Math.ceil((scrollTop + viewportHeight) / itemHeight) + buffer
      );
      
      // Clear content
      content.innerHTML = '';
      
      // Render visible items
      for (let i = visibleStart; i < visibleEnd; i++) {
        const itemEl = renderItem(items[i], i);
        itemEl.style.position = 'absolute';
        itemEl.style.top = `${i * itemHeight}px`;
        itemEl.style.height = `${itemHeight}px`;
        content.appendChild(itemEl);
      }
    };
    
    viewport.addEventListener('scroll', updateVisibleItems);
    updateVisibleItems();
    
    if (container) {
      container.appendChild(viewport);
    }
    
    return {
      element: viewport,
      update: (newItems) => {
        items = newItems;
        content.style.height = `${items.length * itemHeight}px`;
        updateVisibleItems();
      },
      scrollToIndex: (index) => {
        viewport.scrollTop = index * itemHeight;
      }
    };
  }
}
```

## Task 6.2: Final Integration Code

### File: `index.js` - Final Integration Methods

```javascript
// TASK: Initialize all UI interactions
initializeUI() {
  // Setup tooltips
  document.querySelectorAll('[data-tooltip]').forEach(element => {
    UIComponents.createTooltip(element, element.dataset.tooltip);
  });
  
  // Setup dropdowns
  this.setupDropdowns();
  
  // Setup keyboard navigation
  this.setupKeyboardNavigation();
  
  // Setup drag and drop
  this.setupDragAndDrop();
  
  // Setup accessibility
  this.setupAccessibility();
}

// TASK: Setup dropdown menus
setupDropdowns() {
  // Method dropdown enhancements
  const methodSelect = document.getElementById('apicarus-method');
  if (methodSelect) {
    methodSelect.addEventListener('click', (e) => {
      e.preventDefault();
      
      UIComponents.createDropdown({
        trigger: methodSelect,
        items: [
          { label: 'GET', icon: 'fa-solid fa-download', value: 'GET' },
          { label: 'POST', icon: 'fa-solid fa-upload', value: 'POST' },
          { label: 'PUT', icon: 'fa-solid fa-pen', value: 'PUT' },
          { label: 'PATCH', icon: 'fa-solid fa-pen-to-square', value: 'PATCH' },
          { label: 'DELETE', icon: 'fa-solid fa-trash', value: 'DELETE' },
          { separator: true },
          { label: 'HEAD', value: 'HEAD' },
          { label: 'OPTIONS', value: 'OPTIONS' },
          { label: 'CONNECT', value: 'CONNECT' },
          { label: 'TRACE', value: 'TRACE' }
        ],
        onSelect: (item) => {
          methodSelect.value = item.value;
          this.handleMethodChange(item.value);
        }
      });
    });
  }
}

// TASK: Setup keyboard navigation
setupKeyboardNavigation() {
  // Tab navigation in key-value editors
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Tab' && e.target.matches('.kv-key, .kv-value')) {
      const row = e.target.closest('.kv-row');
      const isLastInput = e.target.matches('.kv-value');
      const isLastRow = !row.nextElementSibling || row.nextElementSibling.matches('.kv-add-button');
      
      if (isLastInput && isLastRow && !e.shiftKey) {
        // Tab from last value input creates new row
        e.preventDefault();
        const type = e.target.closest('.key-value-editor').id.includes('headers') ? 'headers' : 'params';
        this.addKeyValueRow(type, row.parentElement);
      }
    }
  });
}

// TASK: Setup accessibility features
setupAccessibility() {
  // Add ARIA labels
  document.querySelectorAll('.btn').forEach(button => {
    if (!button.getAttribute('aria-label') && button.querySelector('i')) {
      const icon = button.querySelector('i');
      const label = this.getIconLabel(icon.className);
      if (label) {
        button.setAttribute('aria-label', label);
      }
    }
  });
  
  // Keyboard focus indicators
  document.addEventListener('focusin', (e) => {
    if (e.target.matches('input, button, select, textarea')) {
      e.target.classList.add('focus-visible');
    }
  });
  
  document.addEventListener('focusout', (e) => {
    e.target.classList.remove('focus-visible');
  });
}

// TASK: Get label for icon
getIconLabel(iconClass) {
  const labels = {
    'fa-trash': 'Delete',
    'fa-plus': 'Add',
    'fa-paper-plane': 'Send request',
    'fa-save': 'Save',
    'fa-copy': 'Copy',
    'fa-download': 'Download',
    'fa-gear': 'Settings',
    'fa-wand-magic-sparkles': 'AI Assistant'
  };
  
  for (const [icon, label] of Object.entries(labels)) {
    if (iconClass.includes(icon)) {
      return label;
    }
  }
  
  return null;
}

// TASK: Final initialization
async initialize() {
  try {
    // Load saved state
    await this.stateManager.loadState();
    
    // Initialize network service
    this.networkService = new NetworkService(this);
    
    // Initialize WebSocket service
    this.webSocketService = new WebSocketService(this);
    
    // Setup UI
    this.initializeUI();
    
    // Load initial data
    await this.loadInitialData();
    
    // Mark as ready
    this.isReady = true;
    
    // Notify ready
    Alexandria.emit('apicarus:ready', { plugin: this });
    
  } catch (error) {
    console.error('Failed to initialize Apicarus:', error);
    UI.showNotification({
      type: 'error',
      title: 'Initialization Failed',
      message: 'Apicarus could not be initialized. Please check the console for details.'
    });
  }
}
```

---

# Summary

This comprehensive implementation provides:

1. **All Missing Methods** - Complete implementations for getHeaders, getParams, getRequestBody, etc.
2. **Full DOM Manipulation** - Dynamic UI updates, event delegation, and efficient rendering
3. **Connected Event Handlers** - Keyboard shortcuts, mouse events, and custom events
4. **Complete Network Layer** - HTTP requests, WebSocket support, and request interceptors
5. **Real State Management** - Centralized state with subscriptions, persistence, and time-travel
6. **Advanced UI Interactions** - Dropdowns, tooltips, virtual lists, and accessibility

The plugin is now ready for testing and deployment to the Alexandria Platform!