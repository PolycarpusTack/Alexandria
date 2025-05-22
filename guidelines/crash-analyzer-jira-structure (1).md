# AI-Driven Crash Analyzer - JIRA Development Structure

## Overview
This document outlines the complete JIRA structure for developing the AI-Driven Crash Analyzer application. Each EPIC, TASK, and SUBTASK includes AI-driven development prompts following the guidelines provided.

## EPIC 1: Foundation and Project Setup
*Description: Establish the core architecture, tooling, and scaffolding for the Crash Analyzer platform*

### TASK 1.1: Requirements Refinement and Analysis
*Description: Finalize detailed requirements based on the research report*

#### SUBTASK 1.1.1: Convert High-Level Requirements into User Stories
**Prompt**:
```
Act as a requirements analyst. I need to build an AI-driven Crash Analyzer application as described in the research report. Please transform the high-level requirements from the research document into well-structured user stories following the format: 'As a [user role], I want [action] so that [benefit]'. 

Focus on these user roles from section 2.1:
- L1 Support Engineers
- L2 Support Engineers 
- L3 Support Engineers/Developers
- QA Engineers
- Support Managers

Ensure you cover all the core functionality described in section 3.1, including:
- Crash Ingestion & Symbolication
- Crash Grouping & Prioritization
- AI-Powered Root Cause Analysis
- Collaboration & Workflow Integration
- Monitoring & Reporting

For each user story, suggest 2-3 acceptance criteria that would validate completion.
```

#### SUBTASK 1.1.2: Security and Compliance Requirements
**Prompt**:
```
Act as a security and compliance expert. Given the AI-Driven Crash Analyzer research document, identify all security and compliance requirements necessary for this application. 

Specifically focus on:
1. PII handling and redaction requirements from section 3.6
2. Compliance considerations from section 3.9
3. Authentication and authorization needs from sections 3.6 and 3.7

For each requirement, provide:
- A clear, testable specification
- Implementation recommendations
- Potential risks if not properly addressed

Format your response as a security requirements document that can be integrated into our development process.
```

#### SUBTASK 1.1.3: Non-Functional Requirements Specification
**Prompt**:
```
Act as a systems architect. Based on the AI-Driven Crash Analyzer research document, create a comprehensive list of non-functional requirements covering:

1. Performance expectations (response times, throughput, scalability)
2. Reliability targets (uptime, fault tolerance)
3. Data storage and retention policies
4. AI/LLM response quality metrics and thresholds
5. Accessibility requirements (WCAG standards to meet)

For each requirement, provide a measurable target and justification based on the research document.
```

### TASK 1.2: Architecture Design and Project Scaffolding
*Description: Design the system architecture and set up the initial project structure*

#### SUBTASK 1.2.1: Microservices Architecture Blueprint
**Prompt**:
```
Act as a solutions architect with expertise in microservices. Based on the AI-Driven Crash Analyzer research document, design a detailed microservices architecture covering:

1. Core services identified in section 3.4
2. Service boundaries and responsibilities
3. API contracts between services
4. Data flow diagrams
5. PostgreSQL schema design for the primary data entities

Create a comprehensive architecture document with diagrams explaining:
- Service interactions
- API gateway design
- Event flows between components
- Data persistence strategy
- Local LLM integration via Ollama

Focus on creating a modular, plugin-based system that allows for extensibility as described in section 3.4.
```

#### SUBTASK 1.2.2: Project Scaffolding and Development Environment
**Prompt**:
```
Act as a DevOps engineer. Create a scaffold for a modern microservices-based crash analyzer application with the following components:

1. A base project structure for each microservice identified in the architecture
2. Docker and docker-compose configurations for local development
3. CI/CD pipeline configurations for GitHub Actions
4. Linting and code formatting configurations with strict settings
5. Initial package.json/requirements.txt files with pinned dependencies

Focus on creating a development environment that supports:
- Consistent code quality
- Efficient local development
- Containerized testing
- Standardized service templates

For each service, use the technology stack: Node.js for API services, Python for AI/ML components, and PostgreSQL for data storage. Include Ollama configuration for local LLM deployment.
```

