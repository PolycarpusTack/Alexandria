# Modular AI-Enhanced Customer Care & Services Platform: Code Creation Plan

## EPIC 1: Platform Core - Microkernel Architecture Foundation

**Epic Description:** Establish the foundation of the platform with a Microkernel architecture that will serve as the base for all plugin functionality, focusing on creating a minimal, stable core with well-defined extension points.

### TASK 1.1: Core Platform Architecture Design & Bootstrapping

**Task Description:** Define and implement the essential components of the Microkernel architecture including the core system, plugin registry, and event bus.

#### SUBTASK 1.1.1: Core System Design & Implementation

**Description:** Create the minimal core system that will manage the platform's essential services.

**Prompt:**

```
Act as a senior software engineer with expertise in Microkernel architecture patterns. I need to implement the minimal core system for a modular customer care platform following the Microkernel pattern.

The core should include:
1. Basic request handling for UI interactions
2. A foundational UI shell framework
3. Core data models (users, cases, basic log structures)
4. User authentication/authorization services

Focus on:
- Clear separation of core functionality from plugin-specific code
- Stable interfaces that won't change frequently
- Minimal dependencies
- Error handling and resilience

Please provide:
1. The key files/classes structure we should create
2. Implementation of the essential core classes with proper abstraction
3. Clear interface definitions that plugins will implement

Use TypeScript and React for the implementation. Follow modern software practices including SOLID principles and implement proper error handling throughout.
```

#### SUBTASK 1.1.2: Plugin Registry & Lifecycle Management

**Description:** Implement the plugin registry responsible for discovering, loading, and managing the lifecycle of plugins.

**Prompt:**

```
Act as a senior software engineer with expertise in plugin systems. I need to implement a robust Plugin Registry for a Microkernel architecture platform.

The Plugin Registry should:
1. Discover plugins from a designated directory or manifest files
2. Validate plugin manifests (ensuring they meet required format/fields)
3. Manage plugin states (Discovered, Installed, Active, Inactive, NeedsUpdate, Errored)
4. Support plugin lifecycle events (install, activate, deactivate, uninstall, update)
5. Implement a permission model for plugin capabilities

Specific requirements:
- Each plugin must have a manifest (plugin.json) with name, version, entry points, dependencies, and required permissions
- Plugins should run in sandboxed environments
- The registry should handle dependency resolution (including plugin-to-plugin dependencies)
- Implement proper error handling for plugin loading failures

Use TypeScript and provide comprehensive unit tests for the registry. Include examples of plugin manifest formats and lifecycle method implementations.
```

#### SUBTASK 1.1.3: Event Bus & Inter-Process Communication

**Description:** Create the event bus or IPC mechanism that enables communication between the core and plugins as well as between plugins.

**Prompt:**

```
Act as a senior software engineer with expertise in event-driven architectures. I need to implement an Event Bus / Inter-Process Communication (IPC) mechanism for a Microkernel architecture platform.

The Event Bus should:
1. Allow the core system and plugins to publish events
2. Enable plugins and core components to subscribe to events
3. Support topic-based pub/sub model
4. Include typing for events (TypeScript)
5. Handle errors gracefully (e.g., subscriber errors shouldn't affect publisher)

Specific requirements:
- Support for both synchronous and asynchronous events
- Ensure loose coupling between plugins
- Provide a registry of standard event types that plugins should conform to
- Include debugging capabilities (e.g., log events for troubleshooting)
- Implement throttling/debouncing for high-frequency events

Use TypeScript and provide comprehensive unit tests for the event bus. Include examples of standard event types and usage patterns for both publishing and subscribing.
```

### TASK 1.2: Feature Flag Service Implementation

**Description:** Implement a feature flag management system to control plugin activation and feature rollout.

**Prompt:**

```
Act as a senior software engineer with expertise in feature flags and progressive delivery. I need to implement a Feature Flag Service for a Microkernel architecture platform that will control plugin activation and feature rollout.

The Feature Flag Service should:
1. Store and manage feature flag configurations
2. Support flag evaluation based on user/context
3. Enable gradual rollout (percentage-based)
4. Support user segmentation (e.g., internal testers, beta users)
5. Integrate with the Plugin Registry to control plugin activation

Specific requirements:
- Provide a clean API for checking flag status: isEnabled(flagName, context)
- Support flag overrides for testing
- Include audit logging for flag changes
- Implement caching for performance
- Support flag dependencies (if A is off, B should also be off)

The service should be standalone but integrate with the core platform. Use TypeScript and provide comprehensive unit tests. Include examples of flag configurations and evaluation scenarios.
```

### TASK 1.3: Data Persistence & Security Foundation

**Description:** Establish the data storage layer and implement core security features.

#### SUBTASK 1.3.1: PostgreSQL Schema Design & Implementation

**Description:** Design and implement the core database schema for user data, platform configuration, and plugin metadata.

**Prompt:**

