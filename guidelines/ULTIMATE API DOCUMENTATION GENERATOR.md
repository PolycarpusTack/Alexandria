# ULTIMATE API DOCUMENTATION GENERATOR

This framework creates comprehensive, consistent API documentation including specifications, examples, tutorials, and best practices. The resulting documentation will help developers quickly understand, integrate with, and troubleshoot your API.

## HOW TO USE THIS PROMPT
Replace [API_NAME] with your API's name (e.g., "Payment Processing API", "Weather Data API").
Replace [API_VERSION] with the current version (e.g., "v1", "2023-04-01").
Replace [AUTHENTICATION_TYPE] with your authentication method (e.g., "OAuth 2.0", "API Keys", "JWT").
Provide as much information as possible about your API's structure and capabilities.

## SEQUENCE OF PROMPTS FOR API DOCUMENTATION GENERATION:

Prompt 1: API Overview & Specification
Create a comprehensive API overview and OpenAPI/Swagger specification for [API_NAME] version [API_VERSION].

Assume the persona of an experienced API architect and technical documentation specialist.

Your task for this first step is to generate:

1. **API Overview**: Create a clear introduction including:
   - Purpose and core functionality
   - Target use cases and audiences
   - Key features and capabilities
   - Technical architecture overview
   - Base URL structure and environments (dev/staging/prod)

2. **Authentication & Authorization**: Detail the [AUTHENTICATION_TYPE] implementation:
   - Complete authentication flow
   - Required credentials and how to obtain them
   - Token lifecycle and refresh mechanisms
   - Scopes and permission levels
   - Example authentication requests

3. **Core Resources & Data Models**: Define the primary resources:
   - Resource hierarchy and relationships
   - Object schemas with property descriptions
   - Required vs. optional fields
   - Data types and formats
   - Example objects in JSON format

4. **API Endpoints Structure**: Organize endpoints into logical groups:
   - Resource-based categorization
   - CRUD operations mapping
   - Specialized actions and operations
   - Versioning strategy
   - Deprecated endpoints (if any)

5. **OpenAPI Specification Structure**: Generate the skeleton for the OpenAPI/Swagger spec:
   - Info block (title, description, version)
   - Servers configuration
   - Authentication schemas
   - Tag organization
   - Initial path structure
   - Common component schemas

Output: A comprehensive API overview document and skeleton OpenAPI/Swagger specification with the above components.

Prompt 2: Endpoint Documentation & Parameter Specifications
Building on the API overview and specification framework for [API_NAME], create detailed endpoint documentation and parameter specifications.

Maintain the persona of an API architect and technical documentation specialist.

Your tasks for this step are:

1. **Endpoint Documentation Template**: For each endpoint, create detailed specifications including:
   - HTTP method and full URL path
   - Endpoint description and purpose
   - Required permissions and scopes
   - Request parameters (path, query, header)
   - Request body schema (if applicable)
   - Response status codes and descriptions
   - Response body schema
   - Rate limiting considerations
   - Special behavior notes

2. **Core Endpoints Documentation**: Apply the template to document these essential endpoints:
   - Authentication endpoint(s)
   - Resource creation endpoints
   - Resource retrieval endpoints
   - Resource update endpoints
   - Resource deletion endpoints
   - List/search endpoints

3. **Query Parameters Framework**: Detail standard query parameter patterns:
   - Filtering parameters and syntax
   - Sorting options
   - Pagination mechanisms
   - Field selection/projection
   - Search functionality
   - Format options

4. **Status Codes & Error Responses**: Define the error handling framework:
   - Success response formats
   - Common error codes and meanings
   - Error response structure
   - Validation error details format
   - Rate limit responses
   - Authentication failure responses

5. **Headers & Request Requirements**: Document standard headers:
   - Required authentication headers
   - Content-Type requirements
   - Accept header options
   - Idempotency keys
   - Caching headers
   - Correlation IDs

Output: Detailed endpoint documentation for all core API endpoints, including parameter specifications, request/response examples, and error handling information.