#### SUBTASK 1.2.3: Security and Privacy Infrastructure Setup
**Prompt**:
```
Act as a security architect. Create the security infrastructure scaffolding for our AI-Driven Crash Analyzer, focusing on:

1. Authentication and authorization framework (OAuth2, RBAC)
2. PII detection and redaction pipeline configurations
3. Secure API gateway setup with rate limiting and input validation
4. Audit logging infrastructure
5. Secure LLM interaction patterns for both local (Ollama) and potential cloud LLMs

Provide implementation templates for:
- Secure service-to-service communication
- PII redaction patterns for logs and crash data
- Security monitoring configurations
- Access control patterns for different user roles
```

## EPIC 2: Core Platform Development
*Description: Implement the foundational services and functionality of the Crash Analyzer*

### TASK 2.1: Ingestion and Symbolication Pipeline
*Description: Develop the crash data ingestion and symbolication services*

#### SUBTASK 2.1.1: Crash Ingestion Service Test Suite
**Prompt**:
```
Act as a test engineer. I need to write tests for a crash ingestion service that receives crash reports from various sources (SDKs, direct uploads), validates them, and stores them for processing.

Specifications:
- Input: Raw crash reports in various formats (minidumps, JSON-formatted reports)
- Output: Validated crash reports stored in PostgreSQL and queued for further processing
- Handling of malformed reports, rate limiting, and authentication
- Performance requirements: Handle up to 100 reports/second with <1s processing time

Please write comprehensive tests using Jest that cover:
1. Happy path scenarios (successful ingestion of various formats)
2. Edge cases (very large reports, partial/malformed data)
3. Error conditions (invalid authentication, rate limits exceeded)
4. Security considerations (injection attempts, invalid data)

Do NOT write the implementation yet - just the tests.
```

#### SUBTASK 2.1.2: Crash Ingestion Service Implementation
**Prompt**:
```
Act as a senior developer. Below are tests for a crash ingestion service:

[Insert test code from previous subtask]

Please implement the crash ingestion service so that all tests pass, following these guidelines:
1. Use Node.js with Express and PostgreSQL
2. Follow RESTful API design patterns
3. Implement robust error handling and request validation
4. Ensure proper authentication and rate limiting
5. Add a message queue interface (Kafka/RabbitMQ) for forwarding to the symbolication service
6. Add detailed logging (with PII redaction)

Your implementation should include:
- API endpoints for receiving crash reports
- Input validation and sanitization
- PostgreSQL schema and data access methods
- Queue publishing mechanism
- Comprehensive error handling

Only implement what's necessary to pass the tests, focusing on reliability and security.
```

#### SUBTASK 2.1.3: Symbolication Service Test Suite
**Prompt**:
```
Act as a test engineer. I need to write tests for a symbolication service that processes raw stack traces using symbol files (dSYMs, ProGuard maps, PDBs) to convert them into human-readable format.

Specifications:
- Input: Raw stack traces and references to symbol files
- Output: Symbolicated, human-readable stack traces
- Symbol file management (upload, storage, retrieval)
- Support for multiple platforms (iOS, Android, Windows, Linux)

Please write comprehensive tests using PyTest that cover:
1. Symbolication of stack traces for different platforms
2. Symbol file management operations
3. Error handling (missing symbols, corrupted files)
4. Performance for large stack traces

Focus on testing the core functionality and symbol file management capabilities. Do NOT write the implementation yet - just the tests.
```

