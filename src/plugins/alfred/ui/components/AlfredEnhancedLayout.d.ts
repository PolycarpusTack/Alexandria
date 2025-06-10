import React from 'react';
import '../../../../client/styles/enhanced-mockup-layout.css';
interface AlfredEnhancedLayoutProps {
    children: React.ReactNode;
    activeView?: string;
    onViewChange?: (view: string) => void;
}
export declare function AlfredEnhancedLayout({ children, activeView, onViewChange }: AlfredEnhancedLayoutProps): React.JSX.Element;
export {};
