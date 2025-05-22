import React, { ReactElement } from 'react';
import { render, RenderOptions, RenderResult } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { UIContext, type UIContextInterface } from '@ui/ui-context';

/**
 * Types for the mocked services
 */
export interface MockCrashAnalyzerService {
  getAllCrashLogs: jest.Mock;
  getCrashLogById: jest.Mock;
  analyzeLog: jest.Mock;
  deleteCrashLog: jest.Mock;
  saveCodeSnippet: jest.Mock;
  analyzeCodeSnippet: jest.Mock;
  getSnippetById: jest.Mock;
  getAnalysesBySnippet: jest.Mock;
  getLlmService: jest.Mock;
}

export interface MockLlmService {
  checkAvailability: jest.Mock;
  getAvailableModels: jest.Mock;
  analyzeLog: jest.Mock;
}

/**
 * Creates a mock CrashAnalyzerService with default implementations
 */
export function createMockCrashAnalyzerService(): MockCrashAnalyzerService {
  return {
    getAllCrashLogs: jest.fn().mockResolvedValue([]),
    getCrashLogById: jest.fn().mockResolvedValue(null),
    analyzeLog: jest.fn().mockResolvedValue({ id: 'mock-analysis-id' }),
    deleteCrashLog: jest.fn().mockResolvedValue(true),
    saveCodeSnippet: jest.fn().mockResolvedValue({ id: 'mock-snippet-id' }),
    analyzeCodeSnippet: jest.fn().mockResolvedValue({ id: 'mock-analysis-id' }),
    getSnippetById: jest.fn().mockResolvedValue(null),
    getAnalysesBySnippet: jest.fn().mockResolvedValue([]),
    getLlmService: jest.fn().mockReturnValue({
      checkAvailability: jest.fn().mockResolvedValue(true),
      getAvailableModels: jest.fn().mockResolvedValue(['mock-model'])
    })
  };
}

/**
 * Creates a mock UIContext with default implementations
 */
export function createMockUIContext(): UIContextInterface {
  return {
    uiRegistry: {
      registerComponent: jest.fn(),
      unregisterComponent: jest.fn(),
      getAllComponents: jest.fn().mockReturnValue([]),
      getComponentsByType: jest.fn().mockReturnValue([]),
      getComponentsByPosition: jest.fn().mockReturnValue([]),
      registerRoute: jest.fn(),
      unregisterRoute: jest.fn(),
      getAllRoutes: jest.fn().mockReturnValue([]),
      registerTheme: jest.fn(),
      getTheme: jest.fn().mockReturnValue({}),
      setActiveTheme: jest.fn(),
      getActiveTheme: jest.fn().mockReturnValue({
        id: 'mock-theme',
        name: 'Mock Theme',
        colors: {
          primary: '#000000',
          secondary: '#ffffff',
          background: '#f5f5f5',
          surface: '#ffffff',
          error: '#ff0000',
          text: {
            primary: '#000000',
            secondary: '#666666',
            disabled: '#999999'
          }
        },
        spacing: {
          xs: '4px',
          sm: '8px',
          md: '16px',
          lg: '24px',
          xl: '32px',
          xxl: '48px'
        },
        typography: {
          fontFamily: 'sans-serif',
          fontSize: {
            xs: '12px',
            sm: '14px',
            md: '16px',
            lg: '18px',
            xl: '24px',
            xxl: '32px'
          },
          fontWeight: {
            light: 300,
            regular: 400,
            medium: 500,
            bold: 700
          }
        },
        borderRadius: {
          sm: '2px',
          md: '4px',
          lg: '8px',
          pill: '999px'
        },
        shadows: {
          sm: '0 1px 3px rgba(0, 0, 0, 0.1)',
          md: '0 2px 6px rgba(0, 0, 0, 0.15)',
          lg: '0 4px 12px rgba(0, 0, 0, 0.2)'
        },
        transitions: {
          fast: '0.15s ease-in-out',
          medium: '0.3s ease-in-out',
          slow: '0.5s ease-in-out'
        },
        zIndex: {
          base: 0,
          dropdown: 100,
          sticky: 200,
          fixed: 300,
          modal: 400,
          popover: 500,
          toast: 600
        }
      })
    },
    theme: {
      id: 'mock-theme',
      name: 'Mock Theme',
      colors: {
        primary: '#000000',
        secondary: '#ffffff',
        background: '#f5f5f5',
        surface: '#ffffff',
        error: '#ff0000',
        text: {
          primary: '#000000',
          secondary: '#666666',
          disabled: '#999999'
        }
      },
      spacing: {
        xs: '4px',
        sm: '8px',
        md: '16px',
        lg: '24px',
        xl: '32px',
        xxl: '48px'
      },
      typography: {
        fontFamily: 'sans-serif',
        fontSize: {
          xs: '12px',
          sm: '14px',
          md: '16px',
          lg: '18px',
          xl: '24px',
          xxl: '32px'
        },
        fontWeight: {
          light: 300,
          regular: 400,
          medium: 500,
          bold: 700
        }
      },
      borderRadius: {
        sm: '2px',
        md: '4px',
        lg: '8px',
        pill: '999px'
      },
      shadows: {
        sm: '0 1px 3px rgba(0, 0, 0, 0.1)',
        md: '0 2px 6px rgba(0, 0, 0, 0.15)',
        lg: '0 4px 12px rgba(0, 0, 0, 0.2)'
      },
      transitions: {
        fast: '0.15s ease-in-out',
        medium: '0.3s ease-in-out',
        slow: '0.5s ease-in-out'
      },
      zIndex: {
        base: 0,
        dropdown: 100,
        sticky: 200,
        fixed: 300,
        modal: 400,
        popover: 500,
        toast: 600
      }
    },
    setTheme: jest.fn(),
    darkMode: false,
    toggleDarkMode: jest.fn(),
    openModal: jest.fn(),
    closeModal: jest.fn(),
    showNotification: jest.fn()
  };
}

