/**
 * API Client for Crash Analyzer Service
 * Connects to the real backend service instead of using mock data
 */

import { apiClient } from '../../utils/api-client';
import { createClientLogger } from '../utils/client-logger';

const logger = createClientLogger({ serviceName: 'crash-analyzer-api' });

export interface CrashLog {
  id: string;
  title: string;
  content: string;
  uploadedAt: Date;
  userId: string;
  metadata: any;
  parsedData?: any;
  analysis?: any;
}

export interface AnalysisResult {
  rootCauses: any[];
  troubleshootingSteps: string[];
  summary: string;
  llmModel: string;
  confidence: number;
  inferenceTime: number;
}

class CrashAnalyzerAPIService {
  private baseUrl = '/api/crash-analyzer';

  async getAllCrashLogs(): Promise<CrashLog[]> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/logs`);
      return response.data;
    } catch (error) {
      logger.error('Failed to fetch crash logs', { error });
      return [];
    }
  }

  async getCrashLogById(id: string): Promise<CrashLog | null> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/logs/${id}`);
      return response.data;
    } catch (error) {
      logger.error('Failed to fetch crash log', { error, id });
      return null;
    }
  }

  async analyzeLog(logId: string, content: string, metadata: any): Promise<AnalysisResult> {
    try {
      const response = await apiClient.post(`${this.baseUrl}/analyze`, {
        logId,
        content,
        metadata
      });
      return response.data;
    } catch (error) {
      logger.error('Failed to analyze log', { error, logId });
      throw error;
    }
  }

  async uploadCrashLog(formData: FormData): Promise<CrashLog> {
    try {
      const response = await apiClient.post(`${this.baseUrl}/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      return response.data;
    } catch (error) {
      logger.error('Failed to upload crash log', { error });
      throw error;
    }
  }

  async deleteCrashLog(id: string): Promise<boolean> {
    try {
      await apiClient.delete(`${this.baseUrl}/logs/${id}`);
      return true;
    } catch (error) {
      logger.error('Failed to delete crash log', { error, id });
      return false;
    }
  }
}

// Export singleton instance
export const crashAnalyzerAPI = new CrashAnalyzerAPIService();