#### SUBTASK 2.1.4: Symbolication Service Implementation
**Prompt**:
```
Act as a senior developer specializing in crash analysis tools. Below are tests for a symbolication service:

[Insert test code from previous subtask]

Please implement the symbolication service so that all tests pass, following these guidelines:
1. Use Python with FastAPI 
2. Implement efficient symbol file storage and retrieval
3. Create processors for different symbol file formats (dSYM, ProGuard, PDB)
4. Add caching mechanisms for improved performance
5. Provide detailed logging of the symbolication process

Your implementation should include:
- API endpoints for symbolication requests and symbol file management
- Storage abstraction for symbol files (blob storage)
- Symbolication engine for each supported platform
- Robust error handling and reporting

Focus on creating a reliable, efficient symbolication engine that supports multiple platforms and provides detailed, human-readable stack traces.
```

### TASK 2.2: PostgreSQL Database Implementation
*Description: Implement the data persistence layer using PostgreSQL*

#### SUBTASK 2.2.1: Database Schema Design
**Prompt**:
```
Act as a database architect. Design a comprehensive PostgreSQL schema for the AI-Driven Crash Analyzer based on the research document section 3.6.

Create detailed schema definitions including:
1. Table structures with column definitions, data types, and constraints
2. Indexes for optimal query performance
3. Foreign key relationships and integrity constraints
4. JSONB structures for flexible data (crash frames, AI results)
5. Extension configurations (e.g., pgvector if needed for vector storage)

Focus on these core entities:
- Crash reports
- Stack traces
- Symbol files
- AI analysis results
- User feedback on AI suggestions
- Projects and application versions

Your schema should optimize for:
- Query performance for common operations
- Data integrity and consistency
- Efficient storage of large datasets
- Support for AI-related data structures
- Scalable growth over time

Include SQL DDL statements for creating the schema and comments explaining design decisions.
```

#### SUBTASK 2.2.2: Database Access Layer Implementation
**Prompt**:
```
Act as a senior backend developer. Create a database access layer for the AI-Driven Crash Analyzer PostgreSQL schema.

Implement the following:
1. A data access layer using Node.js with TypeORM or Sequelize
2. Entity models corresponding to the database schema
3. Repository patterns for CRUD operations
4. Optimized query methods for common operations
5. Transaction handling for multi-step operations
6. Error handling and connection management
7. Migration scripts for schema versioning

Focus on creating a flexible, performant data access layer that:
- Provides type-safe data operations
- Handles connection pooling efficiently
- Implements proper error handling and retries
- Supports the specific query patterns needed by the application
- Can scale with increasing data volumes

Include comprehensive tests for all repository methods and documentation for the API.
```

### TASK 2.3: Basic AI Integration Service
*Description: Implement the initial AI/LLM integration for crash analysis*

#### SUBTASK 2.3.1: AI Analysis Service Test Suite
**Prompt**:
```
Act as a test engineer specializing in AI systems. I need to write tests for an AI Analysis Service that integrates with LLMs (via Ollama) to analyze crash data and generate insights.

Specifications:
- Input: Symbolicated stack traces, logs, and crash metadata
- Output: AI-generated summaries, root cause hypotheses, and potential solutions
- Must handle prompt generation, LLM interaction, and result parsing
- Should implement RAG (Retrieval Augmented Generation) capabilities

Please write comprehensive tests using Jest that cover:
1. LLM prompt construction from crash data
2. Integration with Ollama API
3. Processing and validation of LLM responses
4. Error handling for LLM failures or timeouts
5. Storage and retrieval of AI analysis results

Include test fixtures with sample crash data, expected prompts, and mock LLM responses. Focus on testable, deterministic behavior while allowing for the probabilistic nature of LLM outputs.

Do NOT write the implementation yet - just the tests.
```

