# Alexandria Project Structure

## Overview

Alexandria is a modular AI-enhanced customer care platform following a microkernel architecture with a plugin system. It provides a foundation for various AI-powered tools to enhance customer support workflows. 

The platform is designed with the following key principles:

1. **Microkernel Architecture**: A minimal core with well-defined extension points
2. **Plugin System**: Modular, self-contained extensions that add specific functionality
3. **Event-Driven Communication**: Loosely coupled components communicating via events
4. **Secure By Design**: Built-in authentication, authorization, and data protection
5. **AI-First Approach**: Deep integration with AI capabilities for enhanced analysis

The first implemented plugin is the Crash Analyzer, which leverages Ollama's local LLM capabilities to analyze application crash logs and identify root causes.

## Directory Structure and Component Details

### Root Structure

```
/mnt/c/Projects/Alexandria/
├── docs/                           # Documentation
│   ├── Files For Dummies/          # Basic code explanations
│   └── Files For Dummies Extended/ # Detailed component documentation
├── guidelines/                     # Project guidelines and templates
├── src/                            # Main source code directory
│   ├── client/                     # Frontend client application
│   │   ├── components/             # Shared UI components  
│   │   │   └── ui/                 # Base UI components (dialog, select, etc.)
│   │   ├── lib/                    # Frontend utilities
│   │   └── pages/                  # Page components
│   ├── core/                       # Core system services
│   │   ├── data/                   # Data persistence interfaces
│   │   ├── event-bus/              # Event-driven communication
│   │   ├── feature-flags/          # Feature activation control
│   │   ├── plugin-registry/        # Plugin lifecycle management
│   │   ├── security/               # Authentication and authorization
│   │   └── system/                 # Core system interfaces
│   ├── plugins/                    # Plugin implementations
│   │   └── crash-analyzer/         # Crash analyzer plugin (MVP)
│   │       ├── src/                # Backend implementation
│   │       │   ├── interfaces.ts   # Plugin interfaces
│   │       │   ├── repositories/   # Data storage
│   │       │   └── services/       # Core services
│   │       └── ui/                 # Frontend components
│   └── utils/                      # Utility functions
└── various config files            # Project configuration
```

## Core Architecture Components

### Microkernel Architecture (`/src/core/`)

The platform follows a microkernel architecture with these key components:

#### Core System (`/src/core/system/`)

- **Purpose**: Provides the foundational functionality for the Alexandria platform
- **Key Features**:
  - Route registration and management
  - User authentication and authorization
  - Basic data model handling (users, cases, logs)
  - System initialization and shutdown
  - Event emission for platform state changes

#### Plugin Registry (`/src/core/plugin-registry/`)

- **Purpose**: Responsible for discovering, loading, and managing the lifecycle of plugins
- **Key Features**:
  - Plugin discovery from directories
  - Plugin lifecycle management (install, activate, deactivate, uninstall, update)
  - Dependency resolution between plugins
  - Version compatibility checking
  - Plugin API creation and management
  - Event subscription management for plugins

#### Event Bus (`/src/core/event-bus/`)

- **Purpose**: Provides an event-driven communication mechanism between core and plugins
- **Key Features**:
  - Topic-based publish-subscribe pattern
  - Support for pattern-based subscriptions
  - Subscription lifecycle management (expiration, max events)
  - Prioritized event handling
  - Error isolation between handlers
  - Synchronous and asynchronous event processing

#### Feature Flag Service (`/src/core/feature-flags/`)

- **Purpose**: Controls feature activation and rollout
- **Key Features**:
  - Flag evaluation based on context
  - Support for gradual rollout
  - User segmentation capabilities
  - Integration with the plugin registry
  - Override management for development and testing

#### Security Services (`/src/core/security/`)

- **Purpose**: Provides authentication, authorization, and data security
- **Key Components**:
  - Authentication service: JWT-based authentication
  - Authorization service: Role-based access control
  - Audit service: Security event logging
  - Encryption service: Data protection
  - Validation service: Input validation

#### Data Service (`/src/core/data/`)

- **Purpose**: Provides data persistence capabilities
- **Implementation**: Interfaces for TypeORM integration with PostgreSQL

## UI Framework (`/src/client/`)

