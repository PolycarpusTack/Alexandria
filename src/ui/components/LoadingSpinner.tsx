/**
 * LoadingSpinner Component
 * 
 * A spinner component to indicate loading states in the UI.
 * This component is often directly imported from its file path.
 */

import React from 'react';
import styled, { keyframes } from 'styled-components';

export interface LoadingSpinnerProps {
  /**
   * Size of the spinner
   */
  size?: 'small' | 'medium' | 'large';
  
  /**
   * Color of the spinner, defaults to current text color
   */
  color?: string;
  
  /**
   * Additional CSS class names
   */
  className?: string;
}

// Spinner animation
const spin = keyframes`
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
`;

// Styled spinner component
const SpinnerElement = styled.div<{ size: string; color: string }>`
  display: inline-block;
  border-radius: 50%;
  border: 2px solid transparent;
  border-top-color: ${props => props.color || 'currentColor'};
  border-right-color: ${props => props.color || 'currentColor'};
  animation: ${spin} 0.8s linear infinite;
  
  ${props => props.size === 'small' && `
    width: 16px;
    height: 16px;
    border-width: 2px;
  `}
  
  ${props => props.size === 'medium' && `
    width: 24px;
    height: 24px;
    border-width: 3px;
  `}
  
  ${props => props.size === 'large' && `
    width: 32px;
    height: 32px;
    border-width: 4px;
  `}
`;

/**
 * LoadingSpinner component
 */
export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'medium',
  color = 'currentColor',
  className = '',
}) => {
  return (
    <SpinnerElement 
      size={size} 
      color={color} 
      className={className}
      role="status"
      aria-label="Loading"
    />
  );
};

export default LoadingSpinner;