#### SUBTASK 2.3.2: AI Analysis Service Implementation
**Prompt**:
```
Act as a senior AI engineer specializing in LLM integration. Below are tests for an AI Analysis Service that integrates with Ollama:

[Insert test code from previous subtask]

Please implement the AI Analysis Service so that all tests pass, following these guidelines:
1. Use Node.js with a modular architecture
2. Create a robust Ollama client for local LLM interaction
3. Implement prompt engineering best practices for crash analysis
4. Create structured output parsers for AI responses
5. Add RAG capabilities using vector databases or PostgreSQL with pgvector
6. Implement LLM fallback and retry mechanisms

Your implementation should include:
- A prompt engineering system that formats crash data effectively for LLM analysis
- Client for Ollama API with proper error handling
- Result parsers that extract structured data from LLM responses
- Storage mechanisms for AI analysis results
- Confidence scoring for LLM-generated hypotheses
- Performance optimization for efficient LLM usage

Focus on creating a reliable, explainable AI service that provides valuable insights from crash data.
```

## EPIC 3: UI and Frontend Development
*Description: Implement the user interface and frontend components of the Crash Analyzer*

### TASK 3.1: Core Dashboard and Navigation
*Description: Implement the main dashboard and navigation structure*

#### SUBTASK 3.1.1: Dashboard Component Test Suite
**Prompt**:
```
Act as a frontend test engineer. I need to write tests for a crash analyzer dashboard that displays crash groups, metrics, and allows navigation to detailed views.

Specifications:
- Dashboard shows crash group metrics (frequency, affected users, etc.)
- Interactive charts for crash trends and distributions
- Navigation to detailed crash views
- Filtering and sorting capabilities
- Role-based view customization

Please write comprehensive tests using Jest and React Testing Library that cover:
1. Component rendering with various data inputs
2. User interactions (sorting, filtering, navigation)
3. Chart rendering and interactions
4. Responsive layout behavior
5. Accessibility compliance

Include test fixtures with sample dashboard data and expected rendering outcomes. Focus on functional behavior, accessibility, and responsive design.

Do NOT write the implementation yet - just the tests.
```

#### SUBTASK 3.1.2: Dashboard Component Implementation
**Prompt**:
```
Act as a senior frontend developer. Below are tests for a crash analyzer dashboard component:

[Insert test code from previous subtask]

Please implement the dashboard component so that all tests pass, following these guidelines:
1. Use React with TypeScript
2. Implement responsive design using CSS Grid/Flexbox
3. Create reusable chart components using Recharts
4. Follow WCAG AA accessibility standards
5. Implement efficient state management
6. Use React Query for data fetching

Your implementation should include:
- A main dashboard layout with metrics and charts
- Interactive filtering and sorting controls
- Navigation to detailed views
- Role-based view customization
- Responsive design for various screen sizes
- Proper loading states and error handling

Focus on creating an intuitive, accessible dashboard that presents crash data clearly and allows efficient navigation to detailed views.
```

### TASK 3.2: Crash Detail and Analysis View
*Description: Implement the detailed crash analysis view*

#### SUBTASK 3.2.1: Crash Detail View Test Suite
**Prompt**:
```
Act as a frontend test engineer. I need to write tests for a crash detail view component that displays symbolicated stack traces, crash metadata, and AI-generated insights.

Specifications:
- Display of stack trace with syntax highlighting
- Presentation of AI-generated root cause hypotheses with confidence scores
- Evidence linking between hypotheses and supporting data
- User feedback mechanisms for AI suggestions
- Integration with external systems (e.g., issue trackers)

Please write comprehensive tests using Jest and React Testing Library that cover:
1. Component rendering with various crash data scenarios
2. Display of stack traces and AI insights
3. User interactions (feedback, navigation, integration actions)
4. Responsive behavior for different screen sizes
5. Accessibility compliance for complex technical content

Include test fixtures with sample crash data, stack traces, and AI analysis results. Focus on usability, information hierarchy, and technical accuracy.

Do NOT write the implementation yet - just the tests.
```

