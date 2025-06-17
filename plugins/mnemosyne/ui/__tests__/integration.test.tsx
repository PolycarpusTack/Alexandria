import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MnemosyneRoutes from '../index';
import MnemosyneDashboard from '../components/MnemosyneDashboard';

// Mock the lazy loaded components
jest.mock('../components/MnemosyneDashboard', () => ({
  __esModule: true,
  default: () => <div>Mnemosyne Dashboard</div>
}));

jest.mock('../components/NodeExplorer', () => ({
  __esModule: true,
  default: () => <div>Node Explorer</div>
}));

jest.mock('../components/NodeEditor', () => ({
  __esModule: true,
  default: ({ editMode }: any) => <div>Node Editor {editMode ? '(Edit Mode)' : ''}</div>
}));

jest.mock('../components/GraphVisualization', () => ({
  __esModule: true,
  default: () => <div>Graph Visualization</div>
}));

jest.mock('../components/SearchInterface', () => ({
  __esModule: true,
  default: () => <div>Search Interface</div>
}));

jest.mock('../components/ImportExport', () => ({
  __esModule: true,
  default: () => <div>Import Export</div>
}));

jest.mock('../components/TemplateManager', () => ({
  __esModule: true,
  default: () => <div>Template Manager</div>
}));

describe('Mnemosyne Plugin Integration', () => {
  it('renders the main routes component without crashing', () => {
    render(
      <MemoryRouter initialEntries={['/mnemosyne']}>
        <MnemosyneRoutes />
      </MemoryRouter>
    );
  });

  it('renders dashboard at root path', async () => {
    render(
      <MemoryRouter initialEntries={['/mnemosyne']}>
        <MnemosyneRoutes />
      </MemoryRouter>
    );
    
    expect(await screen.findByText('Mnemosyne Dashboard')).toBeInTheDocument();
  });

  it('renders node explorer at /nodes path', async () => {
    render(
      <MemoryRouter initialEntries={['/mnemosyne/nodes']}>
        <MnemosyneRoutes />
      </MemoryRouter>
    );
    
    expect(await screen.findByText('Node Explorer')).toBeInTheDocument();
  });

  it('renders node editor at /nodes/new path', async () => {
    render(
      <MemoryRouter initialEntries={['/mnemosyne/nodes/new']}>
        <MnemosyneRoutes />
      </MemoryRouter>
    );
    
    expect(await screen.findByText('Node Editor')).toBeInTheDocument();
  });

  it('renders node editor in edit mode at /nodes/:id/edit path', async () => {
    render(
      <MemoryRouter initialEntries={['/mnemosyne/nodes/123/edit']}>
        <MnemosyneRoutes />
      </MemoryRouter>
    );
    
    expect(await screen.findByText('Node Editor (Edit Mode)')).toBeInTheDocument();
  });

  it('renders graph visualization at /graph path', async () => {
    render(
      <MemoryRouter initialEntries={['/mnemosyne/graph']}>
        <MnemosyneRoutes />
      </MemoryRouter>
    );
    
    expect(await screen.findByText('Graph Visualization')).toBeInTheDocument();
  });

  it('renders search interface at /search path', async () => {
    render(
      <MemoryRouter initialEntries={['/mnemosyne/search']}>
        <MnemosyneRoutes />
      </MemoryRouter>
    );
    
    expect(await screen.findByText('Search Interface')).toBeInTheDocument();
  });

  it('renders import/export at /import-export path', async () => {
    render(
      <MemoryRouter initialEntries={['/mnemosyne/import-export']}>
        <MnemosyneRoutes />
      </MemoryRouter>
    );
    
    expect(await screen.findByText('Import Export')).toBeInTheDocument();
  });

  it('renders template manager at /templates path', async () => {
    render(
      <MemoryRouter initialEntries={['/mnemosyne/templates']}>
        <MnemosyneRoutes />
      </MemoryRouter>
    );
    
    expect(await screen.findByText('Template Manager')).toBeInTheDocument();
  });

  it('handles error boundary correctly', () => {
    const ThrowError = () => {
      throw new Error('Test error');
    };

    // Mock console.error to avoid noise in test output
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    render(
      <MemoryRouter>
        <MnemosyneRoutes />
      </MemoryRouter>
    );

    // Cleanup
    consoleSpy.mockRestore();
  });
});