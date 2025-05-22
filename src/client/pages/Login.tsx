/**
 * Login page for the Alexandria Platform
 * 
 * This page handles user authentication.
 */

import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { Card, Button } from '../components/ui';
import { useAuth } from '../App';

// Styled components
const LoginContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  padding: ${props => props.theme.spacing.lg};
  background-color: ${props => props.theme.colors.background};
`;

const LoginCard = styled(Card)`
  width: 100%;
  max-width: 400px;
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: ${props => props.theme.spacing.md};
`;

const ErrorMessage = styled.div`
  color: ${props => props.theme.colors.error};
  font-size: ${props => props.theme.typography.fontSize.sm};
  margin-bottom: ${props => props.theme.spacing.sm};
`;

const Logo = styled.div`
  font-size: ${props => props.theme.typography.fontSize.xl};
  font-weight: ${props => props.theme.typography.fontWeight.bold};
  color: ${props => props.theme.colors.primary};
  text-align: center;
  margin-bottom: ${props => props.theme.spacing.lg};
`;

/**
 * Login page component
 */
const Login: React.FC = () => {
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Get the redirect path from location state or default to home
  const from = (location.state as any)?.from?.pathname || '/';
  
  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Reset error state
    setError(null);
    
    // Validate inputs
    if (!username || !password) {
      setError('Username and password are required');
      return;
    }
    
    // Set loading state
    setIsLoading(true);
    
    try {
      // Send login request to the API
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
      });
      
      // Parse response
      const data = await response.json();
      
      // Check if login was successful
      if (response.ok) {
        // Call the login function from auth context
        auth?.login(data.token, data.user);
        
        // Navigate to the redirect path
        navigate(from, { replace: true });
      } else {
        // Display error message
        setError(data.message || 'Invalid username or password');
      }
    } catch (error) {
      // Handle network or other errors
      setError('An error occurred during login. Please try again.');
      console.error('Login error:', error);
    } finally {
      // Reset loading state
      setIsLoading(false);
    }
  };
  
  return (
    <LoginContainer>
      <LoginCard elevation={2}>
        <Logo>Alexandria Platform</Logo>
        
        <Form onSubmit={handleSubmit}>
          {error && <ErrorMessage>{error}</ErrorMessage>}
          
          <Input
            label="Username"
            value={username}
            onChange={e => setUsername(e.target.value)}
            placeholder="Enter your username"
            fullWidth
            disabled={isLoading}
          />
          
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Enter your password"
            fullWidth
            disabled={isLoading}
          />
          
          <Button
            type="submit"
            fullWidth
            loading={isLoading}
            disabled={isLoading}
          >
            Log In
          </Button>
        </Form>
      </LoginCard>
    </LoginContainer>
  );
};

export default Login;