```
Act as a database architect with expertise in PostgreSQL. I need to design and implement the core database schema for a modular customer care platform.

The schema should include:
1. User data (profiles, roles, permissions)
2. Platform configuration
3. Plugin metadata (installed plugins, versions, configurations)
4. Basic audit logging tables

Specific requirements:
- Implement proper relationships and constraints
- Design with scalability in mind
- Consider GDPR compliance requirements
- Use UUIDs for primary keys where appropriate
- Implement schema versioning to support future migrations

For each table, provide:
1. DDL statements for creation
2. Explanations of key fields and relationships
3. Indexing strategies
4. Example queries for common operations

Also include a migration strategy for future schema updates. Use best practices for PostgreSQL including appropriate data types, constraints, and indexing.
```

#### SUBTASK 1.3.2: Security Services Implementation

**Description:** Implement core security services including authentication, authorization, and data encryption.

**Prompt:**

```
Act as a security engineer with expertise in web application security. I need to implement core security services for a modular customer care platform.

The security services should include:
1. Authentication system (supporting OAuth 2.0, SAML)
2. Role-based access control (RBAC)
3. Data encryption (at rest and in transit)
4. Input validation framework
5. Audit logging for security events

Specific requirements:
- Implement secure password handling
- Support multi-factor authentication
- Provide a permissions service that plugins can use
- Implement secure communications between components
- Ensure PII data protection

Use TypeScript and provide comprehensive unit tests. Include detailed documentation on the security architecture and best practices for plugin developers to follow when accessing sensitive data or privileged operations.
```

### TASK 1.4: Core UI Framework & Component Library

**Description:** Create the foundational UI framework and component library that will maintain consistency across the platform.

**Prompt:**

```
Act as a senior frontend engineer with expertise in UI architecture and design systems. I need to implement a foundational UI framework and component library for a modular customer care platform.

The UI framework should:
1. Provide a shell application with consistent navigation
2. Define extension points where plugins can contribute UI components
3. Implement a component library with standard UI elements
4. Support different user roles with adaptive layouts

Specific requirements:
- Use React with TypeScript
- Implement responsive design principles
- Ensure accessibility compliance (WCAG 2.1 AA)
- Create a consistent visual language
- Support theming and customization
- Provide UI contribution points for plugins

Components to include:
- Navigation components (sidebar, breadcrumbs, command palette)
- Data visualization components (tables, charts, dashboards)
- Form components with validation
- Notification system
- Modal/dialog system
- Extension point components for plugin UI integration

Provide comprehensive documentation, usage examples, and storybook integration for component testing and visualization.
```

### [AFTER TASK 1.4 COMPLETION] Zero to Hero Guide: Platform Core Foundation

**Prompt:**

```
Create a comprehensive "Zero to Hero" guide based on our platform core implementation. Act as a world-class instructional designer and textbook author, using the principles from the attached guide template.

Subject: "Microkernel Architecture Platform Development: Core Systems"

Follow the structure exactly as outlined in the guide template, including:
1. Pre-Generation Analysis that identifies learning challenges specific to microkernel architecture
2. A pedagogical twist that makes learning engaging
3. Full chapter structure with all required elements (learning objectives, metaphors, interactive elements, etc.)

Focus chapters on:
1. Understanding Microkernel Architecture principles
2. Plugin system fundamentals
3. Event-driven communication patterns
4. Feature flagging for modular systems
5. Security considerations in plugin-based architectures
6. Data persistence in modular systems
7. UI frameworks for plugin-based applications

For each implementation detail of our platform core, include:
- Clear conceptual explanations
- Code examples from our actual implementation
- Interactive exercises
- Common pitfalls and misconceptions
- Best practices

Make sure to include all the interactive elements, assessments, and pedagogical features specified in the template to create an engaging learning experience.
```

## EPIC 2: MVP Development - AI-Powered Crash Analyzer

**Epic Description:** Develop the Crash Analyzer as the first plugin for the platform, leveraging AI/LLM capabilities for crash log analysis and providing a valuable starting point to demonstrate the platform's extensibility.

### TASK 2.1: Crash Analyzer Core Functionality

**Description:** Implement the core components of the Crash Analyzer plugin.

#### SUBTASK 2.1.1: Plugin Manifest & Integration

**Description:** Create the Crash Analyzer plugin manifest and basic integration with the core platform.

**Prompt:**

```
Act as a senior software engineer with expertise in plugin development. I need to implement the plugin manifest and core integration for an AI-Powered Crash Analyzer plugin that will operate within our microkernel architecture platform.

The plugin manifest should include:
1. Basic metadata (name, version, description)
2. Required permissions (file access, LLM access, database access)
3. UI contribution points (where the plugin will add UI elements)
4. Event subscriptions (what platform events the plugin will respond to)
5. Dependencies (any other plugins or core services it requires)

For integration, implement:
1. Plugin initialization code that registers with the core platform
2. Event handlers for relevant platform events
3. Registration of UI components through the platform's extension points
4. Setup of any plugin-specific database tables/schema

Use TypeScript following our established platform patterns. Ensure proper error handling for initialization failures and graceful degradation if dependencies are unavailable.
```

