# Alexandria Platform Manual Test Plan

This document outlines manual test scenarios for the Alexandria platform to ensure functionality, usability, and integration testing of components that may be difficult to test automatically.

## Prerequisites

Before beginning manual testing, ensure you have the following set up:

1. Alexandria platform running locally (`npm run dev`)
2. Ollama installed and running with required models (`llama2:8b-chat-q4`)
3. A sample crash log file for testing
4. Admin access to the platform (for testing advanced features)

## Core Platform Testing

### Authentication and User Management

| ID | Test Scenario | Steps | Expected Outcome | Status |
|---|---|---|---|---|
| AUTH-1 | Login with valid credentials | 1. Navigate to login page<br>2. Enter valid username/password<br>3. Click "Login" | User is logged in and redirected to dashboard | |
| AUTH-2 | Login with invalid credentials | 1. Navigate to login page<br>2. Enter invalid username/password<br>3. Click "Login" | Error message is displayed, user remains on login page | |
| AUTH-3 | User logout | 1. Click on user avatar<br>2. Select "Logout" | User is logged out and redirected to login page | |

### Navigation and UI

| ID | Test Scenario | Steps | Expected Outcome | Status |
|---|---|---|---|---|
| NAV-1 | Main navigation functionality | 1. Login to platform<br>2. Click on each main navigation item | Correct view is displayed for each navigation item | |
| NAV-2 | Sidebar collapse/expand | 1. Click on sidebar collapse button<br>2. Click again to expand | Sidebar collapses and expands correctly | |
| NAV-3 | Responsive layout | 1. Test on desktop (>1200px)<br>2. Test on tablet (768-1200px)<br>3. Test on mobile (<768px) | UI adapts correctly to different screen sizes | |
| NAV-4 | Command palette | 1. Press Ctrl+K (or Cmd+K)<br>2. Type a command<br>3. Select a result | Command palette opens and executes selected command | |

### Event Bus and Core Services

| ID | Test Scenario | Steps | Expected Outcome | Status |
|---|---|---|---|---|
| CORE-1 | Event publication | 1. Trigger action that publishes event (e.g., plugin activation)<br>2. Check logs or notification indicator | Event is published and subscribers are notified | |
| CORE-2 | Feature flag testing | 1. Enable a feature flag<br>2. Test the associated feature<br>3. Disable the feature flag<br>4. Test again | Feature is enabled/disabled based on flag state | |

## Crash Analyzer Plugin Testing

### Upload and Analysis

| ID | Test Scenario | Steps | Expected Outcome | Status |
|---|---|---|---|---|
| CA-1 | Upload crash log | 1. Navigate to Crash Analyzer<br>2. Click "Upload" button<br>3. Select a crash log file<br>4. Click "Upload" | File uploads successfully and appears in the log list | |
| CA-2 | Analyze crash log | 1. Upload a crash log<br>2. Wait for analysis to complete | Analysis completes and shows results with root causes | |
| CA-3 | View crash details | 1. Upload and analyze a crash log<br>2. Click on the log in the list | Detailed view shows stack trace, system info, and analysis | |

### Log Parsing

| ID | Test Scenario | Steps | Expected Outcome | Status |
|---|---|---|---|---|
| CA-4 | Error message extraction | 1. Upload a log with clear error messages<br>2. View the extracted errors section | Error messages are correctly identified and displayed | |
| CA-5 | Stack trace parsing | 1. Upload a log with stack traces<br>2. View the stack trace section | Stack frames are properly parsed and displayed hierarchically | |
| CA-6 | System info extraction | 1. Upload a log with system information<br>2. View the system info section | System details are correctly extracted and categorized | |

### LLM Integration

| ID | Test Scenario | Steps | Expected Outcome | Status |
|---|---|---|---|---|
| CA-7 | LLM model selection | 1. Configure a different Ollama model<br>2. Analyze a crash log | Selected model is used for analysis | |
| CA-8 | Analysis quality | 1. Upload a log with known issues<br>2. Examine the root cause analysis | Analysis correctly identifies major problems and provides useful recommendations | |
| CA-9 | Error handling | 1. Disable Ollama service<br>2. Try to analyze a crash log | Graceful error handling with appropriate message | |

### Dashboard and Visualization

| ID | Test Scenario | Steps | Expected Outcome | Status |
|---|---|---|---|---|
| CA-10 | Dashboard metrics | 1. Upload several crash logs<br>2. Navigate to dashboard view | Dashboard shows correct count of crashes by category | |
| CA-11 | Timeline view | 1. Upload logs with different timestamps<br>2. View timeline component | Timeline accurately displays crashes in chronological order | |
| CA-12 | Filtering | 1. Upload logs with different error types<br>2. Apply various filters | Filtered results match expected criteria | |

## Performance Testing

