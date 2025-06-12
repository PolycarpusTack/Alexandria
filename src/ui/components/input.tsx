/**
 * Input component for the Alexandria Platform
 *
 * This component provides a styled input field with label, helper text, and error states.
 */

import React, { forwardRef } from 'react';
import styled, { css } from 'styled-components';

// Create a type that omits the 'size' property to avoid conflict
type InputHTMLAttributesWithoutSize = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'>;

export interface InputProps extends InputHTMLAttributesWithoutSize {
  /**
   * Input label
   */
  label?: string;

  /**
   * Helper text displayed below the input
   */
  helperText?: string;

  /**
   * Error message
   */
  error?: string;

  /**
   * Whether the input is in an error state
   */
  hasError?: boolean;

  /**
   * Left icon or element
   */
  startAdornment?: React.ReactNode;

  /**
   * Right icon or element
   */
  endAdornment?: React.ReactNode;

  /**
   * Whether the input takes up the full width of its container
   */
  fullWidth?: boolean;

  /**
   * Input size
   */
  size?: 'small' | 'medium' | 'large';
}

// Styled components
const InputContainer = styled.div<{ fullWidth?: boolean }>`
  display: inline-flex;
  flex-direction: column;
  ${(props) =>
    props.fullWidth &&
    css`
      width: 100%;
    `}
`;

const Label = styled.label`
  margin-bottom: ${(props) => props.theme.spacing.xs};
  font-size: ${(props) => props.theme.typography.fontSize.sm};
  font-weight: ${(props) => props.theme.typography.fontWeight.medium};
  color: ${(props) => props.theme.colors.text.primary};
`;

const InputWrapper = styled.div`
  position: relative;
  display: flex;
  align-items: center;
`;

const StyledInput = styled.input<{
  hasError?: boolean;
  size?: 'small' | 'medium' | 'large';
  hasStartAdornment?: boolean;
  hasEndAdornment?: boolean;
}>`
  width: 100%;
  font-family: ${(props) => props.theme.typography.fontFamily};
  background-color: ${(props) => props.theme.colors.surface};
  border: 1px solid
    ${(props) => (props.hasError ? props.theme.colors.error : props.theme.colors.border)};
  border-radius: ${(props) => props.theme.borderRadius.md};
  transition: all ${(props) => props.theme.transitions.fast};
  outline: none;

  /* Size styles */
  ${(props) =>
    props.size === 'small' &&
    css`
      padding: ${props.theme.spacing.xs} ${props.theme.spacing.sm};
      font-size: ${props.theme.typography.fontSize.xs};
    `}

  ${(props) =>
    (props.size === 'medium' || !props.size) &&
    css`
      padding: ${props.theme.spacing.sm} ${props.theme.spacing.md};
      font-size: ${props.theme.typography.fontSize.sm};
    `}
  
  ${(props) =>
    props.size === 'large' &&
    css`
      padding: ${props.theme.spacing.md} ${props.theme.spacing.lg};
      font-size: ${props.theme.typography.fontSize.md};
    `}
  
  /* Adornment padding */
  ${(props) =>
    props.hasStartAdornment &&
    css`
      padding-left: 2.5rem;
    `}
  
  ${(props) =>
    props.hasEndAdornment &&
    css`
      padding-right: 2.5rem;
    `}
  
  /* State styles */
  &:focus {
    border-color: ${(props) =>
      props.hasError ? props.theme.colors.error : props.theme.colors.primary};
    box-shadow: 0 0 0 2px
      ${(props) =>
        props.hasError ? `${props.theme.colors.error}30` : `${props.theme.colors.primary}30`};
  }

  &:hover:not(:focus):not(:disabled) {
    border-color: ${(props) =>
      props.hasError ? props.theme.colors.error : props.theme.colors.text.secondary};
  }

  &:disabled {
    background-color: ${(props) => `${props.theme.colors.background}80`};
    cursor: not-allowed;
    opacity: 0.7;
  }

  &::placeholder {
    color: ${(props) => props.theme.colors.text.disabled};
    opacity: 1;
  }
`;

const HelperText = styled.div<{ hasError?: boolean }>`
  margin-top: ${(props) => props.theme.spacing.xs};
  font-size: ${(props) => props.theme.typography.fontSize.xs};
  color: ${(props) =>
    props.hasError ? props.theme.colors.error : props.theme.colors.text.secondary};
`;

const Adornment = styled.div<{ position: 'start' | 'end' }>`
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${(props) => props.theme.colors.text.secondary};
  pointer-events: none;

  ${(props) =>
    props.position === 'start' &&
    css`
      left: 0.75rem;
    `}

  ${(props) =>
    props.position === 'end' &&
    css`
      right: 0.75rem;
    `}
  
  /* Make clickable elements work */
  & > button, & > a {
    pointer-events: auto;
  }
`;

/**
 * Input component
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      helperText,
      error,
      hasError = !!error,
      startAdornment,
      endAdornment,
      fullWidth = false,
      size = 'medium',
      id,
      ...props
    },
    ref
  ) => {
    // Generate a unique ID if not provided
    const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;

    // Helper text content
    const helperTextContent = error || helperText;

    return (
      <InputContainer fullWidth={fullWidth}>
        {label && <Label htmlFor={inputId}>{label}</Label>}

        <InputWrapper>
          {startAdornment && <Adornment position='start'>{startAdornment}</Adornment>}

          <StyledInput
            id={inputId}
            ref={ref}
            hasError={hasError}
            size={size}
            hasStartAdornment={!!startAdornment}
            hasEndAdornment={!!endAdornment}
            {...props}
          />

          {endAdornment && <Adornment position='end'>{endAdornment}</Adornment>}
        </InputWrapper>

        {helperTextContent && <HelperText hasError={hasError}>{helperTextContent}</HelperText>}
      </InputContainer>
    );
  }
);

Input.displayName = 'Input';

export default Input;
