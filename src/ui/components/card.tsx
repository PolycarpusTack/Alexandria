/**
 * Card component for the Alexandria Platform
 * 
 * This component provides a card container with header, content, and footer sections.
 */

import React from 'react';
import styled, { css } from 'styled-components';

export interface CardProps {
  /**
   * Card title
   */
  title?: React.ReactNode;
  
  /**
   * Card subtitle
   */
  subtitle?: React.ReactNode;
  
  /**
   * Card header action (e.g., button, menu)
   */
  headerAction?: React.ReactNode;
  
  /**
   * Card content
   */
  children: React.ReactNode;
  
  /**
   * Card footer content
   */
  footer?: React.ReactNode;
  
  /**
   * Whether the card has a hover effect
   */
  hoverable?: boolean;
  
  /**
   * Card elevation level (0-3)
   */
  elevation?: 0 | 1 | 2 | 3;
  
  /**
   * Additional CSS class names
   */
  className?: string;
}

// Styled components
const CardContainer = styled.div<{ hoverable?: boolean; elevation: number }>`
  background-color: ${props => props.theme.colors.surface};
  border-radius: ${props => props.theme.borderRadius.md};
  overflow: hidden;
  transition: all ${props => props.theme.transitions.fast};
  
  /* Elevation styles */
  ${props => {
    switch (props.elevation) {
      case 0:
        return css`
          border: 1px solid ${props.theme.colors.border};
          box-shadow: none;
        `;
      case 1:
        return css`
          border: 1px solid ${props.theme.colors.border};
          box-shadow: ${props.theme.shadows.sm};
        `;
      case 2:
        return css`
          border: none;
          box-shadow: ${props.theme.shadows.md};
        `;
      case 3:
        return css`
          border: none;
          box-shadow: ${props.theme.shadows.lg};
        `;
      default:
        return css`
          border: 1px solid ${props.theme.colors.border};
          box-shadow: ${props.theme.shadows.sm};
        `;
    }
  }}
  
  /* Hover styles */
  ${props => props.hoverable && css`
    &:hover {
      transform: translateY(-2px);
      box-shadow: ${props.theme.shadows.md};
    }
  `}
`;

const CardHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: ${props => props.theme.spacing.md};
  border-bottom: 1px solid ${props => props.theme.colors.border};
`;

const CardTitleContent = styled.div`
  flex: 1;
`;

const CardTitle = styled.h3`
  margin: 0;
  font-size: ${props => props.theme.typography.fontSize.md};
  font-weight: ${props => props.theme.typography.fontWeight.medium};
  color: ${props => props.theme.colors.text.primary};
`;

const CardSubtitle = styled.div`
  margin-top: ${props => props.theme.spacing.xs};
  font-size: ${props => props.theme.typography.fontSize.sm};
  color: ${props => props.theme.colors.text.secondary};
`;

const CardHeaderActionContainer = styled.div`
  margin-left: ${props => props.theme.spacing.md};
`;

const CardContent = styled.div`
  padding: ${props => props.theme.spacing.md};
`;

const CardFooter = styled.div`
  padding: ${props => props.theme.spacing.md};
  border-top: 1px solid ${props => props.theme.colors.border};
  background-color: ${props => {
    const bgColor = props.theme.colors.background;
    return bgColor.startsWith('#') 
      ? `${bgColor}20` 
      : `${bgColor.replace(/[^,]+(?=\))/, '0.12')}`; // Handling both hex and rgba values
  }};
`;

/**
 * Card component
 */
export const Card: React.FC<CardProps> = ({
  title,
  subtitle,
  headerAction,
  children,
  footer,
  hoverable = false,
  elevation = 1,
  className
}) => {
  // Determine if header should be rendered
  const hasHeader = title || subtitle || headerAction;
  
  return (
    <CardContainer hoverable={hoverable} elevation={elevation} className={className}>
      {hasHeader && (
        <CardHeader>
          <CardTitleContent>
            {title && <CardTitle>{title}</CardTitle>}
            {subtitle && <CardSubtitle>{subtitle}</CardSubtitle>}
          </CardTitleContent>
          {headerAction && (
            <CardHeaderActionContainer>
              {headerAction}
            </CardHeaderActionContainer>
          )}
        </CardHeader>
      )}
      <CardContent>{children}</CardContent>
      {footer && <CardFooter>{footer}</CardFooter>}
    </CardContainer>
  );
};

export default Card;