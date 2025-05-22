# ALEXANDRIA ARCHITECTURE REVIEW PROMPT

## OBJECTIVE
Conduct a comprehensive review of the Hadron Crash Analyzer plugin for conformance to Alexandria's architectural principles, implementation standards, and development guidelines.

## TARGET SCOPE
[x] Individual Plugin: Hadron Crash Analyzer
[ ] Full Codebase Review
[ ] Core System Component
[ ] Event Bus Implementation
[ ] Plugin Registry
[ ] UI Component Structure

## 1. MICROKERNEL ARCHITECTURE ASSESSMENT

### Core System Isolation
- Does the code maintain strict separation between core system and plugin functionality?
- Are core services properly abstracted behind well-defined interfaces?
- Is the plugin registry implementation allowing proper discovery and management?
- Are there any instances where plugins directly access core system internals bypassing APIs?

### Plugin Interface Compliance
- Do plugins interact with the core system only through defined extension points?
- Does the plugin implement all required interface methods?
- Is plugin configuration handled through the proper configuration service?
- Does the code avoid tight coupling between plugins?

### Service Layer Analysis
- Are core services properly registered and discoverable?
- Is service initialization properly sequenced?
- Are services appropriately scoped (singleton vs. transient)?
- Do services follow the dependency injection pattern correctly?

## 2. EVENT-DRIVEN COMMUNICATION EVALUATION

### Event Bus Implementation
- Does the component use the event bus for all cross-component communication?
- Are events properly typed with explicit interfaces?
- Are event subscriptions properly managed (registered/unregistered during lifecycle)?
- Does the code avoid direct method calls between unrelated components?

### Event Design Patterns
- Are events named consistently following the established convention?
- Do events carry appropriate payload data?
- Is event handling performed asynchronously where appropriate?
- Are there any circular event dependencies?

### Error Handling in Event Flow
- Are exceptions in event handlers properly contained?
- Is there a proper error recovery mechanism for failed event processing?
- Are failed events logged with appropriate context?
- Is there a circuit breaker pattern implemented for recurring failures?

## 3. PLUGIN LIFECYCLE HOOKS ASSESSMENT

### Installation Phase
- Does the plugin properly implement the `install()` hook?
- Are database schemas, configuration defaults, and required resources established?
- Does the installation gracefully handle already-installed states?
- Is there proper validation of dependencies and prerequisites?

### Activation Sequence
- Does the plugin properly implement the `activate()` hook?
- Are event listeners registered during activation?
- Are required services acquired during activation?
- Is state initialization properly handled?

### Deactivation Cleanup
- Does the plugin properly implement the `deactivate()` hook?
- Are event listeners unregistered during deactivation?
- Are resources properly released and connections closed?
- Is state properly preserved for possible reactivation?

### Uninstallation Process
- Does the plugin properly implement the `uninstall()` hook?
- Is cleanup comprehensive (configuration, stored data, user preferences)?
- Is uninstallation properly guarded against side effects?
- Are dependencies checked before removal?

## 4. TYPESCRIPT TYPE SAFETY ANALYSIS

### Type Declaration Completeness
- Are interfaces defined for all public APIs and data structures?
- Are function parameters and return types explicitly typed?
- Is there any use of `any` that could be replaced with proper types?
- Are generics used appropriately where needed?

### Interface-First Implementation
- Are interfaces defined before implementations?
- Do interfaces properly describe the contract without implementation details?
- Are interfaces properly segregated (ISP principle)?
- Are common interfaces reused appropriately?

### Type Guards and Narrowing
- Are type guards used when narrowing from `unknown` types?
- Is runtime type validation implemented for external inputs?
- Are discriminated unions used appropriately?
- Are type assertions (`as`) minimized and used safely?

### Enums and Constants
- Are string literals wrapped in enums or const objects?
- Are numeric values properly enumerated?
- Is there consistent usage of defined enums across the codebase?
- Are enum values properly typed in function parameters?

## 5. ERROR HANDLING CONFORMANCE

### Input Validation
- Are all function inputs validated at the start of each function?
- Is validation comprehensive covering type, range, and semantic constraints?
- Are validation errors properly propagated with context?
- Is input sanitization applied for security-sensitive inputs?

### Exception Management
- Are try/catch blocks used for all operations that might fail?
- Are specific error types caught rather than broad `Error` instances?
- Is error context preserved when re-throwing?
- Are custom error types defined and used appropriately?

### Resource Management
- Are resources properly acquired and released using try/finally patterns?
- Is the resource cleanup code comprehensive?
- Are there any potential resource leaks under error conditions?
- Is proper cleanup sequencing maintained?

### Error Reporting and Logging
- Are errors logged with appropriate severity levels?
- Do error logs contain sufficient context for debugging?
- Is user feedback provided appropriately for errors?
- Are errors categorized correctly (system, user, external)?

## 6. CRASH ANALYZER SPECIFIC ASSESSMENT

### LLM Integration
- Is the Ollama LLM integration properly implemented and error-resistant?
- Are there appropriate fallbacks if the LLM service is unavailable?
- Is the communication with the LLM service secure?
- Are prompts well-structured and optimized for accurate crash analysis?

### File Handling
- Are crash log and code snippet uploads handled securely?
- Is proper validation implemented for uploaded files?
- Are there appropriate size limits and format restrictions?
- Is storage of uploaded files and analysis results properly managed?

### Analysis Quality
- Is the crash analysis implementation comprehensive and accurate?
- Are various types of crash logs properly supported?
- Does the code correctly extract meaningful information from logs?
- Is the presentation of analysis results clear and actionable?

## 7. UI COMPONENT ASSESSMENT

### Component Architecture
- Do UI components follow a clear hierarchical structure?
- Are components properly decoupled and reusable?
- Is state management implemented correctly?
- Are UI components well-documented?

### Accessibility
- Do components meet WCAG accessibility standards?
- Are appropriate ARIA attributes used?
- Is keyboard navigation properly supported?
- Is the UI usable with screen readers?

### User Experience
- Is the UI intuitive and user-friendly?
- Are loading states and error messages properly displayed?
- Is feedback provided for long-running operations?
- Is the UI responsive across different device sizes?

## EVALUATION MATRIX

For each section, provide a rating:
- ✅ COMPLIANT: Fully meets Alexandria standards
- 🟨 PARTIAL: Meets most requirements with minor issues
- 🔴 NON-COMPLIANT: Significant deviations from standards

| Assessment Area                  | Rating | Critical Issues               | Recommendations                |
|---------------------------------|--------|-------------------------------|-------------------------------|
| Microkernel Architecture        |        |                               |                               |
| Event-Driven Communication      |        |                               |                               |
| Plugin Lifecycle Hooks          |        |                               |                               |
| TypeScript Type Safety          |        |                               |                               |
| Error Handling                  |        |                               |                               |
| LLM Integration                 |        |                               |                               |
| File Handling                   |        |                               |                               |
| UI Components                   |        |                               |                               |

## ACTION ITEMS

List specific required changes in order of priority:

1. [CRITICAL] 
2. [HIGH]
3. [MEDIUM]
4. [LOW]

## COMPLIANCE SUMMARY

Provide an overall assessment of the Hadron Crash Analyzer plugin's compliance with Alexandria architecture principles and suggest next steps for improvement.

---

Remember: When in doubt about any aspect of the implementation, ask for clarification rather than making assumptions.