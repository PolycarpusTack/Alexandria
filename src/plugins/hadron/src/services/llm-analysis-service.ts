import { Logger } from '../../../../utils/logger';
import { ILlmService, ParsedCrashData } from '../interfaces';
import { CodeSnippet } from '../models';
import { ILlmAnalysisResponse } from '../types/llm-types';

/**
 * Service responsible for LLM-based analysis operations
 */
export class LLMAnalysisService {
  private readonly DEFAULT_TIMEOUT_MS = 60000;
  private readonly MAX_RETRIES = 3;

  constructor(
    private llmService: ILlmService,
    private logger: Logger
  ) {}

  /**
   * Analyze a crash log using LLM
   */
  async analyzeCrashLog(
    parsedData: ParsedCrashData,
    content: string,
    customModel?: string
  ): Promise<any> {
    this.logger.debug('Sending log to LLM for analysis', {
      customModel,
      contentLength: content.length
    });

    let attempts = 0;
    let lastError: Error | null = null;

    while (attempts < this.MAX_RETRIES) {
      try {
        const result = await this.llmService.analyzeLog(parsedData, content, customModel);
        return result;
      } catch (error) {
        attempts++;
        lastError = error instanceof Error ? error : new Error(String(error));

        this.logger.warn(`LLM analysis attempt ${attempts} failed`, {
          error: lastError.message,
          customModel,
          remainingAttempts: this.MAX_RETRIES - attempts
        });

        if (attempts >= this.MAX_RETRIES) {
          throw lastError;
        }

        // Exponential backoff
        const waitTime = Math.pow(2, attempts) * 1000;
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }

    throw lastError || new Error('LLM analysis failed after all retries');
  }

  /**
   * Analyze a code snippet using LLM
   */
  async analyzeCodeSnippet(snippet: CodeSnippet, customModel?: string): Promise<any> {
    const prompt = this.generateCodeAnalysisPrompt(
      snippet.content,
      snippet.language,
      snippet.description
    );

    const startTime = Date.now();
    const model = await this.resolveModel(customModel);

    try {
      const response = await this.callLlmApi(model, prompt, this.DEFAULT_TIMEOUT_MS);

      if (!response.ok) {
        throw this.createLlmError(response, model);
      }

      const llmResponse = await response.json();
      const responseText = llmResponse.response || '';

      const analysisData = this.parseAnalysisResponse(responseText);

      return {
        ...analysisData,
        llmModel: model,
        inferenceTime: Date.now() - startTime
      };
    } catch (error) {
      this.logger.error('Error analyzing code snippet', {
        error: error instanceof Error ? error.message : String(error),
        snippetId: snippet.id,
        model
      });
      throw error;
    }
  }

  /**
   * Get available LLM models
   */
  async getAvailableModels(): Promise<string[]> {
    return this.llmService.getAvailableModels();
  }

  /**
   * Check if LLM service is available
   */
  async checkAvailability(): Promise<boolean> {
    return this.llmService.checkAvailability();
  }

  /**
   * Call the LLM API with proper error handling
   */
  private async callLlmApi(model: string, prompt: string, timeoutMs: number): Promise<Response> {
    const controller = new AbortController();
    const signal = controller.signal;

    const timeout = setTimeout(() => {
      controller.abort();
    }, timeoutMs);

    try {
      const response = await fetch(
        `${process.env.OLLAMA_BASE_URL || 'http://localhost:11434'}/api/generate`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model,
            prompt,
            stream: false,
            options: {
              temperature: 0.1,
              num_predict: 4096
            }
          }),
          signal
        }
      );