- **Purpose**: Provides a consistent UI framework and component library
- **Key Features**:
  - Modern component library with Radix UI primitives
  - Tailwind CSS for styling
  - Responsive design with mobile-first approach
  - Dark mode support
  - Accessible components
  - Status indicator for service health

### Core UI Components (`/src/client/components/ui/`)

The UI framework is built on React and Tailwind CSS with Radix UI primitives for accessibility. Components follow a VSCode/Notion design aesthetic with consistent styling and behavior.

- **Dialog (`/src/client/components/ui/dialog/`)**: Modal dialogs with customizable content, actions, and animations
- **Select (`/src/client/components/ui/select/`)**: Dropdown selection with search, keyboard navigation, and multi-select support
- **Dropdown Menu (`/src/client/components/ui/dropdown-menu/`)**: Context menus with nested items, keyboard navigation, and icons
- **Command (`/src/client/components/ui/command/`)**: Command palette for keyboard-driven interactions inspired by VSCode
- **Tooltip (`/src/client/components/ui/tooltip/`)**: Contextual information popups with configurable positioning and delay
- **StatusIndicator (`/src/client/components/ui/status-indicator/`)**: Service health status with traffic light colors (green/yellow/red)
- **Button (`/src/client/components/ui/button.tsx`)**: Customizable button with variants (primary, secondary, ghost, etc.)
- **Card (`/src/client/components/ui/card.tsx`)**: Content container with consistent styling and optional header/footer
- **Input (`/src/client/components/ui/input.tsx`)**: Text input with validation integration
- **Table (`/src/client/components/ui/table.tsx`)**: Data table with sorting and selection
- **Tabs (`/src/client/components/ui/tabs.tsx`)**: Tabbed interface for organizing content
- **Collapsible (`/src/client/components/ui/collapsible.tsx`)**: Expandable content sections
- **Avatar (`/src/client/components/ui/avatar.tsx`)**: User avatar with fallback text
- **Badge (`/src/client/components/ui/badge.tsx`)**: Status indicators and labels

## Plugins

### Crash Analyzer Plugin (`/src/plugins/crash-analyzer/`)

- **Purpose**: Analyzes crash logs using AI to determine root causes
- **Key Components**:

#### Crash Analyzer Service (`/src/plugins/crash-analyzer/src/services/crash-analyzer-service.ts`)

- **Purpose**: Core service for analyzing crash logs
- **Key Features**:
  - Crash log submission and management
  - Orchestration between log parser, LLM service, and data storage
  - Result management and retrieval
  - Dynamic model selection

#### LLM Service (`/src/plugins/crash-analyzer/src/services/llm-service.ts`)

- **Purpose**: Integrates with Ollama for local LLM-based analysis
- **Key Features**:
  - Connection to Ollama API
  - Prompt engineering for crash analysis
  - Result parsing and formatting
  - Model management and fallbacks
  - Retry and error handling
  - Health monitoring and status checks

#### Log Parser (`/src/plugins/crash-analyzer/src/services/log-parser.ts`)

- **Purpose**: Extracts structured data from raw crash logs
- **Key Features**:
  - Pattern recognition for various log formats
  - Extraction of error messages, stack traces, and system info
  - Preprocessing data for LLM analysis

#### UI Components (`/src/plugins/crash-analyzer/ui/components/`)

- **CrashLogDetail**: Displays detailed analysis of a crash log
- **CrashLogList**: Shows a list of uploaded crash logs
- **Dashboard**: Overview dashboard showing crash statistics
- **LogViewer**: Displays raw and formatted log content
- **RootCauseList**: Presents potential root causes with confidence scores
- **StatsSummary**: Shows statistics about crash patterns
- **SystemInfo**: Displays system information from crash logs
- **UploadCrashLog**: UI for submitting new crash logs
- **OllamaStatusIndicator**: Shows Ollama service health status

## Testing Infrastructure

The project includes a comprehensive testing infrastructure with:

- Unit tests for core components (`__tests__` directories)
- Integration tests for plugin functionality
- UI component tests with React Testing Library
- End-to-end tests with Playwright

## Documentation

### Project Documentation (`/docs/`)

