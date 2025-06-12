// Code Analysis Services
export { CodeAnalysisEngine, CodeAnalysisEngineConfig, AnalysisOptions } from './code-analysis-engine';
export { 
  ProjectAnalyzer, 
  ProjectMetrics, 
  ArchitectureAnalysis 
} from './project-analyzer';

// Re-export types that are commonly used together
export type {
  CodeAnalysisResult,
  CodeGenerationRequest,
  GenerationResult,
  ProjectContext,
  FileAnalysis,
  ProjectPattern,
  CodeExample
} from '../../interfaces';