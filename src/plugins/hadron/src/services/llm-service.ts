// Import FeatureFlagService from local interfaces instead of core
import { FeatureFlagService } from '../interfaces';
import { 
  ILlmService, 
  ParsedCrashData, 
  CrashAnalysisResult, 
  ModelStatus,
  RootCause,
  Evidence
} from '../interfaces';
import { v4 as uuidv4 } from 'uuid';

/**
 * Service for interacting with Ollama LLMs for crash analysis
 */
export class LlmService implements ILlmService {
  // Default models to use for analysis
  private readonly DEFAULT_MODEL = 'llama2:8b-chat-q4';
  private readonly FALLBACK_MODEL = 'llama2:7b-chat-q4';
  
  // LLM request timeout in milliseconds
  private readonly REQUEST_TIMEOUT = 30000;
  
  // Maximum retries for LLM requests
  private readonly MAX_RETRIES = 2;
  
  // Base URL for Ollama API
  private readonly OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434/api';
  
  constructor(
    private featureFlagService: FeatureFlagService,
    private logger?: any  // Add an optional logger parameter to match the EnhancedLlmService
  ) {
    // Create a fallback logger if none provided
    if (!this.logger) {
      this.logger = {
        warn: (msg: string, data?: any) => {
          // Silently drop logs if no logger provided
        },
        error: (msg: string, data?: any) => {
          // Silently drop logs if no logger provided
        },
        info: (msg: string, data?: any) => {
          // Silently drop logs if no logger provided
        }
      };
    }
  }
  
  /**
   * Check if the Ollama service is available
   * @returns true if Ollama is reachable and working, false otherwise
   */
  async checkAvailability(): Promise<boolean> {
    try {
      const response = await fetch(`${this.OLLAMA_BASE_URL}/tags`, {
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });
      
      return response.ok;
    } catch (error) {
      this.logger.warn('Ollama availability check failed', { error });
      return false;
    }
  }
  
  /**
   * Analyze a crash log using the LLM
   * @param parsedData Structured data from the crash log
   * @param rawContent Raw content of the crash log
   * @param customModel Optional model to use instead of the default
   */
  async analyzeLog(parsedData: ParsedCrashData, rawContent: string, customModel?: string): Promise<CrashAnalysisResult> {
    const startTime = Date.now();
    
    try {
      // Determine which model to use (custom model takes precedence)
      const model = customModel || await this.getModelToUse();
      
      // Generate the prompt
      const prompt = this.generateAnalysisPrompt(parsedData, rawContent);
      
      // Call the LLM
      const response = await this.callLlm(model, prompt);
      
      // Parse the result
      const analysisResult = this.parseAnalysisResponse(response, parsedData, model);
      
      // Calculate inference time
      analysisResult.inferenceTime = Date.now() - startTime;
      
      return analysisResult;
    } catch (error) {
      this.logger.error('Error analyzing log with LLM', { error });
      
      // Create a fallback error analysis
      return {
        id: uuidv4(),
        crashLogId: '',  // Will be set by the caller
        timestamp: new Date(),
        primaryError: this.extractPrimaryError(parsedData),
        potentialRootCauses: [{
          cause: 'Analysis failed due to LLM error',
          confidence: 0,
          explanation: 'The analysis could not be completed due to an error with the LLM service. Please try again later.',
          supportingEvidence: []
        }],
        troubleshootingSteps: ['Try analyzing with a different model', 'Check if Ollama service is running'],
        summary: 'Analysis failed due to an error with the LLM service.',
        llmModel: 'none',
        confidence: 0,
        inferenceTime: Date.now() - startTime
      };
    }
  }
  