      return response;
    } catch (error) {
      const err = error as Error;
      if (err.name === 'AbortError') {
        throw new Error(`LLM request timed out after ${timeoutMs / 1000} seconds`);
      }
      if (err instanceof TypeError && err.message.includes('fetch')) {
        throw new Error(`Unable to connect to LLM service: ${err.message}`);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Create appropriate error for LLM failures
   */
  private createLlmError(response: Response, model: string): Error {
    if (response.status === 404) {
      return new Error(
        `Model '${model}' not found. Please ensure Ollama is running and the model is available.`
      );
    } else if (response.status === 500) {
      return new Error('LLM server error. Check the server logs for details.');
    } else if (response.status === 0) {
      return new Error(
        `Unable to connect to LLM service. Make sure the service is running on ${process.env.OLLAMA_BASE_URL || 'http://localhost:11434'}.`
      );
    } else {
      return new Error(`LLM API error (${response.status}): ${response.statusText}`);
    }
  }

  /**
   * Parse the analysis response from LLM
   */
  private parseAnalysisResponse(responseText: string): ILlmAnalysisResponse {
    const extractedJson = this.extractJsonFromResponse(responseText);

    if (!extractedJson) {
      throw new Error('No valid JSON data found in LLM response');
    }

    try {
      return JSON.parse(extractedJson);
    } catch (error) {
      // Attempt to repair JSON
      const repaired = this.attemptJsonRepair(extractedJson);
      return JSON.parse(repaired);
    }
  }

  /**
   * Extract JSON from LLM response
   */
  private extractJsonFromResponse(responseText: string): string | null {
    if (!responseText || typeof responseText !== 'string') {
      return null;
    }

    // Try multiple strategies to find JSON
    const strategies = [
      // Strategy 1: Find content between outermost braces
      () => responseText.match(/\{[\s\S]*\}/)?.[0],

      // Strategy 2: Find content between markdown code blocks
      () => responseText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/)?.[1],

      // Strategy 3: Look for specific field patterns
      () => {
        const match = responseText.match(
          /"(?:primaryIssue|primaryError|potentialIssues|summary)"\s*:/
        );
        if (!match || !match.index) return null;

        const startIndex = responseText.lastIndexOf('{', match.index);
        if (startIndex === -1) return null;

        let openBraces = 1;
        let endIndex = -1;

        for (let i = startIndex + 1; i < responseText.length; i++) {
          if (responseText[i] === '{') openBraces++;
          else if (responseText[i] === '}') {
            openBraces--;
            if (openBraces === 0) {
              endIndex = i;
              break;
            }
          }
        }

        return endIndex !== -1 ? responseText.substring(startIndex, endIndex + 1) : null;
      }
    ];

    for (const strategy of strategies) {
      const result = strategy();
      if (result) return result;
    }

    return null;
  }

  /**
   * Attempt to repair common JSON formatting issues
   */
  private attemptJsonRepair(invalidJson: string): string {
    if (!invalidJson) {
      throw new Error('Cannot repair empty JSON string');
    }

    let json = invalidJson;

    // Fix trailing commas
    json = json.replace(/,\s*([}\]])/g, '$1');

    // Add quotes to unquoted property names
    json = json.replace(/([{,]\s*)([a-zA-Z0-9_]+)(\s*:)/g, '$1"$2"$3');

    // Fix single quotes
    json = json.replace(/([{,]\s*"[^"]+"\s*:)\s*'([^']*)'/g, '$1 "$2"');

    // Ensure proper start and end
    if (!json.trim().startsWith('{')) {
      json = '{' + json.trim();
    }
    if (!json.trim().endsWith('}')) {
      json = json.trim() + '}';
    }

    return json;
  }

  /**
   * Generate a code analysis prompt
   */
  private generateCodeAnalysisPrompt(code: string, language: string, description?: string): string {
    return `You are an expert code reviewer and bug finder. Analyze the following ${language} code for issues, potential bugs, and improvements.

${description ? `## Context\n${description}\n` : ''}

## Code to analyze:
\`\`\`${language}
${code}
\`\`\`

## Your Task
Analyze this code and provide a structured assessment including:

1. Primary Issue: What's the main problem or concern with this code?
2. Problematic Component: Which part of the code is most concerning?
3. Potential Issues: List at least 3 problems or improvement opportunities
4. Improvement Suggestions: Provide 3-5 specific recommendations
5. Summary: A concise assessment of the code quality

Provide your analysis in JSON format with the following structure:
{
  "primaryIssue": "string",
  "problematicComponent": "string",
  "potentialIssues": [
    {
      "issue": "string",
      "confidence": number (0-100),
      "explanation": "string",
      "codeReferences": [{
        "description": "string",
        "location": "string",
        "codeSnippet": "string"
      }]
    }
  ],
  "improvementSuggestions": ["string"],
  "summary": "string",
  "overallScore": number (0-100)
}`;
  }

  /**
   * Resolve the best model to use for analysis
   */
  private async resolveModel(customModel?: string): Promise<string> {
    if (customModel) {
      return customModel;
    }

    try {
      const availableModels = await this.getAvailableModels();
      const fallbackModels = ['llama2:8b-chat-q4', 'llama2', 'mistral', 'mixtral'];

      for (const model of fallbackModels) {
        if (availableModels.includes(model)) {
          return model;
        }
      }

      return availableModels[0] || fallbackModels[0];
    } catch (error) {
      this.logger.warn('Error resolving model', {
        error: error instanceof Error ? error.message : String(error)
      });
      return 'llama2';
    }
  }
}