/**
 * Custom render function that wraps components with necessary providers
 */
export function renderWithProviders(
  ui: ReactElement,
  {
    initialRoute = '/',
    routes = [],
    uiContext = createMockUIContext(),
    ...renderOptions
  }: {
    initialRoute?: string;
    routes?: Array<{ path: string; element: ReactElement }>;
    uiContext?: ReturnType<typeof createMockUIContext>;
  } & Omit<RenderOptions, 'wrapper'> = {} // Add default empty object to make options parameter optional
): ReturnType<typeof render> {
  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <UIContext.Provider value={uiContext}>
        <MemoryRouter initialEntries={[initialRoute]}>
          {routes.length > 0 ? (
            <Routes>
              {routes.map((route, index) => (
                <Route key={index} path={route.path} element={route.element} />
              ))}
            </Routes>
          ) : (
            children
          )}
        </MemoryRouter>
      </UIContext.Provider>
    );
  }

  return render(ui, { wrapper: Wrapper, ...renderOptions });
}

/**
 * Sample test data for crash logs
 */
export const sampleCrashLog = {
  id: 'test-log-1',
  title: 'Test Crash Log',
  content: 'Error: TypeError: Cannot read property of undefined',
  uploadedAt: new Date('2023-05-10T14:23:18.123Z'),
  userId: 'test-user',
  metadata: {
    platform: 'Windows',
    appVersion: '1.0.0',
    device: 'Desktop'
  },
  parsedData: {
    errorMessages: [
      {
        message: 'TypeError: Cannot read property of undefined',
        level: 'ERROR',
        timestamp: new Date('2023-05-10T14:23:18.123Z')
      }
    ],
    stackTraces: [
      {
        message: 'TypeError: Cannot read property of undefined',
        frames: [
          {
            functionName: 'processItem',
            fileName: 'app.js',
            lineNumber: 45
          }
        ],
        timestamp: new Date('2023-05-10T14:23:18.123Z')
      }
    ],
    systemInfo: {
      osType: 'Windows',
      memory: '16GB',
      cpu: 'Intel Core i7'
    },
    timestamps: [],
    logLevel: {
      ERROR: 1,
      INFO: 0,
      WARN: 0,
      DEBUG: 0,
      TRACE: 0,
      FATAL: 0
    },
    metadata: {}
  },
  analysis: {
    id: 'analysis-1',
    crashLogId: 'test-log-1',
    summary: 'TypeError caused by accessing property of undefined object',
    primaryError: 'TypeError: Cannot read property of undefined',
    failingComponent: 'app.js',
    potentialRootCauses: [
      {
        cause: 'Missing null check',
        confidence: 0.8,
        explanation: 'The code is trying to access a property of an undefined object',
        category: 'code-error',
        supportingEvidence: []
      }
    ],
    troubleshootingSteps: [
      'Add null check before accessing the property',
      'Ensure the object is initialized properly'
    ],
    llmModel: 'llama2',
    inferenceTime: 1200,
    confidence: 0.8,
    createdAt: new Date('2023-05-10T14:23:18.123Z')
  }
};

/**
 * Sample test data for code snippets
 */
export const sampleCodeSnippet = {
  id: 'snippet-1',
  language: 'javascript',
  content: 'function processData(data) { return data.value; }',
  description: 'Test code snippet',
  sessionId: 'session-1',
  userId: 'test-user',
  createdAt: new Date('2023-05-10T14:23:18.123Z')
};

export const sampleSnippetAnalysis = {
  id: 'analysis-1',
  snippetId: 'snippet-1',
  summary: 'Missing null check in data processing function',
  primaryError: 'Potential TypeError: Cannot read property of undefined',
  potentialRootCauses: [
    {
      cause: 'Missing null check',
      confidence: 0.8,
      explanation: 'The function does not validate that data is defined before accessing value',
      category: 'code-error',
      supportingEvidence: []
    }
  ],
  troubleshootingSteps: [
    'Add a null check at the beginning of the function',
    'Consider adding a default return value for undefined input'
  ],
  llmModel: 'llama2',
  inferenceTime: 1000,
  confidence: 0.8,
  createdAt: new Date('2023-05-10T14:23:18.123Z')
};