#### SUBTASK 2.1.2: Crash Log Ingestion & Parser

**Description:** Implement the mechanism for ingesting crash logs and parsing them into structured data.

**Prompt:**

```
Act as a software engineer with expertise in log parsing and natural language processing. I need to implement a crash log ingestion and parsing system for an AI-Powered Crash Analyzer plugin.

The system should:
1. Support uploading crash log files through the UI (text files, simple JSON)
2. Implement parsers for common log formats
3. Extract structured data from raw logs including:
   - Timestamps
   - Error levels
   - Thread IDs
   - Stack traces
   - Error messages
4. Pre-process the data before sending to an LLM

Specific requirements:
- Use regular expressions and NLP techniques for pattern recognition
- Handle various log formats gracefully
- Provide extension points for adding new log format parsers
- Create a structured intermediate representation of the log data
- Implement error handling for malformed logs

Use TypeScript and provide comprehensive unit tests with sample log files. Include documentation on the parsing strategies and the structured format produced by the parser.
```

#### SUBTASK 2.1.3: Local LLM Integration (Ollama)

**Description:** Implement integration with Ollama for running local LLMs to analyze crash data.

**Prompt:**

```
Act as a machine learning engineer with expertise in Large Language Models. I need to implement integration with Ollama for running local LLMs within our AI-Powered Crash Analyzer plugin.

The integration should:
1. Set up a service to communicate with Ollama
2. Support model management (checking available models, downloading if needed)
3. Implement prompt engineering for crash analysis
4. Handle response parsing and error conditions
5. Manage resource usage (prevent overloading the system)

Specific requirements:
- Target smaller, quantized models in the 1B to 8B parameter range for efficiency
- Implement prompt templates specifically designed for crash analysis
- Handle model loading errors and timeouts gracefully
- Support configuration of different models for different analysis tasks
- Include a retry mechanism for failed LLM calls

Use TypeScript and provide comprehensive unit tests with mocked LLM responses. Include detailed documentation on the model selection strategy, prompt engineering approach, and performance considerations.
```

#### SUBTASK 2.1.4: Root Cause Analysis Engine

**Description:** Implement the core analysis engine that processes structured crash data using LLMs to identify potential root causes.

**Prompt:**

```
Act as an AI engineer with expertise in root cause analysis and LLM applications. I need to implement a Root Cause Analysis (RCA) engine for an AI-Powered Crash Analyzer plugin.

The RCA engine should:
1. Take structured crash data (pre-processed logs, stack traces) as input
2. Craft effective prompts for the LLM based on this data
3. Parse and structure the LLM's responses
4. Assign confidence scores to potential root causes
5. Link hypotheses to supporting evidence in the logs

Specific requirements:
- Implement different analysis strategies based on the type of crash
- Use chain-of-thought prompting to improve LLM reasoning
- Extract and highlight the primary error message
- Identify the most likely failing component from stack traces
- Suggest potential categories of problems with confidence scores
- Propose generic troubleshooting steps

The engine should output a structured analysis with:
- Primary error identified
- Failing function/component
- Potential root causes (each with confidence score and explanation)
- Supporting evidence for each cause
- Suggested troubleshooting steps

Use TypeScript and provide comprehensive unit tests with sample crash data and expected analyses. Include documentation on the prompt engineering approach and confidence scoring methodology.
```

### TASK 2.2: Crash Analyzer UI Development

**Description:** Develop the user interface components for the Crash Analyzer plugin.

#### SUBTASK 2.2.1: Crash Log Upload & Management UI

**Description:** Create the interface for uploading, viewing, and managing crash logs.

**Prompt:**

```
Act as a frontend engineer with expertise in React and UI/UX design. I need to implement the Crash Log Upload & Management UI for an AI-Powered Crash Analyzer plugin.

The UI should include:
1. A drag-and-drop file upload component for crash logs
2. A list view of uploaded/analyzed logs with filtering and sorting
3. Basic management functions (delete, rename, tag logs)
4. Status indicators showing analysis progress
5. Preview of basic log information before full analysis

Specific requirements:
- Design for a clean, intuitive user experience
- Implement responsive layouts that work on various screen sizes
- Follow accessibility guidelines (WCAG 2.1 AA)
- Include loading states and error handling
- Support batch uploads
- Implement proper validation for uploaded files

Use React with TypeScript and our established component library. Include comprehensive unit and integration tests. Provide documentation on the component structure and state management approach.
```

#### SUBTASK 2.2.2: Analysis Results Display

**Description:** Create the interface for displaying, exploring, and interacting with crash analysis results.

**Prompt:**

