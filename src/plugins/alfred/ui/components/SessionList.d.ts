/**
 * Session List Component - Displays and manages chat sessions
 */
import React from 'react';
import { ChatSession } from '../../src/interfaces';
interface SessionListProps {
    sessions: ChatSession[];
    currentSessionId: string | null;
    onSessionSelect: (sessionId: string) => void;
    onSessionsChange: () => void;
}
export declare const SessionList: React.FC<SessionListProps>;
export {};