  /**
   * Get available LLM models from Ollama
   */
  async getAvailableModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.OLLAMA_BASE_URL}/tags`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data.models.map((model: any) => model.name);
    } catch (error) {
      this.logger.error('Error fetching available models', { error });
      return [];
    }
  }
  
  /**
   * Get status information for a specific model
   */
  async getModelStatus(modelId: string): Promise<ModelStatus> {
    try {
      // Check if the model exists
      const availableModels = await this.getAvailableModels();
      const isAvailable = availableModels.includes(modelId);
      
      // Get detailed model info if available
      let details: any = {};
      
      if (isAvailable) {
        const response = await fetch(`${this.OLLAMA_BASE_URL}/show`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ name: modelId })
        });
        
        if (response.ok) {
          details = await response.json();
        }
      }
      
      return {
        id: modelId,
        name: modelId,
        isAvailable,
        isDownloaded: isAvailable,
        size: details.size || 0,
        parameters: details.parameter_size ? parseFloat(details.parameter_size) : 0,
        quantization: modelId.includes('-q') ? modelId.split('-q')[1] : undefined
      };
    } catch (error) {
      this.logger.error('Error getting status for model', { modelId, error });
      
      return {
        id: modelId,
        name: modelId,
        isAvailable: false,
        isDownloaded: false,
        size: 0,
        parameters: 0
      };
    }
  }
  
  /**
   * Generate a prompt for crash analysis
   */
  private generateAnalysisPrompt(parsedData: ParsedCrashData, rawContent: string): string {
    const errorMessages = parsedData.errorMessages.map(e => e.message).join('\n');
    const stackTraces = parsedData.stackTraces.map(st => {
      return `${st.message || 'Stack Trace'}:\n${st.frames.map(frame => 
        `  at ${frame.functionName || 'unknown'} (${frame.fileName || 'unknown'}:${frame.lineNumber || '?'}${frame.columnNumber ? `:${frame.columnNumber}` : ''})`
      ).join('\n')}`;
    }).join('\n\n');
    
    const systemInfo = Object.entries(parsedData.systemInfo)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');
    
    return `You are an expert software debugger analyzing crash logs. Based on the following crash data, identify the most likely root causes of the issue.

## Error Messages
${errorMessages || 'No specific error messages found.'}

## Stack Traces
${stackTraces || 'No stack traces found.'}

## System Information
${systemInfo || 'No system information available.'}

## Log Summary
Total log entries: ${parsedData.timestamps.length}
Error count: ${parsedData.logLevel?.ERROR || 0}
Warning count: ${parsedData.logLevel?.WARN || 0}
Fatal count: ${parsedData.logLevel?.FATAL || 0}

## Your Task
Analyze this crash information and provide a structured analysis including:

1. Primary Error: What's the main error message or issue?
2. Failing Component: Which component or module appears to be failing?
3. Potential Root Causes: List at least 2-3 potential causes, each with:
   - Description of the cause
   - Confidence level (0-100)
   - Explanation of why this might be the cause
   - Supporting evidence from the logs

4. Troubleshooting Steps: Suggest 3-5 specific steps to address the issue

5. Summary: A concise 1-2 sentence summary of the likely issue

Your analysis should be provided in the following JSON format:
{
  "primaryError": "string",
  "failingComponent": "string",
  "potentialRootCauses": [
    {
      "cause": "string",
      "confidence": number,
      "explanation": "string",
      "category": "string", 
      "supportingEvidence": [
        {
          "description": "string",
          "location": "string",
          "snippet": "string"
        }
      ]
    }
  ],
  "troubleshootingSteps": ["string"],
  "summary": "string"
}

