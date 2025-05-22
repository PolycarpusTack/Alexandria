/**
 * Dashboard page for the Alexandria Platform
 * 
 * This page serves as the main interface for the platform.
 */

import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '../components/ui';
import { Button } from '../components/ui';
import { EmptyState } from '../../ui/components';
import { useAuth } from '../App';

// Styled components
const DashboardContainer = styled.div`
  padding: ${props => props.theme.spacing.md};
`;

const Header = styled.div`
  margin-bottom: ${props => props.theme.spacing.lg};
`;

const Title = styled.h1`
  font-size: ${props => props.theme.typography.fontSize.xl};
  font-weight: ${props => props.theme.typography.fontWeight.bold};
  margin: 0;
  margin-bottom: ${props => props.theme.spacing.sm};
`;

const Subtitle = styled.p`
  font-size: ${props => props.theme.typography.fontSize.md};
  color: ${props => props.theme.colors.text.secondary};
  margin: 0;
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: ${props => props.theme.spacing.lg};
  margin-bottom: ${props => props.theme.spacing.xl};
`;

const PluginCardContainer = styled(Card)`
  height: 100%;
  transition: transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out;
  
  &.hoverable:hover {
    transform: translateY(-2px);
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
  }
`;

const Stats = styled.div`
  display: flex;
  gap: ${props => props.theme.spacing.md};
  margin-bottom: ${props => props.theme.spacing.lg};
`;

const StatCard = styled(Card)`
  flex: 1;
  text-align: center;
  padding: ${props => props.theme.spacing.md};
`;

const StatValue = styled.div`
  font-size: ${props => props.theme.typography.fontSize.xxl};
  font-weight: ${props => props.theme.typography.fontWeight.bold};
  color: ${props => props.theme.colors.primary};
  margin-bottom: ${props => props.theme.spacing.xs};
`;

const StatLabel = styled.div`
  font-size: ${props => props.theme.typography.fontSize.sm};
  color: ${props => props.theme.colors.text.secondary};
`;

// Custom styled wrapper for EmptyState
const StyledEmptyState = styled(EmptyState)`
  padding: ${props => props.theme.spacing.xl};
  text-align: center;
  color: ${props => props.theme.colors.text.secondary};
  border: 2px dashed ${props => props.theme.colors.border};
  border-radius: ${props => props.theme.borderRadius.lg};
`;

/**
 * Dashboard page component
 */
const Dashboard: React.FC = () => {
  const auth = useAuth();
  const [stats, setStats] = useState({
    cases: 0,
    plugins: 0,
    users: 0
  });
  const [plugins, setPlugins] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  
  // Fetch dashboard data
  useEffect(() => {
    // In a real implementation, this would fetch data from the API
    const fetchData = async () => {
      try {
        setIsLoading(true);
        
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Mock data
        setStats({
          cases: 12,
          plugins: 4,
          users: 8
        });
        
        setPlugins([
          {
            id: 'crash-analyzer',
            name: 'AI-Powered Crash Analyzer',
            description: 'Analyze crash logs using LLMs to identify root causes',
            status: 'active'
          },
          {
            id: 'log-visualization',
            name: 'Log Visualization',
            description: 'Visualize and analyze log data to identify patterns and issues',
            status: 'active'
          },
          {
            id: 'ticket-analysis',
            name: 'AI-Driven Ticket Analysis',
            description: 'Analyze and categorize support tickets using AI',
            status: 'inactive'
          },
          {
            id: 'knowledge-base',
            name: 'Intelligent Knowledge Base',
            description: 'Retrieval-augmented generation for accessing knowledge',
            status: 'active'
          }
        ]);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, []);
  
  // Handle logout
  const handleLogout = () => {
    auth?.logout();
  };
  
  return (
    <DashboardContainer>
      <Header>
        <Title>Welcome, {auth?.user?.username || 'User'}</Title>
        <Subtitle>Here's an overview of your Alexandria Platform</Subtitle>
      </Header>
      
      <Stats>
        <StatCard>
          <StatValue>{stats.cases}</StatValue>
          <StatLabel>Active Cases</StatLabel>
        </StatCard>
        
        <StatCard>
          <StatValue>{stats.plugins}</StatValue>
          <StatLabel>Installed Plugins</StatLabel>
        </StatCard>
        
        <StatCard>
          <StatValue>{stats.users}</StatValue>
          <StatLabel>Users</StatLabel>
        </StatCard>
      </Stats>
      
      <Title>Installed Plugins</Title>
      
      {isLoading ? (
        <p>Loading plugins...</p>
      ) : plugins.length === 0 ? (
        <StyledEmptyState
          title="No plugins installed"
          actions={<Button variant="outline">Install Plugins</Button>}
        />
      ) : (
        <Grid>
          {plugins.map(plugin => (
            <PluginCardContainer 
              key={plugin.id}
              className={plugin.hoverable ? 'hoverable' : ''}
            >
              <CardHeader>
                <CardTitle>{plugin.name}</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {plugin.status === 'active' ? '✅ Active' : '⚠️ Inactive'}
                </p>
              </CardHeader>
              <CardContent>
                <p>{plugin.description}</p>
              </CardContent>
              <CardFooter>
                <Button 
                  variant={plugin.status === 'active' ? 'primary' : 'outline'}
                >
                  {plugin.status === 'active' ? 'Launch' : 'Activate'}
                </Button>
              </CardFooter>
            </PluginCardContainer>
          ))}
        </Grid>
      )}
      
      <Button variant="outline" onClick={handleLogout}>
        Log Out
      </Button>
    </DashboardContainer>
  );
};

export default Dashboard;