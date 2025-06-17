// ResponseViewer component for Apicarus plugin
import { escapeHtml, ContentSecurity } from '../utils/security.js';

export class ResponseViewer {
  constructor(plugin) {
    this.plugin = plugin;
    this.currentResponse = null;
  }

  display(response, duration) {
    this.currentResponse = response;
    
    const container = document.getElementById('apicarus-responseContent');
    const statsContainer = document.getElementById('apicarus-responseStats');
    
    // Update stats
    statsContainer.innerHTML = `
      <span class="response-stat">
        <strong>Status:</strong> 
        <span class="${this.getStatusClass(response.status)}">${response.status} ${response.statusText}</span>
      </span>
      <span class="response-stat">
        <strong>Time:</strong> ${duration}ms
      </span>
      <span class="response-stat">
        <strong>Size:</strong> ${this.formatSize(response.size)}
      </span>
    `;
    
    // Display response content
    container.innerHTML = this.renderResponseContent(response);
  }
  renderResponseContent(response) {
    const contentType = response.headers['content-type'] || '';
    
    if (contentType.includes('application/json')) {
      return this.renderJSON(response.data);
    } else if (contentType.includes('text/html')) {
      return this.renderHTML(response.data);
    } else if (contentType.includes('image/')) {
      return this.renderImage(response.data, contentType);
    } else {
      return this.renderText(response.data);
    }
  }

  renderJSON(data) {
    try {
      const formatted = JSON.stringify(data, null, 2);
      return `
        <div class="response-tabs">
          <button class="tab-button active" onclick="Alexandria.plugins.get('apicarus').responseViewer.showTab('pretty')">
            Pretty
          </button>
          <button class="tab-button" onclick="Alexandria.plugins.get('apicarus').responseViewer.showTab('raw')">
            Raw
          </button>
          <button class="tab-button" onclick="Alexandria.plugins.get('apicarus').responseViewer.showTab('preview')">
            Preview
          </button>
        </div>
        <div class="response-content">
          <pre class="response-json">${this.syntaxHighlight(formatted)}</pre>
        </div>
      `;
    } catch (error) {
      return '<div class="error">Failed to parse JSON response</div>';
    }
  }

  syntaxHighlight(json) {
    // First escape the JSON to prevent XSS
    const escaped = escapeHtml(json);
    
    // Then apply syntax highlighting
    return escaped.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, 
      function (match) {
        let cls = 'number';
        if (/^"/.test(match)) {
          if (/:$/.test(match)) {
            cls = 'key';
          } else {
            cls = 'string';
          }
        } else if (/true|false/.test(match)) {
          cls = 'boolean';
        } else if (/null/.test(match)) {
          cls = 'null';
        }
        return '<span class="' + cls + '">' + match + '</span>';
      });
  }

  getStatusClass(status) {
    if (status >= 200 && status < 300) return 'text-green-500';
    if (status >= 300 && status < 400) return 'text-yellow-500';
    if (status >= 400 && status < 500) return 'text-orange-500';
    if (status >= 500) return 'text-red-500';
    return '';
  }
  formatSize(bytes) {
    if (!bytes) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }
  
  renderHTML(data) {
    // Use ContentSecurity for safe HTML rendering
    return `
      <div class="response-tabs">
        <button class="tab-button active" onclick="Alexandria.plugins.get('apicarus').responseViewer.showTab('preview')">
          Preview
        </button>
        <button class="tab-button" onclick="Alexandria.plugins.get('apicarus').responseViewer.showTab('raw')">
          Raw
        </button>
      </div>
      <div class="response-content">
        <div id="response-html-preview" class="html-preview">
          ${ContentSecurity.createSafeIframe(data)}
        </div>
        <div id="response-html-raw" style="display: none;">
          <pre class="response-text">${escapeHtml(data)}</pre>
        </div>
      </div>
    `;
  }
  
  renderImage(data, contentType) {
    // For image responses, data should be a base64 string or blob URL
    const imageUrl = typeof data === 'string' 
      ? data.startsWith('data:') ? data : `data:${contentType};base64,${data}`
      : URL.createObjectURL(data);
      
    return `
      <div class="response-content">
        <div class="image-preview" style="text-align: center; padding: 24px;">
          <img 
            src="${imageUrl}" 
            alt="Response image" 
            style="max-width: 100%; max-height: 500px; border: 1px solid var(--color-border-dark);"
            onload="Alexandria.plugins.get('apicarus').responseViewer.onImageLoad(this)"
            onerror="Alexandria.plugins.get('apicarus').responseViewer.onImageError(this)"
          />
          <div id="image-info" style="margin-top: 16px; color: #8b8b8b; font-size: 12px;"></div>
        </div>
      </div>
    `;
  }
  
  renderText(data) {
    return `
      <div class="response-tabs">
        <button class="tab-button active" onclick="Alexandria.plugins.get('apicarus').responseViewer.showTab('formatted')">
          Formatted
        </button>
        <button class="tab-button" onclick="Alexandria.plugins.get('apicarus').responseViewer.showTab('raw')">
          Raw
        </button>
      </div>
      <div class="response-content">
        <pre class="response-text">${escapeHtml(data)}</pre>
      </div>
    `;
  }
  
  showTab(tab) {
    // Remove active class from all tabs
    document.querySelectorAll('.response-tabs .tab-button').forEach(btn => {
      btn.classList.remove('active');
    });
    
    // Add active class to clicked tab
    event.target.classList.add('active');
    
    // Show/hide content based on tab
    switch(tab) {
      case 'pretty':
      case 'formatted':
        document.querySelector('.response-content pre').style.display = 'block';
        const rawContent = document.getElementById('response-html-raw');
        if (rawContent) rawContent.style.display = 'none';
        const preview = document.getElementById('response-html-preview');
        if (preview) preview.style.display = 'none';
        break;
        
      case 'raw':
        const prettyContent = document.querySelector('.response-content pre');
        if (prettyContent) prettyContent.style.display = 'none';
        const raw = document.getElementById('response-html-raw');
        if (raw) raw.style.display = 'block';
        const htmlPreview = document.getElementById('response-html-preview');
        if (htmlPreview) htmlPreview.style.display = 'none';
        break;
        
      case 'preview':
        document.querySelector('.response-content pre')?.style.display = 'none';
        const rawHtml = document.getElementById('response-html-raw');
        if (rawHtml) rawHtml.style.display = 'none';
        const htmlPrev = document.getElementById('response-html-preview');
        if (htmlPrev) htmlPrev.style.display = 'block';
        break;
    }
  }
  
  // Remove the local escapeHtml method as we're now using the security utility
  
  onImageLoad(img) {
    const info = document.getElementById('image-info');
    if (info) {
      info.textContent = `${img.naturalWidth} × ${img.naturalHeight} pixels`;
    }
  }
  
  onImageError(img) {
    img.style.display = 'none';
    const container = img.parentElement;
    container.innerHTML = `
      <div style="color: var(--color-error); padding: 48px;">
        <i class="fa-solid fa-image-slash" style="font-size: 48px; margin-bottom: 16px;"></i>
        <p>Failed to load image</p>
      </div>
    `;
  }
}