Ensure your analysis is technically precise, focusing on the evidence provided in the logs.`;
  }
  
  /**
   * Call the LLM via Ollama API
   */
  private async callLlm(model: string, prompt: string): Promise<any> {
    let retries = 0;
    let lastError: Error | null = null;
    
    while (retries <= this.MAX_RETRIES) {
      try {
        const response = await fetch(`${this.OLLAMA_BASE_URL}/generate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model,
            prompt,
            stream: false,
            options: {
              temperature: 0.1,  // Low temperature for more deterministic responses
              num_predict: 2048  // Limit response length
            }
          }),
          signal: AbortSignal.timeout(this.REQUEST_TIMEOUT)
        });
        
        if (!response.ok) {
          throw new Error(`Ollama API error: ${response.statusText}`);
        }
        
        return await response.json();
      } catch (error) {
        lastError = error as Error;
        this.logger.warn('LLM call attempt failed', { attempt: retries + 1, error });
        retries++;
        
        // If we have more retries, wait before trying again
        if (retries <= this.MAX_RETRIES) {
          await new Promise(resolve => setTimeout(resolve, 1000 * retries));
        }
      }
    }
    
    // If we get here, all retries failed
    throw lastError || new Error('Failed to call LLM after multiple attempts');
  }
  
  /**
   * Parse the LLM response into a structured analysis result
   */
  private parseAnalysisResponse(response: any, parsedData: ParsedCrashData, model: string): CrashAnalysisResult {
    try {
      // Extract JSON from the response
      const responseText = response.response || '';
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      
      if (!jsonMatch) {
        throw new Error('No JSON found in LLM response');
      }
      
      const jsonStr = jsonMatch[0];
      const analysisData = JSON.parse(jsonStr);
      
      // Calculate an overall confidence score
      const confidenceSum = analysisData.potentialRootCauses.reduce(
        (sum: number, cause: any) => sum + (cause.confidence || 0), 
        0
      );
      
      const avgConfidence = analysisData.potentialRootCauses.length > 0 
        ? confidenceSum / analysisData.potentialRootCauses.length / 100 
        : 0.5;
      
      // Format root causes with proper typing
      const rootCauses: RootCause[] = analysisData.potentialRootCauses.map((cause: any) => {
        return {
          cause: cause.cause,
          confidence: cause.confidence / 100,  // Convert 0-100 to 0-1
          explanation: cause.explanation,
          category: cause.category,
          supportingEvidence: (cause.supportingEvidence || []).map((evidence: any) => {
            return {
              description: evidence.description,
              location: evidence.location,
              snippet: evidence.snippet
            } as Evidence;
          })
        } as RootCause;
      });
      
      return {
        id: uuidv4(),
        crashLogId: '',  // Will be set by the caller
        timestamp: new Date(),
        primaryError: analysisData.primaryError || this.extractPrimaryError(parsedData),
        failingComponent: analysisData.failingComponent,
        potentialRootCauses: rootCauses,
        troubleshootingSteps: analysisData.troubleshootingSteps || [],
        summary: analysisData.summary || 'Analysis completed.',
        llmModel: model,
        confidence: avgConfidence,
        inferenceTime: 0  // Will be calculated by the caller
      };
    } catch (error) {
      this.logger.error('Error parsing LLM response', { error });
      
      // Return a fallback analysis
      return {
        id: uuidv4(),
        crashLogId: '',  // Will be set by the caller
        timestamp: new Date(),
        primaryError: this.extractPrimaryError(parsedData),
        potentialRootCauses: [{
          cause: 'Failed to parse LLM response',
          confidence: 0,
          explanation: 'The LLM response could not be parsed into a structured format.',
          supportingEvidence: []
        }],
        troubleshootingSteps: ['Try analyzing with a different model'],
        summary: 'Analysis failed due to response parsing error.',
        llmModel: model,
        confidence: 0,
        inferenceTime: 0  // Will be calculated by the caller
      };
    }
  }
  
  /**
   * Extract the primary error message from parsed data
   */
  private extractPrimaryError(parsedData: ParsedCrashData): string {
    // Try to get the most meaningful error message
    if (parsedData.errorMessages.length > 0) {
      return parsedData.errorMessages[0].message;
    }
    
    if (parsedData.stackTraces.length > 0 && parsedData.stackTraces[0].message) {
      return parsedData.stackTraces[0].message;
    }
    
    // Fall back to a generic message
    return 'Unknown error occurred';
  }
  
  /**
   * Analyze a code snippet for potential issues and improvements
   * 
   * @param code The code snippet to analyze
   * @param language The programming language of the code
   * @param customModel Optional model to use instead of the default
   * @returns Analysis result with issues and recommendations
   */
  async analyzeCodeSnippet(code: string, language: string, customModel?: string): Promise<any> {
    try {
      // Determine which model to use
      const model = customModel || await this.getModelToUse();
      
      // Generate a prompt for code analysis
      const prompt = this.generateCodeAnalysisPrompt(code, language);
      
      // Call the LLM
      const response = await this.callLlm(model, prompt);
      
      // Parse the response
      const analysisResult = this.parseCodeAnalysisResponse(response, code, language, model);
      
      return analysisResult;
    } catch (error) {
      this.logger.error('Error analyzing code snippet with LLM', { error });
      
      // Return a fallback analysis
      return {
        primaryIssue: 'Analysis failed due to LLM error',
        problematicComponent: language,
        potentialIssues: [{
          issue: 'Failed to analyze code due to LLM service error',
          confidence: 100,
          explanation: 'The analysis could not be completed due to an error with the LLM service. Please try again later.',
          codeReferences: []
        }],
        improvementSuggestions: ['Try analyzing with a different model', 'Check if Ollama service is running'],
        summary: 'Analysis failed due to an error with the LLM service.',
        overallScore: 0,
        llmModel: 'none',
        inferenceTime: 0
      };
    }
  }
  
  /**
   * Generate a prompt for code analysis
   * 
   * @param code The code snippet
   * @param language The programming language
   * @returns Prompt for code analysis
   */
  private generateCodeAnalysisPrompt(code: string, language: string): string {
    return `You are an expert code reviewer and bug finder. Analyze the following ${language} code for issues, potential bugs, and improvements.

## Code to analyze:
\`\`\`${language}
${code}
\`\`\`

## Your Task
Analyze this code and provide a structured assessment including:

1. Primary Issue: What's the main problem or concern with this code?
2. Problematic Component: Which part of the code is most concerning?
3. Potential Issues: List at least 3 problems or improvement opportunities, each with:
   - Issue description
   - Confidence level (0-100)
   - Explanation of why this is a problem
   - Code references (line numbers or snippets)

4. Improvement Suggestions: Provide 3-5 specific recommendations to fix issues or improve the code
5. Summary: A concise assessment of the code quality and main concerns
6. Overall Score: Rate the code quality from 0-100

Your analysis should be provided in the following JSON format:
{
  "primaryIssue": "string",
  "problematicComponent": "string",
  "potentialIssues": [
    {
      "issue": "string",
      "confidence": number,
      "explanation": "string",
      "codeReferences": [
        {
          "description": "string",
          "location": "string",
          "codeSnippet": "string"
        }
      ]
    }
  ],
  "improvementSuggestions": ["string"],
  "summary": "string",
  "overallScore": number
}

Ensure your analysis is technically precise and appropriate for the ${language} language.`;
  }
  
  /**
   * Parse the LLM response for code analysis
   * 
   * @param response LLM response
   * @param code Original code snippet
   * @param language Programming language
   * @param model Model used
   * @returns Parsed analysis result
   */
  private parseCodeAnalysisResponse(response: any, code: string, language: string, model: string): any {
    try {
      // Extract JSON from the response
      const responseText = response.response || '';
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      
      if (!jsonMatch) {
        throw new Error('No JSON found in LLM response');
      }
      
      const jsonStr = jsonMatch[0];
      const analysisData = JSON.parse(jsonStr);
      
      // Return the analysis with metadata
      return {
        ...analysisData,
        llmModel: model,
        codeLanguage: language,
        codeLength: code.length,
        lineCount: code.split('\n').length,
        inferenceTime: response.total_duration || 0
      };
    } catch (error) {
      this.logger.error('Error parsing code analysis response', { error });
      
      // Return a fallback analysis
      return {
        primaryIssue: 'Failed to parse LLM response',
        problematicComponent: language,
        potentialIssues: [{
          issue: 'Unable to analyze code due to response parsing error',
          confidence: 100,
          explanation: 'The LLM response could not be parsed into a structured format.',
          codeReferences: []
        }],
        improvementSuggestions: ['Try with a different model', 'Simplify the code for better analysis'],
        summary: 'Analysis failed due to response parsing error.',
        overallScore: 0,
        llmModel: model,
        inferenceTime: 0
      };
    }
  }

  /**
   * Determine which model to use for analysis
   */
  private async getModelToUse(): Promise<string> {
    try {
      // Check feature flags to see if a specific model is configured
      const modelFromFlag = await this.featureFlagService.getValue('crash-analyzer.llm.model');
      if (modelFromFlag && typeof modelFromFlag === 'string') {
        // Verify the model is available
        const status = await this.getModelStatus(modelFromFlag);
        if (status.isAvailable) {
          return modelFromFlag;
        }
      }
      
      // Check if default model is available
      const defaultStatus = await this.getModelStatus(this.DEFAULT_MODEL);
      if (defaultStatus.isAvailable) {
        return this.DEFAULT_MODEL;
      }
      
      // Fall back to any available model
      const availableModels = await this.getAvailableModels();
      if (availableModels.length > 0) {
        return availableModels[0];
      }
      
      // Last resort
      return this.FALLBACK_MODEL;
    } catch (error) {
      this.logger.error('Error determining model to use', { error });
      return this.FALLBACK_MODEL;
    }
  }
}