```
Act as a frontend engineer with expertise in data visualization and technical UI design. I need to implement the Analysis Results Display for an AI-Powered Crash Analyzer plugin.

The UI should include:
1. A summary view with key findings prominently displayed
2. Detailed views for exploring the full analysis
3. Clear presentation of:
   - Primary error message
   - Failing component identification
   - Potential root causes with confidence scores
   - Supporting evidence with links to relevant log sections
   - Suggested troubleshooting steps
4. Interactive elements for exploring the analysis

Specific requirements:
- Implement progressive disclosure (summary first, details on demand)
- Use appropriate visualizations for confidence scores
- Allow drilling down into supporting evidence
- Highlight relevant parts of logs/stack traces
- Include options to provide feedback on AI-generated insights
- Implement clipboard support for sharing findings

Use React with TypeScript and our established component library. Include comprehensive unit and integration tests. Provide documentation on the component structure and state management approach.
```

#### SUBTASK 2.2.3: Dashboard & Reporting UI

**Description:** Create dashboard and reporting features for aggregated crash analysis data.

**Prompt:**

```
Act as a frontend engineer with expertise in dashboard design and data visualization. I need to implement Dashboard & Reporting UI components for an AI-Powered Crash Analyzer plugin.

The UI should include:
1. Summary dashboard showing key metrics (e.g., most common crash types)
2. Trend visualizations showing crash frequency over time
3. Distribution charts (crashes by device, OS, app version)
4. Filtering controls for data exploration
5. Export/sharing functionality for reports

Specific requirements:
- Implement interactive charts and visualizations
- Design for both high-level overview and detailed exploration
- Include controls for time period selection
- Support saving dashboard configurations
- Implement responsive layouts that adapt to different screen sizes
- Ensure accessibility compliance

Use React with TypeScript and appropriate visualization libraries (e.g., Recharts, D3). Include comprehensive unit and integration tests. Provide documentation on the component structure, state management, and data flow.
```

### TASK 2.3: AI Enhancement & Accuracy Improvement

**Description:** Refine and enhance the AI analysis capabilities for improved accuracy and insights.

#### SUBTASK 2.3.1: Prompt Engineering & Optimization

**Description:** Develop and refine effective prompts for the LLM to improve analysis quality.

**Prompt:**

```
Act as an AI prompt engineer with expertise in LLMs and technical problem-solving. I need to develop and optimize prompts for a crash analysis system that uses local LLMs (via Ollama).

The prompts should:
1. Guide the LLM to analyze crash logs and stack traces effectively
2. Extract meaningful insights about potential root causes
3. Generate confidence scores for suggested causes
4. Link hypotheses to specific evidence in the logs
5. Suggest appropriate troubleshooting steps

Specific requirements:
- Implement role-playing prompts (e.g., "You are an expert software debugger...")
- Use chain-of-thought approaches to improve reasoning
- Request structured outputs (e.g., JSON format)
- Include examples (few-shot prompting) for complex analysis tasks
- Design prompts that work well with smaller, quantized models (1-8B parameters)

Develop prompts for different analysis scenarios:
- General crash analysis
- Memory-related issues
- Network/connectivity problems
- Performance-related crashes
- Third-party library issues

For each prompt, provide:
1. The prompt template with placeholders for dynamic content
2. Explanation of the prompt's structure and reasoning
3. Example of the prompt with sample data
4. Expected output format

Test these prompts with sample crash logs and refine based on results. Document the prompt engineering methodology and provide guidance for future improvements.
```

#### SUBTASK 2.3.2: Feedback Mechanism & Continuous Improvement

**Description:** Implement mechanisms for capturing user feedback on AI analyses to enable continuous improvement.

**Prompt:**

```
Act as a senior software engineer with expertise in AI feedback systems. I need to implement a Feedback Mechanism for an AI-Powered Crash Analyzer that will enable continuous improvement.

The system should:
1. Capture user feedback on AI-generated analyses
2. Store feedback data in a structured format
3. Provide dashboards for monitoring feedback patterns
4. Support supervised fine-tuning data creation
5. Enable A/B testing of different analysis approaches

Specific requirements:
- Implement UI components for rating AI insights (e.g., thumbs up/down)
- Allow users to provide more detailed feedback (corrections, suggestions)
- Associate feedback with specific parts of the analysis
- Store feedback with metadata (user role, crash type, confidence scores)
- Create a feedback review interface for AI model improvement

Use TypeScript and our established platform patterns. Include comprehensive unit and integration tests. Provide documentation on the feedback data schema, collection methodology, and potential usage for model improvement.
```

### TASK 2.4: Testing & Quality Assurance

**Description:** Implement comprehensive testing for the Crash Analyzer, including unit, integration, and AI performance tests.

**Prompt:**

