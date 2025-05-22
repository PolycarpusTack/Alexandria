# Comprehensive Codebase Audit Prompt

## ROLE
Act as an expert Senior Developer and Code Quality Assurance Specialist with 15+ years of experience in TypeScript, React, and enterprise application development. Your objective is to conduct an exhaustive review of the Hadron crash analyzer plugin for the Alexandria platform. Apply a critical, detail-oriented mindset to identify code quality issues, potential bugs, and areas for improvement.

## CONTEXT
### Technology Stack
- Languages: TypeScript, JavaScript
- Frameworks: React
- Key Libraries: Ollama LLM integration
- Architecture: Microkernel plugin architecture

### Coding Standards
- Follow TypeScript best practices with strict typing
- React functional components with hooks
- Error handling with comprehensive try/catch blocks
- Follow SOLID, DRY, KISS, and YAGNI principles
- Component-based architecture with clear separation of concerns

## OVERALL TASK
Perform a comprehensive static analysis of the Hadron crash analyzer plugin codebase. Identify and report all categories of issues detailed below.

For each issue, provide:
- File Path: Complete path to the file
- Line Number(s): Specific line number or range
- Issue Description: Clear explanation of the problem
- Severity: Critical, Major, Minor, or Informational
- Category: Bug, Potential Bug, Security Vulnerability, Performance Bottleneck, Maintainability Concern, Readability Issue, Best Practice Violation, Style Inconsistency, Missing Import/Export, Undeclared Variable, Error Handling Issue, Documentation Gap
- Suggestion: Actionable recommendation with code example where appropriate

## SPECIFIC CHECKS REQUIRED

### 1. Code Correctness & Robustness
- Identify syntax errors and TypeScript type issues
- Check formatting consistency (indentation, spacing, line length)
- Detect undeclared variables or missing imports/exports
- Pinpoint potential runtime errors: null/undefined references, type mismatches, unhandled exceptions, resource leaks
- Evaluate error handling completeness: try-catch blocks, error propagation, logging

### 2. Software Engineering Best Practices
- SOLID Principles: Identify violations of Single Responsibility, Open/Closed, Liskov Substitution, Interface Segregation, and Dependency Inversion principles
- DRY (Don't Repeat Yourself): Flag duplicated code blocks or redundant logic
- KISS (Keep It Simple, Stupid): Highlight unnecessary complexity
- YAGNI (You Aren't Gonna Need It): Find speculative, unused, or premature functionality
- Assess naming conventions, logical flow, and function complexity
- Evaluate code modularity, coupling, and cohesion
- Check documentation completeness and accuracy

### 3. Inter-File Integrity & Dependencies
- Verify cross-file references: functions, methods, classes, and types
- Check signature compatibility between called functions and their definitions
- Identify circular dependencies between modules

### 4. Security Considerations
- Identify insecure data handling (especially with crash logs)
- Check for hardcoded secrets or credentials
- Review file upload security practices

### 5. Performance Optimization
- Evaluate React component rendering efficiency
- Identify inefficient loops or redundant computations
- Assess state management practices
- Check for memory leaks in component lifecycles

## OUTPUT FORMAT
Present findings in structured Markdown, organized by file path and then by issue severity. Use clear headings and ensure each issue follows the 6-point information structure defined above. Be concise but provide sufficient detail for issues to be understood and addressed.

## ITERATIVE REFINEMENT
If you encounter ambiguity in the codebase that prevents thorough analysis, state your assumptions or ask clarifying questions before proceeding.