/**
 * Modal component for the Alexandria Platform
 *
 * This component provides a modal dialog with customizable header, content, and footer.
 */

import React, { useEffect, useRef } from 'react';
import styled, { keyframes, css } from 'styled-components';
import Button from './button';

export interface ModalProps {
  /**
   * Whether the modal is open
   */
  open: boolean;

  /**
   * Callback when the modal is closed
   */
  onClose: () => void;

  /**
   * Modal title
   */
  title?: React.ReactNode;

  /**
   * Modal content
   */
  children: React.ReactNode;

  /**
   * Modal footer content
   */
  footer?: React.ReactNode;

  /**
   * Whether to show the close button in the header
   */
  showCloseButton?: boolean;

  /**
   * Whether to close the modal when clicking the backdrop
   */
  closeOnBackdropClick?: boolean;

  /**
   * Whether to close the modal when pressing the Escape key
   */
  closeOnEsc?: boolean;

  /**
   * Modal size
   */
  size?: 'small' | 'medium' | 'large' | 'full';

  /**
   * Whether the modal is full-screen on mobile devices
   */
  fullScreenOnMobile?: boolean;

  /**
   * Additional CSS class for the modal
   */
  className?: string;
}

// Animations
const fadeIn = keyframes`
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
`;

const slideIn = keyframes`
  from {
    transform: translate(-50%, calc(-50% + 20px));
    opacity: 0;
  }
  to {
    transform: translate(-50%, -50%);
    opacity: 1;
  }
`;

// Styled components
const Backdrop = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: ${(props) => props.theme.zIndex.modal};
  display: flex;
  align-items: center;
  justify-content: center;
  animation: ${fadeIn} 0.2s ease-out;
`;

const ModalContainer = styled.div<{
  size: 'small' | 'medium' | 'large' | 'full';
  fullScreenOnMobile: boolean;
}>`
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background-color: ${(props) => props.theme.colors.surface};
  border-radius: ${(props) => props.theme.borderRadius.lg};
  box-shadow: ${(props) => props.theme.shadows.lg};
  display: flex;
  flex-direction: column;
  max-height: 90vh;
  max-width: 90vw;
  width: ${(props) => {
    switch (props.size) {
      case 'small':
        return '400px';
      case 'medium':
        return '600px';
      case 'large':
        return '800px';
      case 'full':
        return '90vw';
      default:
        return '600px';
    }
  }};
  animation: ${slideIn} 0.3s ease-out;
  z-index: ${(props) => props.theme.zIndex.modal + 1};

  @media (max-width: 768px) {
    ${(props) =>
      props.fullScreenOnMobile &&
      css`
        width: 100vw;
        height: 100vh;
        max-width: 100vw;
        max-height: 100vh;
        border-radius: 0;
        top: 0;
        left: 0;
        transform: none;
      `}
  }
`;

const ModalHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${(props) => props.theme.spacing.md};
  border-bottom: 1px solid ${(props) => props.theme.colors.border};
`;

const ModalTitle = styled.h3`
  margin: 0;
  font-size: ${(props) => props.theme.typography.fontSize.lg};
  font-weight: ${(props) => props.theme.typography.fontWeight.medium};
  color: ${(props) => props.theme.colors.text.primary};
`;

const ModalContent = styled.div`
  padding: ${(props) => props.theme.spacing.md};
  overflow-y: auto;
  flex: 1;
`;

const ModalFooter = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: ${(props) => props.theme.spacing.md};
  border-top: 1px solid ${(props) => props.theme.colors.border};
  gap: ${(props) => props.theme.spacing.sm};
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  color: ${(props) => props.theme.colors.text.secondary};
  font-size: 1.5rem;
  line-height: 1;
  padding: 4px;
  border-radius: ${(props) => props.theme.borderRadius.sm};
  transition: all ${(props) => props.theme.transitions.fast};

  &:hover {
    color: ${(props) => props.theme.colors.text.primary};
    background-color: ${(props) => `${props.theme.colors.background}50`};
  }

  &:focus {
    outline: none;
    box-shadow: 0 0 0 2px ${(props) => `${props.theme.colors.primary}30`};
  }
`;

/**
 * Modal component
 */
export const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  title,
  children,
  footer,
  showCloseButton = true,
  closeOnBackdropClick = true,
  closeOnEsc = true,
  size = 'medium',
  fullScreenOnMobile = false,
  className
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

  // Handle ESC key press
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && closeOnEsc) {
        onClose();
      }
    };

    if (open) {
      document.addEventListener('keydown', handleKeyDown);

      // Prevent body scrolling
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);

      // Restore body scrolling
      document.body.style.overflow = 'auto';
    };
  }, [open, onClose, closeOnEsc]);

  // Handle backdrop click
  const handleBackdropClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (closeOnBackdropClick && event.target === event.currentTarget) {
      onClose();
    }
  };

  // Default footer with a close button
  const defaultFooter = (
    <Button variant='text' onClick={onClose}>
      Close
    </Button>
  );

  if (!open) {
    return null;
  }

  return (
    <Backdrop onClick={handleBackdropClick}>
      <ModalContainer
        ref={modalRef}
        size={size}
        fullScreenOnMobile={fullScreenOnMobile}
        className={className}
      >
        {title && (
          <ModalHeader>
            <ModalTitle>{title}</ModalTitle>
            {showCloseButton && (
              <CloseButton onClick={onClose} aria-label='Close'>
                &times;
              </CloseButton>
            )}
          </ModalHeader>
        )}

        <ModalContent>{children}</ModalContent>

        {(footer || defaultFooter) && <ModalFooter>{footer || defaultFooter}</ModalFooter>}
      </ModalContainer>
    </Backdrop>
  );
};

export default Modal;
