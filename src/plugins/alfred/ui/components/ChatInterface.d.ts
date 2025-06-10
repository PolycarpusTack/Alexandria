/**
 * Chat Interface Component - Main chat UI for Alfred
 */
import React from 'react';
import { ProjectContext } from '../../src/interfaces';
interface ChatInterfaceProps {
    sessionId: string;
    projectContext?: ProjectContext;
}
export declare const ChatInterface: React.FC<ChatInterfaceProps>;
export {};