```
Act as a QA engineer with expertise in testing AI applications. I need to implement a comprehensive testing strategy for an AI-Powered Crash Analyzer plugin.

The testing approach should include:
1. Unit tests for individual components
2. Integration tests for the entire plugin
3. Specialized tests for AI analysis quality
4. Performance testing
5. Security testing

Specific requirements:
- Create a benchmark dataset of crash logs with known root causes
- Implement tests that measure AI analysis accuracy against the benchmark
- Test for robustness against unusual or malformed inputs
- Measure and monitor LLM response times
- Verify proper handling of LLM unavailability/errors
- Test the entire user journey from log upload to analysis results

For AI testing:
- Define metrics for evaluation (accuracy, relevance, hallucination rates)
- Create reference-based evaluation methods
- Implement fail-mode tests for unexpected AI behavior

Use appropriate testing frameworks (Jest, Cypress) and provide comprehensive test documentation. Include guidelines for maintaining and expanding the test suite as the plugin evolves.
```

### [AFTER EPIC 2 COMPLETION] Zero to Hero Guide: AI-Powered Crash Analyzer

**Prompt:**

```
Create a comprehensive "Zero to Hero" guide based on our AI-Powered Crash Analyzer implementation. Act as a world-class instructional designer and textbook author, using the principles from the attached guide template.

Subject: "AI-Powered Crash Analysis: From Logs to Insights"

Follow the structure exactly as outlined in the guide template, including:
1. Pre-Generation Analysis that identifies learning challenges specific to crash analysis and AI integration
2. A pedagogical twist that makes learning engaging
3. Full chapter structure with all required elements (learning objectives, metaphors, interactive elements, etc.)

Focus chapters on:
1. Understanding crash logs and stack traces
2. NLP techniques for log parsing
3. LLM integration and prompt engineering
4. Root cause analysis methodology
5. Designing effective AI analysis presentation
6. Feedback collection and continuous improvement
7. Practical crash analysis workflows

For each implementation detail of our Crash Analyzer, include:
- Clear conceptual explanations
- Code examples from our actual implementation
- Interactive exercises that use real crash logs
- Common pitfalls and misconceptions
- Best practices for AI-assisted debugging

Make sure to include all the interactive elements, assessments, and pedagogical features specified in the template to create an engaging learning experience.
```

## EPIC 3: Additional Plugin Development

**Epic Description:** Expand the platform's capabilities by developing additional high-value plugins.

### TASK 3.1: Log Visualization Plugin

**Description:** Develop a Log Visualization plugin for aggregating, searching, and visualizing log data.

**Prompt:**

```
Act as a senior software engineer with expertise in log management and visualization. I need to implement a Log Visualization plugin for our modular customer care platform.

The plugin should:
1. Connect to existing log management systems (e.g., ELK stack, Grafana Loki)
2. Provide a unified interface for searching and filtering logs
3. Implement visualizations for log patterns and trends
4. Allow correlation between logs and crash reports
5. Support real-time log streaming where possible

Specific requirements:
- Create adapters for different log sources (extensible design)
- Implement powerful search and filtering capabilities
- Design visualizations for log volumes, error rates, patterns
- Support various log levels and formats
- Include timeline views for understanding sequences of events
- Allow saving and sharing of searches and visualizations

The plugin should integrate with our microkernel platform architecture, following the established plugin patterns. Use TypeScript and appropriate visualization libraries. Provide comprehensive documentation and testing.
```

### TASK 3.2: AI-Driven Ticket Analysis Plugin

**Description:** Develop a plugin that uses AI to analyze and categorize support tickets, extracting key entities and suggesting prioritization.

**Prompt:**

```
Act as an AI engineer with expertise in NLP and customer support systems. I need to implement an AI-Driven Ticket Analysis plugin for our modular customer care platform.

The plugin should:
1. Integrate with support platforms (e.g., Zendesk, Jira Service Management)
2. Use LLMs to analyze incoming ticket content
3. Automatically categorize tickets by type and urgency
4. Extract key entities (product, version, error codes)
5. Suggest appropriate priority levels
6. Identify similar past tickets and their resolutions

Specific requirements:
- Implement adapters for different ticket systems
- Design effective prompts for LLM-based ticket analysis
- Create a dashboard showing ticket categorization and trends
- Allow manual correction of AI categorizations (for feedback)
- Support automatic linking between tickets and related crash reports
- Implement batch processing for historical tickets

The plugin should integrate with our microkernel platform architecture and leverage the Ollama integration established for the Crash Analyzer. Use TypeScript and provide comprehensive documentation and testing.
```

### TASK 3.3: Intelligent Knowledge Base (RAG) Plugin

**Description:** Develop a Retrieval Augmented Generation (RAG) plugin that connects to knowledge bases and provides contextual answers.

**Prompt:**

