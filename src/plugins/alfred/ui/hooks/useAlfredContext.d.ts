import React from 'react';
import { AlfredService } from '../../src/services/alfred-service';
import { StreamingService } from '../../src/services/streaming-service';
import { ProjectAnalyzer } from '../../src/services/project-analyzer';
import { CodeGenerator } from '../../src/services/code-generator';
import { TemplateManager } from '../../src/services/template-manager';
interface AlfredContextType {
    alfredService: AlfredService | null;
    streamingService: StreamingService | null;
    projectAnalyzer: ProjectAnalyzer | null;
    codeGenerator: CodeGenerator | null;
    templateManager: TemplateManager | null;
    isLoading: boolean;
}
export declare const useAlfredContext: () => AlfredContextType;
interface AlfredProviderProps {
    children: React.ReactNode;
}
export declare const AlfredProvider: React.FC<AlfredProviderProps>;
export {};
