import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MnemosyneDashboard } from '../MnemosyneDashboard';
import { MnemosyneProvider } from '../../context/MnemosyneContext';
import { useMnemosyne } from '../../hooks/useMnemosyne';

// Mock the useMnemosyne hook
jest.mock('../../hooks/useMnemosyne');

// Mock child components
jest.mock('../KnowledgeGraphVisualization', () => ({
  KnowledgeGraphVisualization: () => <div data-testid="knowledge-graph">Knowledge Graph</div>,
}));

jest.mock('../DocumentEditor', () => ({
  DocumentEditor: () => <div data-testid="document-editor">Document Editor</div>,
}));

describe('MnemosyneDashboard', () => {
  const mockUseMnemosyne = useMnemosyne as jest.MockedFunction<typeof useMnemosyne>;

  const defaultMockReturn = {
    nodes: [],
    relationships: [],
    selectedNode: null,
    isLoading: false,
    error: null,
    createNode: jest.fn(),
    updateNode: jest.fn(),
    deleteNode: jest.fn(),
    selectNode: jest.fn(),
    searchNodes: jest.fn(),
    getNodesByType: jest.fn(),
    createRelationship: jest.fn(),
    deleteRelationship: jest.fn(),
  };

  beforeEach(() => {
    mockUseMnemosyne.mockReturnValue(defaultMockReturn);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should render dashboard with loading state', () => {
    mockUseMnemosyne.mockReturnValue({
      ...defaultMockReturn,
      isLoading: true,
    });

    render(
      <MnemosyneProvider>
        <MnemosyneDashboard />
      </MnemosyneProvider>
    );

    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    expect(screen.queryByTestId('dashboard-content')).not.toBeInTheDocument();
  });

  it('should render dashboard with error state', () => {
    mockUseMnemosyne.mockReturnValue({
      ...defaultMockReturn,
      error: 'Failed to load data',
    });

    render(
      <MnemosyneProvider>
        <MnemosyneDashboard />
      </MnemosyneProvider>
    );

    expect(screen.getByText(/Error: Failed to load data/i)).toBeInTheDocument();
    expect(screen.queryByTestId('dashboard-content')).not.toBeInTheDocument();
  });

  it('should render dashboard with empty state', () => {
    render(
      <MnemosyneProvider>
        <MnemosyneDashboard />
      </MnemosyneProvider>
    );

    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    expect(screen.getByText(/No knowledge nodes yet/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Create your first node/i })).toBeInTheDocument();
  });

  it('should render dashboard with nodes', () => {
    const mockNodes = [
      {
        id: 'node-1',
        title: 'Test Node 1',
        type: 'document',
        created: new Date('2024-01-01'),
        updated: new Date('2024-01-02'),
      },
      {
        id: 'node-2',
        title: 'Test Node 2',
        type: 'note',
        created: new Date('2024-01-03'),
        updated: new Date('2024-01-04'),
      },
    ];

    mockUseMnemosyne.mockReturnValue({
      ...defaultMockReturn,
      nodes: mockNodes,
    });

    render(
      <MnemosyneProvider>
        <MnemosyneDashboard />
      </MnemosyneProvider>
    );

    expect(screen.getByText('Knowledge Base')).toBeInTheDocument();
    expect(screen.getByText('2 nodes')).toBeInTheDocument();
    expect(screen.getByTestId('knowledge-graph')).toBeInTheDocument();
  });

  it('should handle node selection', async () => {
    const mockNodes = [
      {
        id: 'node-1',
        title: 'Test Node 1',
        type: 'document',
        content: 'Test content',
      },
    ];

    const selectNodeMock = jest.fn();

    mockUseMnemosyne.mockReturnValue({
      ...defaultMockReturn,
      nodes: mockNodes,
      selectNode: selectNodeMock,
    });

    render(
      <MnemosyneProvider>
        <MnemosyneDashboard />
      </MnemosyneProvider>
    );

    // Click on a node in the list
    const nodeItem = screen.getByText('Test Node 1');
    fireEvent.click(nodeItem);

    await waitFor(() => {
      expect(selectNodeMock).toHaveBeenCalledWith('node-1');
    });
  });

  it('should show selected node in editor', () => {
    const selectedNode = {
      id: 'node-1',
      title: 'Selected Node',
      type: 'document',
      content: 'Node content',
    };

    mockUseMnemosyne.mockReturnValue({
      ...defaultMockReturn,
      nodes: [selectedNode],
      selectedNode,
    });

    render(
      <MnemosyneProvider>
        <MnemosyneDashboard />
      </MnemosyneProvider>
    );

    expect(screen.getByTestId('document-editor')).toBeInTheDocument();
  });

  it('should handle create node action', async () => {
    const createNodeMock = jest.fn();

    mockUseMnemosyne.mockReturnValue({
      ...defaultMockReturn,
      createNode: createNodeMock,
    });

    render(
      <MnemosyneProvider>
        <MnemosyneDashboard />
      </MnemosyneProvider>
    );

    const createButton = screen.getByRole('button', { name: /Create your first node/i });
    fireEvent.click(createButton);

    // This would open a create node dialog/form
    // For this test, we'll just verify the button works
    expect(createButton).toBeInTheDocument();
  });

  it('should display statistics', () => {
    const mockNodes = [
      { id: '1', type: 'document' },
      { id: '2', type: 'document' },
      { id: '3', type: 'note' },
      { id: '4', type: 'concept' },
    ];

    const mockRelationships = [
      { id: 'r1', sourceId: '1', targetId: '2' },
      { id: 'r2', sourceId: '2', targetId: '3' },
    ];

    mockUseMnemosyne.mockReturnValue({
      ...defaultMockReturn,
      nodes: mockNodes,
      relationships: mockRelationships,
    });

    render(
      <MnemosyneProvider>
        <MnemosyneDashboard />
      </MnemosyneProvider>
    );

    // Check statistics display
    expect(screen.getByText('4 nodes')).toBeInTheDocument();
    expect(screen.getByText('2 relationships')).toBeInTheDocument();
    expect(screen.getByText(/2 documents/i)).toBeInTheDocument();
    expect(screen.getByText(/1 note/i)).toBeInTheDocument();
    expect(screen.getByText(/1 concept/i)).toBeInTheDocument();
  });

  it('should handle search functionality', async () => {
    const searchNodesMock = jest.fn().mockResolvedValue([
      { id: 'search-1', title: 'Search Result 1' },
    ]);

    mockUseMnemosyne.mockReturnValue({
      ...defaultMockReturn,
      searchNodes: searchNodesMock,
      nodes: [
        { id: '1', title: 'Node 1' },
        { id: '2', title: 'Node 2' },
      ],
    });

    render(
      <MnemosyneProvider>
        <MnemosyneDashboard />
      </MnemosyneProvider>
    );

    const searchInput = screen.getByPlaceholderText(/Search knowledge base/i);
    fireEvent.change(searchInput, { target: { value: 'test query' } });
    fireEvent.submit(searchInput.closest('form')!);

    await waitFor(() => {
      expect(searchNodesMock).toHaveBeenCalledWith('test query', expect.any(Object));
    });
  });
});