```
Act as an AI engineer with expertise in Retrieval Augmented Generation (RAG) systems. I need to implement an Intelligent Knowledge Base plugin for our modular customer care platform.

The plugin should:
1. Connect to existing knowledge bases (e.g., Confluence, Guru, documentation sites)
2. Index content for efficient retrieval
3. Use RAG techniques to answer user questions with contextual support
4. Provide citations to source materials
5. Support both manual queries and integration with other plugins

Specific requirements:
- Implement adapters for different knowledge sources
- Create an efficient vector storage system for embeddings
- Design effective RAG prompts for local LLMs (via Ollama)
- Build a simple, intuitive query interface
- Include confidence scoring for generated answers
- Support feedback mechanisms to improve retrieval quality

The plugin should integrate with our microkernel platform architecture and leverage the Ollama integration established for the Crash Analyzer. Use TypeScript and provide comprehensive documentation and testing.
```

### [AFTER EACH PLUGIN COMPLETION] Zero to Hero Guide: [Plugin Name]

**Prompt:**

```
Create a comprehensive "Zero to Hero" guide based on our [Plugin Name] implementation. Act as a world-class instructional designer and textbook author, using the principles from the attached guide template.

Subject: "[Main Plugin Functionality]: From Fundamentals to Advanced Usage"

Follow the structure exactly as outlined in the guide template, including:
1. Pre-Generation Analysis that identifies learning challenges specific to [plugin domain]
2. A pedagogical twist that makes learning engaging
3. Full chapter structure with all required elements (learning objectives, metaphors, interactive elements, etc.)

Focus chapters on:
1. Core concepts of [plugin domain]
2. Understanding the plugin's architecture
3. Key workflows and use cases
4. Integration with other platform components
5. Advanced usage techniques
6. Troubleshooting and optimization
7. Best practices for [plugin domain]

For each implementation detail of our plugin, include:
- Clear conceptual explanations
- Code examples from our actual implementation
- Interactive exercises
- Common pitfalls and misconceptions
- Best practices

Make sure to include all the interactive elements, assessments, and pedagogical features specified in the template to create an engaging learning experience.
```

## EPIC 4: Platform Integration & Workflows

**Epic Description:** Create synergistic workflows between plugins, enabling powerful use cases that span across multiple tools.

### TASK 4.1: Cross-Plugin Workflow: Ticket-to-Resolution

**Description:** Implement a workflow that connects support tickets to crash analysis and knowledge base suggestions for faster resolution.

**Prompt:**

```
Act as a senior software engineer with expertise in workflow automation and system integration. I need to implement a Cross-Plugin Workflow for our modular customer care platform that connects the Ticket Analysis, Crash Analyzer, and Knowledge Base plugins.

The workflow should:
1. Automatically link incoming support tickets with related crash reports
2. Extract key information from tickets to pre-populate crash analysis
3. Use analysis results to search the knowledge base for relevant solutions
4. Present a unified view of the ticket, related crashes, and knowledge resources
5. Track the resolution journey from ticket creation to solution

Specific requirements:
- Use the platform's event bus for inter-plugin communication
- Implement a workflow service that orchestrates the cross-plugin activities
- Create UI components that integrate views from multiple plugins
- Design the system to gracefully handle missing plugins
- Include audit logging of the entire resolution process
- Support both automated and manual linking between components

The implementation should leverage our microkernel platform architecture and follow established patterns for plugin integration. Use TypeScript and provide comprehensive documentation and testing.
```

### TASK 4.2: Proactive Customer Communication Workflow

**Description:** Implement a workflow that uses analysis results to generate and send proactive customer communications.

**Prompt:**

```
Act as a senior software engineer with expertise in customer communication systems and AI. I need to implement a Proactive Customer Communication Workflow for our modular customer care platform.

The workflow should:
1. Monitor crash analysis results for patterns and widespread issues
2. Identify affected customer segments
3. Use LLMs to draft appropriate customer communications
4. Integrate with notification systems (email, SMS, in-app)
5. Track communication effectiveness and customer responses

Specific requirements:
- Create rules engine for determining when proactive communication is warranted
- Implement templates for different types of communications
- Design LLM prompts for generating customer-friendly explanations
- Include approval workflows for automated communications
- Support scheduling and timing of notifications
- Implement feedback collection on communication effectiveness

The implementation should integrate with our existing plugins (particularly the Crash Analyzer) and leverage the platform's event bus and feature flag system. Use TypeScript and provide comprehensive documentation and testing.
```

### TASK 4.3: AI-Powered Support Dashboard

**Description:** Create a comprehensive dashboard that aggregates insights from all plugins into an actionable view for support managers.

**Prompt:**

```
Act as a senior software engineer with expertise in dashboard design and data visualization. I need to implement an AI-Powered Support Dashboard for our modular customer care platform.

The dashboard should:
1. Aggregate key metrics and insights from all active plugins
2. Highlight trends, anomalies, and potential issues
3. Show correlation between different data sources (tickets, crashes, logs)
4. Provide actionable insights for support managers
5. Support customization for different roles and preferences

Specific requirements:
- Design an intuitive, clean interface focused on decision support
- Implement visualizations that clearly communicate complex relationships
- Use AI to generate insights and recommendations from the aggregated data
- Include real-time and historical views
- Support drill-down into detailed data
- Allow dashboard configuration and saving of views
- Implement responsive design for various devices

The implementation should leverage data from all available plugins and use the platform's extension points for visualization components. Use TypeScript with appropriate visualization libraries and provide comprehensive documentation and testing.
```