Prompt 3: API Examples & SDK Implementations
Based on the endpoint documentation for [API_NAME], create comprehensive API examples and SDK implementation guides.

Maintain the persona of an API architect and technical documentation specialist.

Your tasks for this step are:

1. **Shell Examples (cURL)**: Create executable examples for each endpoint:
   - Authentication requests
   - Resource CRUD operations
   - Query parameter variations
   - Error case examples
   - Complete request and response pairs
   - Environment variable usage for secrets

2. **Language-Specific SDK Examples**: Develop code samples in these languages:
   - Python (using requests or similar)
   - JavaScript/TypeScript (using fetch/axios)
   - Java (using appropriate HTTP client)
   - C# (using appropriate HTTP client)
   - Ruby (using appropriate HTTP client)

3. **Authentication Flow Examples**: Provide complete implementation examples for:
   - Initial authentication
   - Token storage
   - Token refresh
   - Handling expired tokens
   - Logout/invalidation

4. **Pagination Implementation**: Detail pagination handling:
   - Cursor-based pagination code
   - Offset/limit pagination code
   - Handling empty results
   - Collection processing
   - Efficiency considerations

5. **Error Handling Patterns**: Demonstrate robust error handling:
   - Try/catch patterns for different languages
   - Error classification and specific handling
   - Retry strategies with backoff
   - Logging best practices
   - User-friendly error presentation

Output: Comprehensive code examples for all core API endpoints in multiple languages, including authentication, pagination, and error handling implementations.

Prompt 4: Integration Tutorials & Use Cases
Building on the API examples for [API_NAME], develop step-by-step integration tutorials and common use case implementations.

Maintain the persona of an API architect and technical documentation specialist.

Your tasks for this step are:

1. **"Hello World" Integration**: Create a complete beginner's tutorial:
   - Environment setup requirements
   - Authentication configuration
   - Making your first API call
   - Validating successful integration
   - Troubleshooting common issues

2. **Common Use Case Tutorials**: Develop tutorials for key workflows:
   - Standard CRUD workflow
   - Search and filtering implementation
   - Bulk operations handling
   - Webhook integration (if applicable)
   - Reporting and analytics scenarios

3. **Advanced Integration Patterns**: Document sophisticated integration approaches:
   - Optimizing for performance
   - Implementing caching strategies
   - Handling high volume operations
   - Batch processing techniques
   - Synchronization patterns

4. **Mobile Integration Guidance**: Provide mobile-specific considerations:
   - iOS implementation patterns
   - Android implementation patterns
   - Offline capability strategies
   - Background processing considerations
   - Battery and bandwidth optimization

5. **Frontend Integration Examples**: Demonstrate UI integration:
   - React/Vue/Angular patterns
   - Form handling with validation
   - Response data rendering
   - Error state handling
   - Loading state management

Output: Complete integration tutorials including the "Hello World" guide, common use case implementations, advanced patterns, and platform-specific guidance.

Prompt 5: Best Practices & Troubleshooting Guide
Based on the complete documentation for [API_NAME], create a comprehensive best practices and troubleshooting guide.

Maintain the persona of an API architect and technical documentation specialist.

Your tasks for this step are:

1. **API Usage Best Practices**: Document recommended approaches:
   - Request optimization techniques
   - Batch operations vs. individual calls
   - Caching strategies and implementations
   - Polling vs. webhooks considerations
   - Data consistency handling
   - Resource cleanup recommendations

2. **Security Best Practices**: Provide security guidance:
   - Credential management
   - Secure storage of tokens
   - HTTPS and TLS requirements
   - Input validation recommendations
   - Content Security Policy considerations
   - Sensitive data handling

3. **Rate Limiting & Quotas Management**: Detail strategies for:
   - Understanding rate limit structure
   - Implementing concurrent request limiting
   - Handling rate limit errors
   - Quota monitoring and alerting
   - Request prioritization approaches
   - Rate limit avoidance strategies

4. **Common Error Scenarios & Solutions**: Create a troubleshooting guide:
   - Authentication failures
   - Validation errors
   - Timeout handling
   - Server error responses
   - Network connectivity issues
   - Data consistency problems

