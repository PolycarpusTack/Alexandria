/**
 * Not Found page for the Alexandria Platform
 *
 * This page is displayed when a user navigates to a non-existent route.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
import { Button } from '../components/ui';

// Styled components
const NotFoundContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: ${(props) => props.theme.spacing.xl};
  text-align: center;
  min-height: 50vh;
`;

const Title = styled.h1`
  font-size: ${(props) => props.theme.typography.fontSize.xxl};
  margin-bottom: ${(props) => props.theme.spacing.md};
  color: ${(props) => props.theme.colors.primary};
`;

const Message = styled.p`
  font-size: ${(props) => props.theme.typography.fontSize.lg};
  margin-bottom: ${(props) => props.theme.spacing.xl};
  color: ${(props) => props.theme.colors.text.secondary};
  max-width: 600px;
`;

const ErrorCode = styled.div`
  font-size: 120px;
  font-weight: ${(props) => props.theme.typography.fontWeight.bold};
  color: ${(props) => `${props.theme.colors.primary}30`};
  margin-bottom: ${(props) => props.theme.spacing.xl};
`;

/**
 * Not Found page component
 */
const NotFound: React.FC = () => {
  return (
    <NotFoundContainer>
      <ErrorCode>404</ErrorCode>
      <Title>Page Not Found</Title>
      <Message>The page you're looking for doesn't exist or has been moved.</Message>
      <Link to='/'>
        <Button variant='default'>Return to Dashboard</Button>
      </Link>
    </NotFoundContainer>
  );
};

export default NotFound;