#### SUBTASK 3.2.2: Crash Detail View Implementation
**Prompt**:
```
Act as a senior frontend developer specializing in technical data visualization. Below are tests for a crash detail view component:

[Insert test code from previous subtask]

Please implement the crash detail view component so that all tests pass, following these guidelines:
1. Use React with TypeScript
2. Create a clear information hierarchy for complex crash data
3. Implement code syntax highlighting for stack traces
4. Design intuitive visualizations for AI confidence scores
5. Build user feedback mechanisms for AI suggestions
6. Ensure all interactive elements are keyboard accessible

Your implementation should include:
- A structured layout presenting crash information logically
- Stack trace viewer with syntax highlighting and line references
- AI insight presentation with evidence linking
- User controls for providing feedback on AI suggestions
- Integration points with external systems
- Responsive design and accessibility features

Focus on creating a technical yet usable interface that helps users understand complex crash data and AI-generated insights.
```

## EPIC 4: Integration Points and Ecosystem
*Description: Implement integrations with external systems and tools*

### TASK 4.1: Issue Tracker Integration
*Description: Implement bidirectional integration with issue tracking systems*

#### SUBTASK 4.1.1: Issue Tracker Integration Test Suite
**Prompt**:
```
Act as a test engineer. I need to write tests for an issue tracker integration service that connects our crash analyzer with systems like Jira, Azure DevOps, and GitHub Issues.

Specifications:
- Create issues from crash data (one-way integration)
- Sync status and comments between systems (two-way integration)
- Link crash data to existing issues
- Handle authentication and API tokens securely
- Support multiple issue tracker types

Please write comprehensive tests using Jest that cover:
1. Issue creation with crash data
2. Status and comment synchronization
3. Error handling for API failures
4. Authentication and authorization
5. Support for different issue tracker systems

Include mock API responses for different issue trackers and test fixtures for crash data. Focus on robust error handling and credential management.

Do NOT write the implementation yet - just the tests.
```

#### SUBTASK 4.1.2: Issue Tracker Integration Implementation
**Prompt**:
```
Act as a senior developer specializing in system integrations. Below are tests for an issue tracker integration service:

[Insert test code from previous subtask]

Please implement the issue tracker integration service so that all tests pass, following these guidelines:
1. Use Node.js with a plugin-based architecture for different issue trackers
2. Create abstract interfaces and concrete implementations for each system
3. Implement secure token/credential management
4. Add robust error handling and retries
5. Create bidirectional synchronization logic

Your implementation should include:
- Base classes and interfaces for issue tracker integration
- Concrete implementations for Jira, Azure DevOps, and GitHub Issues
- Secure credential storage and retrieval
- Mapping logic between crash data and issue fields
- Synchronization mechanisms for two-way updates
- Detailed logging and error reporting

Focus on creating a flexible, maintainable integration system that can be extended to support additional issue trackers in the future.
```

### TASK 4.2: Plugin System Implementation
*Description: Implement the plugin architecture for extensibility*

#### SUBTASK 4.2.1: Plugin System Test Suite
**Prompt**:
```
Act as a test engineer. I need to write tests for a plugin system that allows extending the crash analyzer with custom functionality.

Specifications:
- Plugin discovery and loading mechanisms
- Lifecycle management (install, activate, deactivate, uninstall)
- Versioning and dependency resolution
- Isolation and security boundaries
- Well-defined extension points

Please write comprehensive tests using Jest that cover:
1. Plugin discovery and registration
2. Lifecycle events and state management
3. Version compatibility checking
4. Security isolation and resource limitations
5. Extension point interaction

Include test fixtures with sample plugins of different types. Focus on stability, security, and maintainability.

Do NOT write the implementation yet - just the tests.
```

#### SUBTASK 4.2.2: Plugin System Implementation
**Prompt**:
```
Act as a senior developer specializing in extensible architectures. Below are tests for a plugin system:

[Insert test code from previous subtask]

Please implement the plugin system so that all tests pass, following these guidelines:
1. Use Node.js with a modular architecture
2. Create a robust plugin discovery and loading mechanism
3. Implement secure sandboxing for plugin execution
4. Design clear extension points and interfaces
5. Add dependency and version management

Your implementation should include:
- Plugin manager for lifecycle operations
- Loading and initialization mechanisms
- Extension point registry and interaction
- Versioning and compatibility checking
- Security boundaries and resource limitations
- Event system for plugin communication

Focus on creating a flexible, secure plugin architecture that enables third-party extensions without compromising the stability or security of the core system.
```

