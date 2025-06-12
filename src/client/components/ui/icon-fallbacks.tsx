/**
 * Icon fallbacks for missing Lucide React exports
 * This provides simple SVG fallbacks for icons that may not be available
 */

import React from 'react';

interface IconProps {
  className?: string;
  size?: number;
}

// Simple X icon fallback
export const X: React.FC<IconProps> = ({ className = '', size = 24 }) => (
  <svg
    width={size}
    height={size}
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth='2'
    strokeLinecap='round'
    strokeLinejoin='round'
    className={className}
  >
    <line x1='18' y1='6' x2='6' y2='18'></line>
    <line x1='6' y1='6' x2='18' y2='18'></line>
  </svg>
);

// Check icon fallback
export const Check: React.FC<IconProps> = ({ className = '', size = 24 }) => (
  <svg
    width={size}
    height={size}
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth='2'
    strokeLinecap='round'
    strokeLinejoin='round'
    className={className}
  >
    <polyline points='20,6 9,17 4,12'></polyline>
  </svg>
);

// ChevronDown icon fallback
export const ChevronDown: React.FC<IconProps> = ({ className = '', size = 24 }) => (
  <svg
    width={size}
    height={size}
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth='2'
    strokeLinecap='round'
    strokeLinejoin='round'
    className={className}
  >
    <polyline points='6,9 12,15 18,9'></polyline>
  </svg>
);

// ChevronRight icon fallback
export const ChevronRight: React.FC<IconProps> = ({ className = '', size = 24 }) => (
  <svg
    width={size}
    height={size}
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth='2'
    strokeLinecap='round'
    strokeLinejoin='round'
    className={className}
  >
    <polyline points='9,18 15,12 9,6'></polyline>
  </svg>
);

// ChevronLeft icon fallback
export const ChevronLeft: React.FC<IconProps> = ({ className = '', size = 24 }) => (
  <svg
    width={size}
    height={size}
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth='2'
    strokeLinecap='round'
    strokeLinejoin='round'
    className={className}
  >
    <polyline points='15,18 9,12 15,6'></polyline>
  </svg>
);

// Add more icon fallbacks as needed
export const Wand2: React.FC<IconProps> = ({ className = '', size = 24 }) => (
  <svg
    width={size}
    height={size}
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth='2'
    strokeLinecap='round'
    strokeLinejoin='round'
    className={className}
  >
    <path d='M15 4V2'></path>
    <path d='M15 16v-2'></path>
    <path d='M8 9h2'></path>
    <path d='M20 9h2'></path>
    <path d='M17.8 11.8 19 13'></path>
    <path d='M15 9h0'></path>
    <path d='M17.8 6.2 19 5'></path>
    <path d='m3 21 9-9'></path>
    <path d='M12.2 6.2 11 5'></path>
  </svg>
);

export const FileCode: React.FC<IconProps> = ({ className = '', size = 24 }) => (
  <svg
    width={size}
    height={size}
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth='2'
    strokeLinecap='round'
    strokeLinejoin='round'
    className={className}
  >
    <path d='M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z'></path>
    <polyline points='14,2 14,8 20,8'></polyline>
    <path d='m10,13 -2,2 2,2'></path>
    <path d='m14,17 2,-2 -2,-2'></path>
  </svg>
);

// Export all commonly used icons
export const Settings: React.FC<IconProps> = ({ className = '', size = 24 }) => (
  <svg
    width={size}
    height={size}
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth='2'
    className={className}
  >
    <circle cx='12' cy='12' r='3'></circle>
    <path d='M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1 1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z'></path>
  </svg>
);

export const Package: React.FC<IconProps> = ({ className = '', size = 24 }) => (
  <svg
    width={size}
    height={size}
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth='2'
    className={className}
  >
    <line x1='16.5' y1='9.4' x2='7.5' y2='4.21'></line>
    <path d='M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z'></path>
    <polyline points='3.27,6.96 12,12.01 20.73,6.96'></polyline>
    <line x1='12' y1='22.08' x2='12' y2='12'></line>
  </svg>
);

export const CheckCircle: React.FC<IconProps> = ({ className = '', size = 24 }) => (
  <svg
    width={size}
    height={size}
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth='2'
    className={className}
  >
    <path d='M22 11.08V12a10 10 0 1 1-5.93-9.14'></path>
    <polyline points='22,4 12,14.01 9,11.01'></polyline>
  </svg>
);

export const Code: React.FC<IconProps> = ({ className = '', size = 24 }) => (
  <svg
    width={size}
    height={size}
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth='2'
    className={className}
  >
    <polyline points='16,18 22,12 16,6'></polyline>
    <polyline points='8,6 2,12 8,18'></polyline>
  </svg>
);

export const Globe: React.FC<IconProps> = ({ className = '', size = 24 }) => (
  <svg
    width={size}
    height={size}
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth='2'
    className={className}
  >
    <circle cx='12' cy='12' r='10'></circle>
    <line x1='2' y1='12' x2='22' y2='12'></line>
    <path d='M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z'></path>
  </svg>
);

export const Server: React.FC<IconProps> = ({ className = '', size = 24 }) => (
  <svg
    width={size}
    height={size}
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth='2'
    className={className}
  >
    <rect x='2' y='2' width='20' height='8' rx='2' ry='2'></rect>
    <rect x='2' y='14' width='20' height='8' rx='2' ry='2'></rect>
    <line x1='6' y1='6' x2='6.01' y2='6'></line>
    <line x1='6' y1='18' x2='6.01' y2='18'></line>
  </svg>
);

export const Database: React.FC<IconProps> = ({ className = '', size = 24 }) => (
  <svg
    width={size}
    height={size}
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth='2'
    className={className}
  >
    <ellipse cx='12' cy='5' rx='9' ry='3'></ellipse>
    <path d='M21 12c0 1.66-4 3-9 3s-9-1.34-9-3'></path>
    <path d='M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5'></path>
  </svg>
);

export const Layers: React.FC<IconProps> = ({ className = '', size = 24 }) => (
  <svg
    width={size}
    height={size}
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth='2'
    className={className}
  >
    <polygon points='12,2 2,7 12,12 22,7 12,2'></polygon>
    <polyline points='2,17 12,22 22,17'></polyline>
    <polyline points='2,12 12,17 22,12'></polyline>
  </svg>
);

export const GitBranch: React.FC<IconProps> = ({ className = '', size = 24 }) => (
  <svg
    width={size}
    height={size}
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth='2'
    className={className}
  >
    <line x1='6' y1='3' x2='6' y2='15'></line>
    <circle cx='18' cy='6' r='3'></circle>
    <circle cx='6' cy='18' r='3'></circle>
    <path d='M18 9a9 9 0 0 1-9 9'></path>
  </svg>
);

export const FolderOpen: React.FC<IconProps> = ({ className = '', size = 24 }) => (
  <svg
    width={size}
    height={size}
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth='2'
    className={className}
  >
    <path d='M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z'></path>
    <path d='M2 9l9-5 9 5-9 5-9-5z'></path>
  </svg>
);
