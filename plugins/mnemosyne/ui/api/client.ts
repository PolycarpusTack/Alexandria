/**
 * Mnemosyne API Client
 * Handles all API communication between the UI and backend
 */

import axios, { AxiosInstance, AxiosError } from 'axios';

// Types matching the backend models
export interface KnowledgeNode {
  id: string;
  title: string;
  content: string;
  type: 'document' | 'note' | 'folder';
  metadata: {
    tags: string[];
    createdAt: string;
    updatedAt: string;
    author?: string;
    version?: number;
  };
  parentId?: string;
  children?: string[];
  connections?: string[];
}

export interface NodeConnection {
  id: string;
  sourceId: string;
  targetId: string;
  type: 'reference' | 'related' | 'parent-child';
  metadata?: Record<string, any>;
}

export interface ImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  errors: number;
  details: Array<{
    status: 'success' | 'warning' | 'error';
    message: string;
    nodeId?: string;
  }>;
}

export interface ExportOptions {
  format: 'markdown' | 'json' | 'pdf' | 'html' | 'obsidian';
  includeAttachments: boolean;
  includeHistory: boolean;
  nodeIds?: string[];
}

export interface SearchQuery {
  query: string;
  tags?: string[];
  type?: string[];
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}

export interface SearchResult {
  nodes: Array<{
    node: KnowledgeNode;
    relevance: number;
    highlights: string[];
  }>;
  total: number;
  facets: {
    tags: Record<string, number>;
    types: Record<string, number>;
  };
}

export interface Template {
  id: string;
  name: string;
  description: string;
  content: string;
  fields: string[];
  category: string;
  icon?: string;
  usageCount: number;
}

export interface DashboardStats {
  totalNodes: number;
  totalTags: number;
  totalConnections: number;
  recentlyUpdated: number;
  storageUsed: number;
  lastBackup?: string;
}

class MnemosyneAPIClient {
  private client: AxiosInstance;
  private baseURL: string;

  constructor(baseURL: string = '/api/plugins/mnemosyne') {
    this.baseURL = baseURL;
    this.client = axios.create({
      baseURL,
      headers: {
        'Content-Type': 'application/json',
      },
      withCredentials: true, // Include cookies for auth
    });

    // Add auth token to requests
    this.client.interceptors.request.use((config) => {
      const token = localStorage.getItem('authToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // Handle errors globally
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response?.status === 401) {
          // Redirect to login
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  // Dashboard
  async getDashboardStats(): Promise<DashboardStats> {
    const { data } = await this.client.get('/dashboard/stats');
    return data;
  }

  async getRecentNodes(limit: number = 10): Promise<KnowledgeNode[]> {
    const { data } = await this.client.get('/nodes/recent', { params: { limit } });
    return data;
  }

  // Nodes
  async getNodes(parentId?: string): Promise<KnowledgeNode[]> {
    const { data } = await this.client.get('/nodes', { params: { parentId } });
    return data;
  }

  async getNode(id: string): Promise<KnowledgeNode> {
    const { data } = await this.client.get(`/nodes/${id}`);
    return data;
  }

  async createNode(node: Omit<KnowledgeNode, 'id' | 'metadata'>): Promise<KnowledgeNode> {
    const { data } = await this.client.post('/nodes', node);
    return data;
  }

  async updateNode(id: string, updates: Partial<KnowledgeNode>): Promise<KnowledgeNode> {
    const { data } = await this.client.put(`/nodes/${id}`, updates);
    return data;
  }

  async deleteNode(id: string): Promise<void> {
    await this.client.delete(`/nodes/${id}`);
  }

  async moveNode(nodeId: string, newParentId: string | null): Promise<KnowledgeNode> {
    const { data } = await this.client.post(`/nodes/${nodeId}/move`, { parentId: newParentId });
    return data;
  }

  // Connections
  async getNodeConnections(nodeId: string): Promise<NodeConnection[]> {
    const { data } = await this.client.get(`/nodes/${nodeId}/connections`);
    return data;
  }

  async createConnection(connection: Omit<NodeConnection, 'id'>): Promise<NodeConnection> {
    const { data } = await this.client.post('/connections', connection);
    return data;
  }

  async deleteConnection(id: string): Promise<void> {
    await this.client.delete(`/connections/${id}`);
  }

  // Search
  async search(query: SearchQuery): Promise<SearchResult> {
    const { data } = await this.client.post('/search', query);
    return data;
  }

  async getSuggestions(query: string): Promise<string[]> {
    const { data } = await this.client.get('/search/suggestions', { params: { q: query } });
    return data;
  }

  // Import/Export
  async importData(file: File, format: string): Promise<ImportResult> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('format', format);

    const { data } = await this.client.post('/import', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return data;
  }

  async exportData(options: ExportOptions): Promise<Blob> {
    const { data } = await this.client.post('/export', options, {
      responseType: 'blob',
    });
    return data;
  }

  // Templates
  async getTemplates(): Promise<Template[]> {
    const { data } = await this.client.get('/templates');
    return data;
  }

  async getTemplate(id: string): Promise<Template> {
    const { data } = await this.client.get(`/templates/${id}`);
    return data;
  }

  async createTemplate(template: Omit<Template, 'id' | 'usageCount'>): Promise<Template> {
    const { data } = await this.client.post('/templates', template);
    return data;
  }

  async updateTemplate(id: string, updates: Partial<Template>): Promise<Template> {
    const { data } = await this.client.put(`/templates/${id}`, updates);
    return data;
  }

  async deleteTemplate(id: string): Promise<void> {
    await this.client.delete(`/templates/${id}`);
  }

  async useTemplate(id: string): Promise<KnowledgeNode> {
    const { data } = await this.client.post(`/templates/${id}/use`);
    return data;
  }

  // Tags
  async getTags(): Promise<Array<{ name: string; count: number }>> {
    const { data } = await this.client.get('/tags');
    return data;
  }

  async renameTag(oldName: string, newName: string): Promise<void> {
    await this.client.post('/tags/rename', { oldName, newName });
  }

  // Graph
  async getGraphData(nodeId?: string, depth: number = 2): Promise<{
    nodes: Array<{ id: string; label: string; type: string }>;
    edges: Array<{ source: string; target: string; type: string }>;
  }> {
    const { data } = await this.client.get('/graph', { params: { nodeId, depth } });
    return data;
  }

  // WebSocket connection for real-time updates
  connectWebSocket(onMessage: (event: MessageEvent) => void): WebSocket {
    const wsUrl = this.baseURL.replace(/^http/, 'ws') + '/ws';
    const ws = new WebSocket(wsUrl);
    
    ws.onmessage = onMessage;
    ws.onerror = (error) => console.error('WebSocket error:', error);
    ws.onclose = () => console.log('WebSocket connection closed');
    
    return ws;
  }
}

// Create and export a singleton instance
export const mnemosyneAPI = new MnemosyneAPIClient();

// Export the class for testing or custom instances
export default MnemosyneAPIClient;