## EPIC 5: Advanced AI Features
*Description: Implement advanced AI capabilities beyond the core functionalities*

### TASK 5.1: Root Cause Analysis Enhancement
*Description: Improve the AI's ability to identify and explain crash root causes*

#### SUBTASK 5.1.1: Enhanced RCA Model Design
**Prompt**:
```
Act as an AI/ML architect specializing in root cause analysis. Design an enhanced RCA system for the crash analyzer that improves upon the basic LLM integration.

Based on the research document, create a detailed design for:
1. Advanced prompt engineering techniques for RCA
2. Chain-of-thought reasoning processes
3. Evidence correlation and confidence scoring
4. Knowledge extraction and utilization from documentation
5. Integration with code context and historical crash data

Your design should include:
- Prompt templates with examples
- Data flow diagrams for the RCA process
- Confidence scoring algorithms
- Examples of expected inputs and outputs
- Performance and accuracy metrics

Focus on creating an explainable, accurate RCA system that utilizes LLMs (via Ollama) effectively while providing transparent reasoning and evidence for its conclusions.
```

#### SUBTASK 5.1.2: RCA Enhancement Implementation
**Prompt**:
```
Act as a senior AI engineer specializing in LLM applications. Based on the RCA enhancement design:

[Insert design from previous subtask]

Implement the enhanced Root Cause Analysis system following these guidelines:
1. Use Python with LangChain or a similar framework
2. Create modular prompt templates with chain-of-thought reasoning
3. Implement evidence extraction and confidence scoring
4. Add RAG capabilities using vector embeddings
5. Create visualization components for the reasoning process

Your implementation should include:
- Advanced prompt generation system
- LLM orchestration with reasoning steps
- Evidence collection and correlation
- Confidence score calculation
- Results formatting for frontend display
- Integration with the existing AI Analysis Service

Focus on creating an accurate, explainable RCA system that provides valuable insights into crash causes with appropriate confidence levels and supporting evidence.
```

### TASK 5.2: Proactive Anomaly Detection
*Description: Implement AI-driven proactive detection of potential crashes*

#### SUBTASK 5.2.1: Anomaly Detection System Design
**Prompt**:
```
Act as a machine learning architect specializing in anomaly detection. Design a proactive anomaly detection system for the crash analyzer that can identify potential issues before they cause widespread crashes.

Based on the research document section on proactive capabilities, create a detailed design for:
1. Log and telemetry data analysis for anomaly detection
2. Statistical and ML-based approaches for identifying unusual patterns
3. Integration with the existing crash data pipeline
4. Alert generation and prioritization
5. Feedback mechanisms for improving detection accuracy

Your design should include:
- Data requirements and preprocessing steps
- Algorithm selection and justification
- Feature engineering approaches
- Threshold determination methods
- Alerting and notification mechanisms
- Performance metrics and evaluation approach

Focus on creating a system that can effectively detect emerging issues with minimal false positives, providing actionable insights to prevent potential crashes.
```

#### SUBTASK 5.2.2: Anomaly Detection Implementation
**Prompt**:
```
Act as a senior ML engineer specializing in anomaly detection. Based on the anomaly detection system design:

[Insert design from previous subtask]

Implement the proactive anomaly detection system following these guidelines:
1. Use Python with appropriate ML libraries (scikit-learn, PyTorch, or TensorFlow)
2. Create efficient data preprocessing pipelines
3. Implement both statistical and ML-based detection algorithms
4. Design a robust alerting mechanism with priority scoring
5. Add feedback incorporation for continuous improvement

Your implementation should include:
- Data ingestion and preprocessing components
- Multiple detection algorithms (statistical, ML-based)
- Anomaly scoring and prioritization logic
- Alert generation and notification system
- Feedback collection and model updating mechanisms
- Integration with the main crash analyzer system

Focus on creating a reliable, efficient anomaly detection system that can identify potential issues early with a reasonable balance between sensitivity and false positives.
```