| ID | Test Scenario | Steps | Expected Outcome | Status |
|---|---|---|---|---|
| PERF-1 | Large log processing | 1. Upload a very large log file (>5MB)<br>2. Monitor processing | Log is processed without UI freezing, with appropriate progress indicator | |
| PERF-2 | Multiple concurrent uploads | 1. Upload 5+ logs simultaneously<br>2. Monitor system behavior | All logs are processed correctly without errors | |
| PERF-3 | LLM response time | 1. Time how long analysis takes<br>2. Verify the timer shown in UI | Response time is reasonable (<30s) and accurately displayed | |

## Integration Testing

| ID | Test Scenario | Steps | Expected Outcome | Status |
|---|---|---|---|---|
| INT-1 | Plugin activation/deactivation | 1. Deactivate Crash Analyzer plugin<br>2. Verify it's not accessible<br>3. Reactivate it | Plugin UI elements appear/disappear appropriately | |
| INT-2 | Data persistence | 1. Upload and analyze logs<br>2. Restart the application<br>3. Navigate to Crash Analyzer | Previously uploaded logs and analyses are still available | |
| INT-3 | Feature flag impact | 1. Toggle feature flags related to Crash Analyzer<br>2. Test affected features | Features behave according to flag settings | |

## Accessibility Testing

| ID | Test Scenario | Steps | Expected Outcome | Status |
|---|---|---|---|---|
| ACC-1 | Keyboard navigation | 1. Navigate the entire application using only keyboard<br>2. Test all interactive elements | All functionality is accessible via keyboard | |
| ACC-2 | Screen reader compatibility | 1. Enable a screen reader<br>2. Navigate through the application | Content is properly announced by screen reader | |
| ACC-3 | Color contrast | 1. Inspect UI elements for contrast issues<br>2. Test with contrast analyzer tool | All text meets WCAG AA contrast requirements | |

## Security Testing

| ID | Test Scenario | Steps | Expected Outcome | Status |
|---|---|---|---|---|
| SEC-1 | Authentication required | 1. Attempt to access protected routes without authentication<br>2. Check response | User is redirected to login page | |
| SEC-2 | Authorization checks | 1. Login as a user with limited permissions<br>2. Attempt to access admin-only features | Access is denied with appropriate message | |
| SEC-3 | Upload validation | 1. Attempt to upload malicious files (e.g., .exe files)<br>2. Monitor system response | Upload is rejected with security warning | |

## Edge Cases and Error Handling

| ID | Test Scenario | Steps | Expected Outcome | Status |
|---|---|---|---|---|
| ERR-1 | Network disconnection | 1. Start a log analysis<br>2. Disconnect from network<br>3. Reconnect after a few seconds | Appropriate error message shown, system recovers when connection restored | |
| ERR-2 | Invalid log format | 1. Upload a file that is not a valid log<br>2. Monitor response | System shows helpful error message about invalid format | |
| ERR-3 | Extremely large analysis | 1. Upload a log that would generate very large analysis<br>2. Monitor system behavior | System handles large response without crashing | |

## Cross-browser Testing

| ID | Test Scenario | Browser | Expected Outcome | Status |
|---|---|---|---|---|
| BROWSER-1 | Core functionality | Chrome | All features work correctly | |
| BROWSER-2 | Core functionality | Firefox | All features work correctly | |
| BROWSER-3 | Core functionality | Safari | All features work correctly | |
| BROWSER-4 | Core functionality | Edge | All features work correctly | |

## Test Environment Setup Instructions

### Setting Up Ollama

1. Install Ollama from [https://ollama.ai/download](https://ollama.ai/download)
2. Pull the required model:
   ```
   ollama pull llama2:8b-chat-q4
   ```
3. Verify Ollama is running:
   ```
   curl http://localhost:11434/api/tags
   ```

### Sample Test Data

For testing, use the following sample crash logs:

1. `sample_java_crash.log` - Java application crash with stack trace
2. `sample_js_crash.log` - JavaScript application error log
3. `sample_system_crash.log` - Operating system crash dump

These files can be found in the `/docs/test-data/` directory.

### Test Reporting

When executing manual tests:

1. Update the "Status" column with:
   - PASS: Test passed as expected
   - FAIL: Test failed (include brief reason)
   - PARTIAL: Test partially passed (include brief reason)
   - BLOCKED: Test could not be executed (include brief reason)

2. For failed tests, create an issue in the issue tracker with:
   - Test ID and name
   - Steps to reproduce
   - Expected vs. actual outcome
   - Screenshots if applicable
   - System environment details

## Regression Testing

Before each release, perform regression testing focusing on:

1. All features that were modified in the release
2. Core functionality (authentication, navigation, plugin infrastructure)
3. Any features that had bugs fixed in previous releases

## Conclusion

This test plan provides a structured approach to manually testing the Alexandria platform. It should be updated as new features are added or existing features are modified.