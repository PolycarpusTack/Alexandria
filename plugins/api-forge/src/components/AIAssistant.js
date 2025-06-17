// AIAssistant component for Apicarus plugin

export class AIAssistant {
  constructor(plugin) {
    this.plugin = plugin;
    this.isProcessing = false;
  }

  async analyzeRequest(request) {
    const prompt = `Analyze this API request and provide suggestions:
    
    Method: ${request.method}
    URL: ${request.url}
    Headers: ${JSON.stringify(request.headers, null, 2)}
    
    Please provide:
    1. Potential issues or improvements
    2. Security considerations
    3. Performance optimization suggestions
    4. Best practices recommendations`;

    try {
      const response = await this.plugin.ai?.query(prompt, {
        maxTokens: 500,
        temperature: 0.7
      });

      return response?.content || 'Unable to analyze request at this time.';
    } catch (error) {
      this.plugin.logger?.error('AI analysis failed:', error);
      return 'Unable to analyze request at this time.';
    }
  }
  async generateRequestFromDescription(description) {
    const prompt = `Generate an API request based on this description:
    "${description}"
    
    Provide a JSON response with:
    {
      "method": "HTTP method",
      "url": "endpoint URL",
      "headers": {},
      "body": {},
      "description": "what this request does"
    }
    
    Return ONLY valid JSON, no additional text or markdown.`;

    try {
      const response = await this.plugin.ai?.query(prompt, {
        maxTokens: 300,
        temperature: 0.5
      });

      if (!response?.content) return null;
      
      // Extract JSON from response
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);      
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return null;
    } catch (error) {
      this.plugin.logger?.error('Failed to generate request:', error);
      return null;
    }
  }

  async suggestTestCases(endpoint) {
    const prompt = `Suggest test cases for this API endpoint:
    ${endpoint}    
    Provide test cases including:
    1. Happy path scenarios
    2. Error scenarios
    3. Edge cases
    4. Security tests`;

    try {
      const response = await this.plugin.ai?.query(prompt, {
        maxTokens: 600,
        temperature: 0.7
      });

      return response?.content || 'Unable to generate test cases.';
    } catch (error) {
      this.plugin.logger?.error('Failed to generate test cases:', error);
      return 'Unable to generate test cases.';
    }
  }

  async analyzeResponse(response) {
    if (!response) return;
    
    const prompt = `Analyze this API response:
    
    Status: ${response.status} ${response.statusText}
    Headers: ${JSON.stringify(response.headers, null, 2)}
    Body: ${JSON.stringify(response.data, null, 2).substring(0, 1000)}...
    
    Provide insights about:
    1. Response structure and data quality
    2. Performance indicators
    3. Potential issues or anomalies
    4. Suggestions for handling this response`;
    
    try {
      this.isProcessing = true;
      this.updateAssistantPanel('analyzing');
      
      const analysis = await this.plugin.ai?.query(prompt, {
        maxTokens: 500,
        temperature: 0.7
      });
      
      this.displayAnalysis(analysis?.content || 'Analysis unavailable');
    } catch (error) {
      this.plugin.logger?.error('Response analysis failed:', error);
      this.displayError('Failed to analyze response');
    } finally {
      this.isProcessing = false;
    }
  }
  
  async generateRequestFromNL(naturalLanguage) {
    const prompt = `Convert this natural language description into an API request:
    
    Description: "${naturalLanguage}"
    
    Generate a complete API request with:
    - Method (GET, POST, PUT, DELETE, etc.)
    - URL (use realistic example endpoints)
    - Headers (include common headers like Content-Type)
    - Body (if applicable)
    - Query parameters (if applicable)
    
    Format as JSON with this structure:
    {
      "method": "...",
      "url": "...",
      "headers": {...},
      "params": {...},
      "body": {...}
    }
    
    Return ONLY the JSON, no additional text.`;
    
    try {
      this.isProcessing = true;
      this.updateAssistantPanel('generating');
      
      const response = await this.plugin.ai?.query(prompt, {
        maxTokens: 400,
        temperature: 0.5
      });
      
      if (!response?.content) {
        throw new Error('No response from AI');
      }
      
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const request = JSON.parse(jsonMatch[0]);
        this.applyGeneratedRequest(request);
        return request;
      }
      
      throw new Error('Invalid response format');
    } catch (error) {
      this.plugin.logger?.error('Failed to generate request from NL:', error);
      this.displayError('Failed to generate request');
      return null;
    } finally {
      this.isProcessing = false;
    }
  }
  
  renderAssistantPanel() {
    return `
      <div class="ai-assistant-header">
        <h3><i class="fa-solid fa-wand-magic-sparkles"></i> AI Assistant</h3>
        <button class="btn btn-ghost" onclick="document.getElementById('apicarus-aiPanel').classList.remove('active')">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
      
      <div class="ai-assistant-content">
        <div class="ai-section">
          <h4>Natural Language Request</h4>
          <textarea 
            id="ai-nl-input" 
            class="search-input" 
            style="width: 100%; min-height: 80px; margin-bottom: 8px;"
            placeholder="Describe your API request in plain English..."
          ></textarea>
          <button 
            class="btn btn-primary" 
            onclick="Alexandria.plugins.get('apicarus').aiAssistant.generateRequestFromNL(document.getElementById('ai-nl-input').value)"
            style="width: 100%;"
          >
            <i class="fa-solid fa-magic"></i> Generate Request
          </button>
        </div>
        
        <div class="ai-section" style="margin-top: 24px;">
          <h4>Quick Actions</h4>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <button class="btn btn-secondary" onclick="Alexandria.plugins.get('apicarus').aiAssistant.analyzeCurrentRequest()">
              <i class="fa-solid fa-magnifying-glass"></i> Analyze Current Request
            </button>
            <button class="btn btn-secondary" onclick="Alexandria.plugins.get('apicarus').aiAssistant.suggestTests()">
              <i class="fa-solid fa-flask"></i> Suggest Test Cases
            </button>
            <button class="btn btn-secondary" onclick="Alexandria.plugins.get('apicarus').aiAssistant.improveRequest()">
              <i class="fa-solid fa-sparkles"></i> Improve Request
            </button>
          </div>
        </div>
        
        <div id="ai-results" class="ai-section" style="margin-top: 24px; display: none;">
          <h4>AI Analysis</h4>
          <div id="ai-results-content" class="ai-results-box"></div>
        </div>
      </div>
      
      <style>
        .ai-assistant-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px;
          border-bottom: 1px solid var(--color-border-dark);
        }
        
        .ai-assistant-content {
          padding: 16px;
          overflow-y: auto;
          flex: 1;
        }
        
        .ai-section h4 {
          font-size: 14px;
          font-weight: 600;
          margin-bottom: 12px;
          color: var(--color-text-secondary);
        }
        
        .ai-results-box {
          background: var(--color-surface-dark);
          border: 1px solid var(--color-border-dark);
          border-radius: 4px;
          padding: 12px;
          font-size: 13px;
          line-height: 1.6;
          max-height: 300px;
          overflow-y: auto;
        }
      </style>
    `;
  }
  
  updateAssistantPanel(state) {
    const resultsSection = document.getElementById('ai-results');
    const resultsContent = document.getElementById('ai-results-content');
    
    if (!resultsSection || !resultsContent) return;
    
    resultsSection.style.display = 'block';
    
    switch(state) {
      case 'analyzing':
        resultsContent.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Analyzing...';
        break;
      case 'generating':
        resultsContent.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generating request...';
        break;
    }
  }
  
  displayAnalysis(analysis) {
    const resultsContent = document.getElementById('ai-results-content');
    if (resultsContent) {
      resultsContent.innerHTML = `<pre style="white-space: pre-wrap; margin: 0;">${this.escapeHtml(analysis)}</pre>`;
    }
  }
  
  displayError(error) {
    const resultsContent = document.getElementById('ai-results-content');
    if (resultsContent) {
      resultsContent.innerHTML = `<div style="color: var(--color-error);"><i class="fa-solid fa-exclamation-circle"></i> ${error}</div>`;
    }
  }
  
  applyGeneratedRequest(request) {
    // Update the UI with generated request
    const methodSelect = document.getElementById('apicarus-method');
    const urlInput = document.getElementById('apicarus-url');
    
    if (methodSelect && request.method) {
      methodSelect.value = request.method;
    }
    
    if (urlInput && request.url) {
      urlInput.value = request.url;
    }
    
    // Update current request in plugin
    this.plugin.currentRequest = {
      ...this.plugin.currentRequest,
      ...request
    };
    
    // Refresh UI to show new data
    this.plugin.refreshUI();
    
    // Show success message
    this.displayAnalysis('Request generated successfully! The form has been updated with the generated values.');
  }
  
  async analyzeCurrentRequest() {
    const method = document.getElementById('apicarus-method')?.value;
    const url = document.getElementById('apicarus-url')?.value;
    
    if (!url) {
      this.displayError('Please enter a URL first');
      return;
    }
    
    const request = {
      method,
      url,
      headers: this.plugin.getHeaders(),
      params: this.plugin.getParams()
    };
    
    const analysis = await this.analyzeRequest(request);
    this.displayAnalysis(analysis);
  }
  
  async suggestTests() {
    const url = document.getElementById('apicarus-url')?.value;
    
    if (!url) {
      this.displayError('Please enter a URL first');
      return;
    }
    
    this.updateAssistantPanel('analyzing');
    const suggestions = await this.suggestTestCases(url);
    this.displayAnalysis(suggestions);
  }
  
  async improveRequest() {
    const currentRequest = {
      method: document.getElementById('apicarus-method')?.value,
      url: document.getElementById('apicarus-url')?.value,
      headers: this.plugin.getHeaders(),
      params: this.plugin.getParams()
    };
    
    if (!currentRequest.url) {
      this.displayError('Please enter a URL first');
      return;
    }
    
    const prompt = `Improve this API request by suggesting better practices:
    
    Current Request:
    ${JSON.stringify(currentRequest, null, 2)}
    
    Suggest improvements for:
    1. URL structure and naming
    2. Missing or incorrect headers
    3. Security best practices
    4. Performance optimizations
    
    Provide specific, actionable suggestions.`;
    
    try {
      this.updateAssistantPanel('analyzing');
      const response = await this.plugin.ai?.query(prompt, {
        maxTokens: 500,
        temperature: 0.7
      });
      
      this.displayAnalysis(response?.content || 'Unable to generate improvements');
    } catch (error) {
      this.plugin.logger?.error('Failed to improve request:', error);
      this.displayError('Failed to analyze request');
    }
  }
  
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}