5. **Performance Optimization**: Provide performance tuning guidance:
   - Connection pooling
   - Keep-alive configuration
   - Compression usage
   - Asynchronous processing patterns
   - Optimizing large data transfers
   - Monitoring and profiling techniques

Output: Comprehensive best practices and troubleshooting guide including usage recommendations, security guidance, rate limit management, error resolution, and performance optimization.

Prompt 6: Developer Resources & Reference Materials
Complete the [API_NAME] documentation by creating developer resources and reference materials.

Maintain the persona of an API architect and technical documentation specialist.

Your tasks for this step are:

1. **API Reference Quick Guide**: Create a condensed reference including:
   - Endpoint summary table
   - Authentication quick reference
   - Common parameters table
   - Status codes cheat sheet
   - Request/response format summary
   - Standard headers listing

2. **SDK & Library References**: Document available official SDKs:
   - Installation instructions
   - Configuration options
   - Core functionality overview
   - Object model documentation
   - Versioning and compatibility notes
   - Extension points

3. **Developer Tools & Resources**: Create a guide to supplementary tools:
   - API testing tools (Postman, Insomnia, etc.)
   - API exploration tools
   - Debugging techniques and tools
   - Monitoring and logging solutions
   - Integration validation tools
   - Community resources and forums

4. **Glossary & Terminology**: Develop a comprehensive glossary:
   - API-specific terms
   - Technical terminology
   - Domain-specific concepts
   - Abbreviations and acronyms
   - Cross-references to documentation

5. **Migration & Versioning Guide**: Create a versioning reference:
   - Version compatibility matrix
   - Breaking vs. non-breaking changes
   - Migration guides between versions
   - Deprecation policies and timelines
   - Version sunset schedule
   - Legacy support information

Output: Complete developer resources including quick reference guides, SDK documentation, tools overview, terminology glossary, and versioning information.

Prompt 7: Documentation Presentation & Access Strategy
With the complete [API_NAME] documentation created, develop a presentation and access strategy.

Maintain the persona of an API architect and technical documentation specialist.

Your tasks for this step are:

1. **Documentation Portal Structure**: Design the optimal structure:
   - Information architecture
   - Navigation hierarchy
   - Search functionality requirements
   - Interactive vs. static content
   - Code snippet presentation
   - API console integration

2. **Documentation Formats**: Specify format requirements:
   - HTML structure and components
   - Markdown formatting
   - PDF generation requirements
   - Mobile responsiveness considerations
   - Accessibility requirements
   - Print optimization

3. **Interactive Elements Specification**: Define interactive components:
   - Interactive API console requirements
   - Code sample selectors
   - Language switching functionality
   - Theme/dark mode support
   - Clipboard copy functionality
   - Request builder features

4. **Documentation Maintenance Plan**: Create a sustainability strategy:
   - Version control approach
   - Update process and frequency
   - Contribution guidelines
   - Feedback collection mechanism
   - Quality assurance process
   - Release notes generation

5. **Discovery & Onboarding Flow**: Design the developer journey:
   - First-time visitor experience
   - Getting started guide placement
   - Progressive disclosure approach
   - Learning path recommendations
   - Account creation integration
   - Support request options

Output: Comprehensive documentation presentation strategy including portal structure, format specifications, interactive elements, maintenance plan, and developer onboarding flow.

How to Use This Sequence:
* Start with Prompt 1. Replace [API_NAME], [API_VERSION], and [AUTHENTICATION_TYPE] with your specifics. Run it and save the output.
* Use the output from Prompt 1 as context for Prompt 2. Run it and save the output.
* Continue through the sequence, using previous outputs as context for each subsequent prompt.
* Each prompt builds on the previous ones, creating a complete API documentation suite with increasing detail.
* After completing the sequence, you will have comprehensive API documentation ready for implementation in your documentation system.
* For complex APIs, you may need to repeat certain prompts multiple times (e.g., Prompt 2 for different endpoint groups).