## EPIC 5: Documentation & Knowledge Transfer

**Epic Description:** Create comprehensive documentation for the platform, plugins, and development guides.

### TASK 5.1: Platform Technical Documentation

**Description:** Create detailed technical documentation for the platform architecture, APIs, and extension points.

**Prompt:**

```
Act as a technical writer with expertise in software architecture and API documentation. I need comprehensive technical documentation for our modular customer care platform.

The documentation should cover:
1. Platform Architecture Overview
   - Microkernel architecture explanation
   - Core components and their responsibilities
   - Plugin system design
   - Event bus and communication patterns
   - Feature flag integration

2. API Reference
   - Core APIs available to plugins
   - Event types and their specifications
   - Extension point documentation
   - Authentication and authorization APIs
   - Data access APIs

3. Plugin Development Guide
   - Plugin lifecycle
   - Manifest format and requirements
   - UI contribution guidelines
   - Best practices and patterns
   - Testing framework and guidelines

4. Deployment & Operations
   - System requirements
   - Installation procedures
   - Configuration options
   - Monitoring guidelines
   - Troubleshooting procedures

Use clear, concise language with appropriate diagrams and code examples. Structure the documentation hierarchically with intuitive navigation. Include a search function and comprehensive cross-referencing. Follow best practices for technical documentation, ensuring accuracy, completeness, and usability.
```

### TASK 5.2: Plugin Documentation & User Guides

**Description:** Create user-focused documentation for each plugin, including usage guides and examples.

**Prompt for each plugin:**

```
Act as a technical writer with expertise in user documentation. I need comprehensive documentation for the [Plugin Name] plugin of our modular customer care platform.

The documentation should include:

1. Plugin Overview
   - Purpose and key capabilities
   - Features and benefits
   - Use cases and scenarios

2. Getting Started
   - Installation and activation
   - Initial configuration
   - Quick start guide

3. User Guide
   - Detailed feature explanations
   - Step-by-step workflows
   - UI component descriptions
   - Configuration options

4. Best Practices
   - Recommended usage patterns
   - Tips and tricks
   - Common pitfalls and how to avoid them

5. Troubleshooting
   - Common issues and their solutions
   - Error message explanations
   - Support resources

6. FAQ
   - Answers to common questions
   - Usage clarifications
   - Integration questions

Use clear, accessible language appropriate for the target audience (support agents, developers, managers). Include screenshots, workflow diagrams, and examples. Structure the documentation logically with intuitive navigation and comprehensive cross-referencing.
```

### TASK 5.3: "Files for Dummies" Documentation

**Description:** Create simplified explanations for each code file developed in the project.

**Prompt (to be used after each file creation):**

```
Act as a meticulous and helpful Senior Software Engineer explaining the provided code file. Your audience includes both junior developers needing clear explanations and experienced developers looking for context and potential areas for review. Maintain a clear, patient, and technically precise tone.

Structure the explanation according to these sections:

1. File Overview & Context
   - Filename: [filename]
   - Primary Purpose: [One-sentence summary]
   - Language & Environment: [Language, frameworks used]
   - Key Libraries/Frameworks Used: [List key dependencies]
   - Potential Prerequisites: [What knowledge is needed]
   - Execution Entry Point: [How this code is run or used]

2. High-Level Flow Description
   [Brief paragraph describing how this code works]

3. Detailed Code Breakdown
   [For each logical section of code:]

   Lines XX - YY:
```

[code snippet]

```

What it does: [Plain-English description]
Why it matters: [Purpose of this code section]
Potential Impact if Changed/Removed: [What would break]

[Optional] ELI5 Analogy: [Simple metaphor]
[Optional] Deeper Dive: [More technical details]

4. Execution & Data Summary
- Execution Timeline: [Order of operations]
- Key Data Lifecycle: [How data flows through the code]
- Areas Needing Careful Review: [Potential issues]

5. Potential Pitfalls & Debugging Hints
- Common Error Patterns: [What might go wrong]
- Basic Debugging Suggestions: [How to fix issues]

6. Code Quality & Refinement Suggestions
A. Style & Readability: [Suggestions for improvement]
B. Performance & Security Considerations: [Include mandatory disclaimer]

7. Glossary
[Define technical terms used in the code]

8. Further Learning Resources
[Relevant documentation links]

Disclaimer: This documentation was generated by an AI language model based on the provided code. While it aims to be helpful, it is a first draft and may contain inaccuracies, omissions, or misinterpretations. It requires thorough review and validation by qualified human developers. Critical aspects, especially regarding security and performance (Section 6), must be verified using appropriate tools and expert judgment before relying on any suggestions.
```