- **Files For Dummies**: Basic explanations of key files
- **Files For Dummies Extended**: Detailed component documentation with line-by-line explanations
- **TEST_SETUP_GUIDE.md**: Instructions for setting up and running tests
- **MANUAL_TEST_PLAN.md**: Plan for manual testing
- **MVP_STATUS_CHECKLIST.md**: Status tracking for MVP features

### Guidelines and Templates (`/guidelines/`)

- **Alexandria_Plan**: Detailed implementation plan
- **Files For Dummies**: Templates for code documentation
- **Ultimate AI Coding Guidelines**: Best practices for AI-assisted development

## Future Plugins (Planned)

The following plugins are planned for future development:

1. **Log Visualization Plugin**: For aggregating, searching, and visualizing log data
2. **AI-Driven Ticket Analysis Plugin**: For analyzing and categorizing support tickets
3. **Intelligent Knowledge Base (RAG) Plugin**: For connecting to knowledge bases and providing contextual answers using retrieval augmented generation

## Technology Stack

The Alexandria platform is built with the following technologies:

### Frontend
- **React**: UI library for component-based development
- **TypeScript**: Static typing for improved code quality and DX
- **Tailwind CSS**: Utility-first CSS framework for styling
- **Radix UI**: Unstyled, accessible component primitives
- **Vite**: Fast, modern frontend build tool
- **React Router**: Client-side routing

### Backend
- **Node.js**: JavaScript runtime for server-side code
- **TypeScript**: Shared language between frontend and backend
- **Express**: Web framework for API endpoints
- **TypeORM**: Object-relational mapping for database access
- **PostgreSQL**: Relational database for persistent storage
- **Ollama**: Local LLM inference API
- **JSONWebToken**: Authentication tokens
- **WebSockets**: Real-time event handling

### Testing
- **Jest**: JavaScript testing framework
- **React Testing Library**: React component testing
- **Playwright**: End-to-end testing
- **MSW**: Mock Service Worker for API mocking

### DevOps
- **ESLint**: Code linting
- **Prettier**: Code formatting
- **Husky**: Git hooks for pre-commit validation

## Configuration Files

- **package.json**: Defines dependencies and scripts
- **tsconfig.json**: TypeScript configuration
- **vite.config.ts**: Build and development server configuration
- **tailwind.config.js**: UI styling configuration
- **jest.config.js**: Testing configuration
- **postcss.config.js**: CSS processing configuration

## Recently Added Features

1. **Dynamic Ollama Model Selection**: UI now allows selecting different Ollama models for crash analysis
   - Automatically fetches available models from Ollama
   - Persists selection for consistent user experience
   - Integrates with crash analysis workflow
   
2. **Ollama Status Indicator**: Traffic light indicator showing Ollama service health
   - Real-time status monitoring of Ollama service
   - Visual traffic light indicator (green/yellow/red)
   - Tooltip with detailed status information
   - Periodic health checks with response time tracking
   
3. **Modern UI Components**: Added new components following VSCode/Notion styling
   - Dialog: Modal component for focused interactions
   - Tooltip: Contextual information display
   - Status Indicator: Service health visualization
   - Select: Enhanced dropdown selection component
   - Dropdown Menu: Context menu component
   - Command: Command palette for keyboard-driven interactions
   
4. **Security Services Integration**: Migrated authentication, authorization, and other security services
   - Authentication Service: JWT-based user authentication
   - Authorization Service: Role-based access control
   - Encryption Service: Data protection with AES-256
   - Validation Service: Input sanitization and validation
   - Audit Service: Comprehensive security event logging
   
5. **Feature Flags System**: Enhanced feature flag system for controlled rollout
   - Context-based flag evaluation
   - User segmentation and targeting
   - Gradual rollout capability 
   - Override management for development and testing
   - Integration with plugin lifecycle management
   
6. **Files For Dummies Extended Documentation**: Detailed documentation with line-by-line explanations
   - Dialog Component: Complete breakdown of the Dialog UI component
   - Feature Flag Service: In-depth explanation of the feature flag system
   - Status Indicator Component: Detailed walkthrough of the status indicator implementation
   
7. **Project Structure Reorganization**: Consolidated components from alexandria-platform to root project
   - Standardized on modern tooling (Vite, TailwindCSS)
   - Aligned directory structure with best practices
   - Resolved duplicate implementation issues
   - Updated dependencies to latest versions