## EPIC 6: Documentation and Training
*Description: Create comprehensive documentation and training materials*

### TASK 6.1: Technical Documentation
*Description: Develop technical documentation for developers and administrators*

#### SUBTASK 6.1.1: API and Integration Documentation
**Prompt**:
```
Act as a technical writer specializing in API documentation. Create comprehensive API documentation for the AI-Driven Crash Analyzer system.

Based on the implemented services and APIs, document:
1. All public API endpoints with request/response formats
2. Authentication and authorization requirements
3. Rate limiting and usage guidelines
4. Plugin development and integration instructions
5. Common error codes and troubleshooting

Your documentation should include:
- OpenAPI/Swagger specifications for REST APIs
- Code examples in multiple languages
- Integration patterns and best practices
- Security considerations and requirements
- Testing and validation procedures

Format the documentation as Markdown files suitable for inclusion in a developer portal, with clear navigation, examples, and explanations tailored for a technical audience.
```

#### SUBTASK 6.1.2: System Architecture Documentation
**Prompt**:
```
Act as a technical architect. Create comprehensive architecture documentation for the AI-Driven Crash Analyzer system.

Based on the implemented system, document:
1. Overall system architecture and design principles
2. Service decomposition and responsibilities
3. Data flow and storage architecture
4. Integration points and patterns
5. Deployment architecture and requirements
6. Security architecture and controls

Your documentation should include:
- High-level architecture diagrams
- Service interaction diagrams
- Data models and flows
- Deployment topology diagrams
- Security control descriptions
- Capacity planning guidelines

Format the documentation as a comprehensive architecture guide with clear sections, diagrams, and explanations suitable for developers, architects, and operations teams.
```

### TASK 6.2: User Documentation and Training
*Description: Develop user-facing documentation and training materials*

#### SUBTASK 6.2.1: Role-Based User Guides
**Prompt**:
```
Act as a technical writer specializing in user documentation. Create role-based user guides for the AI-Driven Crash Analyzer system.

Based on the research document's user roles (L1/L2/L3 Support, Developers, QA, Managers), create guides for:
1. L1/L2 Support Engineers: Focus on crash triage, basic analysis, and escalation
2. L3 Support/Developers: Detailed technical analysis, code fix suggestions, integration with development tools
3. QA Engineers: Crash monitoring, version comparison, test case creation
4. Support Managers: Dashboard usage, reporting, and team performance monitoring

Each guide should include:
- Role-specific workflows and use cases
- Step-by-step instructions with screenshots
- Tips for effective usage of AI features
- Common tasks and troubleshooting
- Integration with existing tools and processes

Format the guides as accessible, well-structured documents with clear navigation, visuals, and examples tailored to each role's technical level and needs.
```

#### SUBTASK 6.2.2: Training Materials and Tutorials
**Prompt**:
```
Act as an instructional designer. Create training materials and tutorials for the AI-Driven Crash Analyzer system.

Based on the system functionality and user roles, develop:
1. Getting Started tutorials for first-time users
2. Role-specific training modules (Support, Development, QA, Management)
3. Advanced topic workshops (AI feature usage, plugin development, integration)
4. Self-assessment quizzes and exercises
5. Reference cheat sheets and quick guides

Your materials should include:
- Video script outlines for tutorial recordings
- Hands-on exercises with sample data
- Knowledge check questions and answers
- Progressive learning paths for different roles
- Quick reference materials for daily usage

Format the training materials in a modular structure that allows for self-paced learning, classroom training, or hybrid approaches, with clear learning objectives and outcomes for each module.
```