## EPIC 6: Platform Deployment & Operations

**Epic Description:** Implement the necessary infrastructure and processes for deploying, monitoring, and operating the platform.

### TASK 6.1: Containerization & Environment Setup

**Description:** Create Docker configurations and environment setup for the platform.

**Prompt:**

```
Act as a DevOps engineer with expertise in containerization and environment setup. I need to implement Docker configurations and environment setup for our modular customer care platform.

The setup should include:
1. Dockerfile for the core platform
2. Docker Compose configuration for development environment
3. Environment-specific configurations (dev, staging, production)
4. PostgreSQL setup and initialization
5. Plugin deployment strategy

Specific requirements:
- Multi-stage build process for optimized images
- Proper handling of dependencies and build artifacts
- Configuration through environment variables
- Volume mounting for persistent storage
- Health checks and monitoring integration
- Security hardening (minimize attack surface)
- Documentation for local development setup

Provide comprehensive documentation on the Docker setup, including build instructions, environment variable requirements, and usage examples. Include best practices for container security and performance optimization.
```

### TASK 6.2: Monitoring & Observability Implementation

**Description:** Implement comprehensive monitoring and observability for the platform.

**Prompt:**

```
Act as a DevOps engineer with expertise in monitoring and observability. I need to implement a comprehensive monitoring solution for our modular customer care platform.

The monitoring system should cover:
1. Platform health metrics
2. Plugin performance and stability
3. LLM performance and resource usage
4. Database health and performance
5. User experience metrics

Specific requirements:
- Implement metrics collection using industry standards (Prometheus compatible)
- Create dashboards for different stakeholders (operators, developers, managers)
- Set up alerting for critical issues
- Implement distributed tracing for request flows
- Log aggregation and analysis
- Resource usage monitoring (CPU, memory, disk, network)
- AI-specific metrics (LLM inference times, token usage, etc.)

Provide configuration files, setup instructions, and dashboard templates. Include documentation on metric interpretation, alert thresholds, and troubleshooting procedures. Focus on a solution that works well in containerized environments and supports our microkernel architecture.
```

### TASK 6.3: CI/CD Pipeline Setup

**Description:** Create a CI/CD pipeline for automated testing and deployment of the platform and plugins.

**Prompt:**

```
Act as a DevOps engineer with expertise in CI/CD pipelines. I need to implement a comprehensive CI/CD pipeline for our modular customer care platform.

The pipeline should support:
1. Core platform builds and deployments
2. Plugin development and deployment
3. Test automation across all components
4. Environment-specific configurations
5. Release management with feature flags

Specific requirements:
- Implement stages for build, test, security scanning, and deployment
- Create separate pipelines for core platform and individual plugins
- Support pull request validation with automated tests
- Implement versioning strategy for both platform and plugins
- Set up feature flag integration for controlled rollouts
- Create automated rollback procedures
- Include performance testing as part of the pipeline

Provide pipeline configuration files (e.g., GitHub Actions, Jenkins), documentation on the pipeline architecture, and usage guidelines for developers. Include best practices for efficient CI/CD operations and troubleshooting procedures.
```

## [FINAL DELIVERABLE] Comprehensive Platform Documentation

**Description:** After all components are completed, create a comprehensive "Files for Dummies" guide covering the entire codebase.

**Prompt:**

```
Act as a seasoned software architect and technical writer. Create a comprehensive "Files for Dummies" compilation that covers our entire Modular AI-Enhanced Customer Care Platform codebase. This should serve as a complete reference for new developers joining the project.

The guide should:

1. Start with an Executive Summary
   - System architecture overview
   - Key technologies used
   - Core design patterns and principles

2. Core Platform Section
   - Microkernel architecture implementation
   - Plugin management system
   - Event bus and communication patterns
   - Feature flag implementation
   - Security services
   - UI framework

3. Plugin Implementations
   - AI-Powered Crash Analyzer
   - Log Visualization Plugin
   - AI-Driven Ticket Analysis Plugin
   - Intelligent Knowledge Base (RAG) Plugin

4. Integration Workflows
   - Ticket-to-Resolution Workflow
   - Proactive Customer Communication
   - AI-Powered Support Dashboard

5. Deployment & Operations
   - Containerization approach
   - Environment configurations
   - Monitoring and observability
   - CI/CD pipeline

For each component and major system:
- Highlight key files and their purposes
- Explain interconnections between components
- Show typical execution flows
- Provide clear diagrams illustrating relationships

Include a comprehensive index of all files with brief descriptions and cross-references. Organize the guide in a way that supports both:
- Quick reference lookup for specific components
- Progressive learning path for developers new to the system

Make the guide accessible to developers with varying experience levels, explaining complex concepts clearly while providing sufficient depth for experienced engineers to understand implementation details.
```
