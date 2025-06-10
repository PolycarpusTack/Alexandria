/**
 * Command Palette Component
 *
 * Provides quick access to Alfred commands via Ctrl+Shift+P
 * Based on the original Alfred's command palette functionality
 */
import React from 'react';
interface CommandPaletteProps {
    onGenerateCode?: (prompt: string) => void;
    onAnalyzeProject?: () => void;
    onNewSession?: () => void;
    onSaveSession?: () => void;
    onLoadSession?: (sessionId: string) => void;
    onOpenTemplates?: () => void;
    onCreateTemplate?: () => void;
    onRefreshContext?: () => void;
    onExportSession?: () => void;
    onImportSession?: () => void;
    onClearChat?: () => void;
    currentSessionId?: string;
    hasUnsavedChanges?: boolean;
}
export declare const CommandPalette: React.FC<CommandPaletteProps>;
export {};
