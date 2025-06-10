# Hadron Plugin API Reference

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Base URLs](#base-urls)
4. [Error Handling](#error-handling)
5. [Crash Analyzer API](#crash-analyzer-api)
6. [Analytics API](#analytics-api)
7. [File Upload API](#file-upload-api)
8. [Alerts API](#alerts-api)
9. [Security API](#security-api)
10. [WebSocket Events](#websocket-events)
11. [SDK and Libraries](#sdk-and-libraries)
12. [Rate Limiting](#rate-limiting)
13. [Examples](#examples)

## Overview

The Hadron Plugin API provides programmatic access to crash log analysis, analytics, file management, and monitoring capabilities. All APIs follow RESTful principles and use JSON for data exchange.

### API Version
- **Current Version**: v1
- **Base Path**: `/api/hadron`
- **Content Type**: `application/json`
- **Authentication**: Bearer token or session-based

### Supported Features
- Crash log upload and analysis
- Real-time analytics and monitoring
- Alert configuration and management
- File security and validation
- WebSocket real-time updates

## Authentication

### Bearer Token Authentication
```http
Authorization: Bearer <your-token>
Content-Type: application/json
```

### Session-based Authentication
```http
Cookie: session=<session-id>
Content-Type: application/json
```

### API Key Authentication
```http
X-API-Key: <your-api-key>
Content-Type: application/json
```

## Base URLs

### Production
```
https://your-alexandria-instance.com/api/hadron
```

### Development
```
http://localhost:4000/api/hadron
```

### API Endpoints Structure
```
/api/hadron/
├── crash-analyzer/          # Crash analysis operations
├── analytics/              # Analytics and reporting
├── files/                  # File upload and management
├── alerts/                 # Alert configuration
├── security/               # Security scanning
└── health/                 # Health and status checks
```

## Error Handling

### Standard Error Response
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "File format not supported",
    "details": {
      "field": "file",
      "supported_formats": [".log", ".txt", ".crash", ".stacktrace"]
    },
    "timestamp": "2024-01-15T10:30:00Z",
    "requestId": "req_123456789"
  }
}
```

### HTTP Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict
- `413` - Payload Too Large
- `422` - Unprocessable Entity
- `429` - Too Many Requests
- `500` - Internal Server Error
- `503` - Service Unavailable

### Error Codes
- `INVALID_REQUEST` - Malformed request
- `VALIDATION_ERROR` - Input validation failed
- `FILE_TOO_LARGE` - File exceeds size limit
- `UNSUPPORTED_FORMAT` - File format not supported
- `AI_SERVICE_UNAVAILABLE` - AI analysis service down
- `ANALYSIS_FAILED` - Analysis processing failed
- `QUOTA_EXCEEDED` - Usage quota exceeded
- `RATE_LIMIT_EXCEEDED` - Request rate limit exceeded

## Crash Analyzer API

### Upload Crash Log

Upload a crash log for AI-powered analysis.

```http
POST /api/hadron/crash-analyzer/logs
```

#### Request Body (multipart/form-data)
```
file: <crash-log-file>
metadata: {
  "platform": "iOS",
  "appVersion": "1.2.3",
  "device": "iPhone 14 Pro",
  "description": "App crashes on login"
}
options: {
  "model": "medium",
  "priority": "high",
  "autoAnalyze": true
}
```

#### Response
```json
{
  "success": true,
  "data": {
    "logId": "log_abc123",
    "uploadId": "upload_xyz789",
    "status": "uploaded",
    "filename": "crash.log",
    "size": 15420,
    "metadata": {
      "platform": "iOS",
      "appVersion": "1.2.3",
      "device": "iPhone 14 Pro",
      "description": "App crashes on login"
    },
    "uploadedAt": "2024-01-15T10:30:00Z",
    "analysisQueued": true,
    "estimatedAnalysisTime": "2-3 minutes"
  }
}
```

### Get Analysis Result

Retrieve the analysis result for a crash log.

```http
GET /api/hadron/crash-analyzer/logs/{logId}/analysis
```

#### Response
```json
{
  "success": true,
  "data": {
    "analysisId": "analysis_def456",
    "logId": "log_abc123",
    "status": "completed",
    "createdAt": "2024-01-15T10:32:00Z",
    "completedAt": "2024-01-15T10:34:30Z",
    "model": "llama2:8b-chat-q4",
    "confidence": 0.85,
    "inferenceTime": 2500,
    "result": {
      "primaryError": "EXC_BAD_ACCESS (SIGSEGV)",
      "failingComponent": "LoginViewController",
      "summary": "Memory access violation in user authentication flow",
      "potentialRootCauses": [
        {
          "cause": "Null pointer dereference in user data handling",
          "confidence": 0.92,
          "explanation": "The crash occurs when accessing user.profile without null checking",
          "category": "Memory Management",
          "supportingEvidence": [
            {
              "description": "Stack trace shows null access",
              "location": "LoginViewController.swift:142",
              "snippet": "let profile = user.profile.displayName"
            }
          ]
        }
      ],
      "troubleshootingSteps": [
        "Add null checking before accessing user.profile",
        "Implement proper error handling for authentication failures",
        "Add unit tests for edge cases in login flow"
      ]
    }
  }
}
```

### List Crash Logs

Get a paginated list of crash logs with optional filtering.

```http
GET /api/hadron/crash-analyzer/logs?page=1&limit=20&status=analyzed&platform=iOS
```

#### Query Parameters
- `page` (integer): Page number (default: 1)
- `limit` (integer): Items per page (default: 20, max: 100)
- `status` (string): Filter by status (`uploaded`, `analyzing`, `analyzed`, `failed`)
- `platform` (string): Filter by platform
- `fromDate` (string): ISO date string for date range filtering
- `toDate` (string): ISO date string for date range filtering
- `search` (string): Search in title and description

#### Response
```json
{
  "success": true,
  "data": {
    "logs": [
      {
        "logId": "log_abc123",
        "title": "App Crash - Login Flow",
        "status": "analyzed",
        "platform": "iOS",
        "uploadedAt": "2024-01-15T10:30:00Z",
        "analyzedAt": "2024-01-15T10:34:30Z",
        "confidence": 0.85,
        "hasAnalysis": true
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 156,
      "totalPages": 8,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

### Delete Crash Log

Delete a crash log and its associated analysis.

```http
DELETE /api/hadron/crash-analyzer/logs/{logId}
```

#### Response
```json
{
  "success": true,
  "message": "Crash log deleted successfully"
}
```

### Analyze Code Snippet

Analyze a code snippet for potential issues.

```http
POST /api/hadron/crash-analyzer/code-analysis
```

#### Request Body
```json
{
  "code": "function login(user) {\n  return user.profile.displayName;\n}",
  "language": "javascript",
  "options": {
    "model": "medium",
    "analysisType": "security"
  }
}
```

#### Response
```json
{
  "success": true,
  "data": {
    "analysisId": "code_analysis_789",
    "primaryIssue": "Potential null pointer exception",
    "overallScore": 65,
    "potentialIssues": [
      {
        "issue": "Missing null check for user parameter",
        "confidence": 90,
        "explanation": "Function doesn't validate if user parameter is null or undefined",
        "codeReferences": [
          {
            "description": "Unsafe property access",
            "location": "line 2",
            "codeSnippet": "user.profile.displayName"
          }
        ]
      }
    ],
    "improvementSuggestions": [
      "Add parameter validation",
      "Use optional chaining (?.) for safer property access",
      "Add error handling for undefined cases"
    ],
    "summary": "Code needs null safety improvements to prevent runtime errors"
  }
}
```

## Analytics API

### Get Analytics Overview

Retrieve high-level analytics and metrics.

```http
GET /api/hadron/analytics/overview?timeRange=7d&platform=all
```

#### Query Parameters
- `timeRange` (string): Time range (`1h`, `24h`, `7d`, `30d`, `90d`)
- `platform` (string): Platform filter (`all`, `iOS`, `Android`, `Web`)
- `granularity` (string): Data granularity (`hour`, `day`, `week`)

#### Response
```json
{
  "success": true,
  "data": {
    "timeRange": {
      "start": "2024-01-08T10:30:00Z",
      "end": "2024-01-15T10:30:00Z",
      "granularity": "day"
    },
    "metrics": {
      "totalCrashes": 245,
      "analyzedCrashes": 232,
      "avgAnalysisTime": 180000,
      "topRootCause": "Memory Management",
      "criticalIssues": 12
    },
    "trends": {
      "crashFrequency": {
        "change": -15.5,
        "direction": "down",
        "isGood": true
      },
      "analysisAccuracy": {
        "change": 8.2,
        "direction": "up",
        "isGood": true
      }
    },
    "timeSeries": [
      {
        "timestamp": "2024-01-08T00:00:00Z",
        "crashes": 35,
        "analyzed": 33,
        "avgConfidence": 0.82
      }
    ]
  }
}
```

### Get Root Cause Distribution

Get distribution of crash root causes.

```http
GET /api/hadron/analytics/root-causes?timeRange=30d
```

#### Response
```json
{
  "success": true,
  "data": {
    "categories": [
      {
        "category": "Memory Management",
        "count": 89,
        "percentage": 36.3,
        "avgConfidence": 0.84,
        "trend": "stable"
      },
      {
        "category": "Threading",
        "count": 52,
        "percentage": 21.2,
        "avgConfidence": 0.79,
        "trend": "increasing"
      }
    ],
    "insights": [
      {
        "title": "Memory management issues increasing",
        "description": "25% increase in memory-related crashes over the past week",
        "recommendation": "Consider implementing memory profiling in development builds"
      }
    ]
  }
}
```

### Get Model Performance

Retrieve AI model performance metrics.

```http
GET /api/hadron/analytics/model-performance?timeRange=30d
```

#### Response
```json
{
  "success": true,
  "data": {
    "models": [
      {
        "modelId": "llama2:8b-chat-q4",
        "totalAnalyses": 156,
        "avgConfidence": 0.82,
        "avgInferenceTime": 2450,
        "successRate": 0.94,
        "tier": "medium"
      }
    ],
    "overall": {
      "totalAnalyses": 312,
      "avgConfidence": 0.81,
      "avgInferenceTime": 2100,
      "successRate": 0.96
    }
  }
}
```

## File Upload API

### Upload File

Upload a file for analysis or storage.

```http
POST /api/hadron/files/upload
```

#### Request (multipart/form-data)
```
file: <file-data>
metadata: {
  "type": "crash_log",
  "sessionId": "session_123",
  "description": "Main thread crash"
}
```

#### Response
```json
{
  "success": true,
  "data": {
    "fileId": "file_abc123",
    "filename": "crash.log",
    "size": 15420,
    "mimeType": "text/plain",
    "checksum": "sha256:abc123...",
    "uploadedAt": "2024-01-15T10:30:00Z",
    "securityScan": {
      "status": "passed",
      "threats": 0,
      "scannedAt": "2024-01-15T10:30:15Z"
    }
  }
}
```

### Get File Information

Retrieve file metadata and status.

```http
GET /api/hadron/files/{fileId}
```

#### Response
```json
{
  "success": true,
  "data": {
    "fileId": "file_abc123",
    "filename": "crash.log",
    "size": 15420,
    "mimeType": "text/plain",
    "uploadedAt": "2024-01-15T10:30:00Z",
    "status": "processed",
    "metadata": {
      "type": "crash_log",
      "sessionId": "session_123",
      "description": "Main thread crash"
    },
    "securityScan": {
      "status": "passed",
      "threats": 0,
      "details": {
        "malwareDetected": false,
        "suspiciousPatterns": false,
        "fileIntegrity": "valid"
      }
    }
  }
}
```

### Download File

Download a previously uploaded file.

```http
GET /api/hadron/files/{fileId}/download
```

#### Response
- **Content-Type**: Original file MIME type
- **Content-Disposition**: `attachment; filename="original-filename.ext"`
- **Body**: File binary data

## Alerts API

### Create Alert Rule

Create a new alert rule for monitoring.

```http
POST /api/hadron/alerts/rules
```

#### Request Body
```json
{
  "name": "High Crash Rate Alert",
  "description": "Alert when crash rate exceeds threshold",
  "enabled": true,
  "conditions": {
    "metric": "crash_frequency",
    "operator": "greater_than",
    "threshold": 10,
    "timeWindow": "1h"
  },
  "severity": "critical",
  "notifications": [
    {
      "type": "email",
      "recipients": ["team@example.com"]
    },
    {
      "type": "webhook",
      "url": "https://hooks.slack.com/services/..."
    }
  ]
}
```

#### Response
```json
{
  "success": true,
  "data": {
    "ruleId": "rule_abc123",
    "name": "High Crash Rate Alert",
    "enabled": true,
    "createdAt": "2024-01-15T10:30:00Z",
    "nextEvaluation": "2024-01-15T11:00:00Z"
  }
}
```

### List Alert Rules

Get all alert rules with optional filtering.

```http
GET /api/hadron/alerts/rules?enabled=true&severity=critical
```

#### Response
```json
{
  "success": true,
  "data": {
    "rules": [
      {
        "ruleId": "rule_abc123",
        "name": "High Crash Rate Alert",
        "enabled": true,
        "severity": "critical",
        "lastTriggered": "2024-01-15T09:45:00Z",
        "triggerCount": 3
      }
    ]
  }
}
```

### Get Active Alerts

Retrieve currently active alerts.

```http
GET /api/hadron/alerts/active?severity=critical&acknowledged=false
```

#### Response
```json
{
  "success": true,
  "data": {
    "alerts": [
      {
        "alertId": "alert_xyz789",
        "ruleId": "rule_abc123",
        "ruleName": "High Crash Rate Alert",
        "severity": "critical",
        "status": "active",
        "triggeredAt": "2024-01-15T10:15:00Z",
        "value": 15,
        "threshold": 10,
        "message": "Crash rate of 15/hour exceeds threshold of 10/hour",
        "acknowledged": false
      }
    ]
  }
}
```

### Acknowledge Alert

Acknowledge an active alert.

```http
POST /api/hadron/alerts/{alertId}/acknowledge
```

#### Request Body
```json
{
  "acknowledgedBy": "user123",
  "notes": "Investigating the issue"
}
```

#### Response
```json
{
  "success": true,
  "data": {
    "alertId": "alert_xyz789",
    "acknowledgedAt": "2024-01-15T10:30:00Z",
    "acknowledgedBy": "user123",
    "notes": "Investigating the issue"
  }
}
```

## Security API

### Scan File

Perform security scan on an uploaded file.

```http
POST /api/hadron/security/scan/{fileId}
```

#### Response
```json
{
  "success": true,
  "data": {
    "scanId": "scan_abc123",
    "fileId": "file_xyz789",
    "status": "completed",
    "result": {
      "threat_level": "low",
      "threats_detected": 0,
      "scan_duration": 1250,
      "details": {
        "malware": false,
        "suspicious_patterns": false,
        "file_integrity": "valid",
        "content_type_verified": true
      }
    },
    "scannedAt": "2024-01-15T10:30:00Z"
  }
}
```

### Get Security Status

Get overall security status and statistics.

```http
GET /api/hadron/security/status
```

#### Response
```json
{
  "success": true,
  "data": {
    "overall_status": "healthy",
    "total_files_scanned": 1247,
    "threats_detected": 3,
    "false_positives": 1,
    "last_threat_detected": "2024-01-10T14:22:00Z",
    "scanning_enabled": true,
    "quarantine_files": 2
  }
}
```

## WebSocket Events

### Connection

Connect to real-time events.

```javascript
const ws = new WebSocket('wss://your-instance.com/api/hadron/ws');
```

### Event Types

#### Analysis Progress
```json
{
  "type": "analysis_progress",
  "data": {
    "logId": "log_abc123",
    "status": "analyzing",
    "progress": 75,
    "estimatedTimeRemaining": 30000
  }
}
```

#### Analysis Complete
```json
{
  "type": "analysis_complete",
  "data": {
    "logId": "log_abc123",
    "analysisId": "analysis_def456",
    "status": "completed",
    "confidence": 0.85
  }
}
```

#### New Alert
```json
{
  "type": "alert_triggered",
  "data": {
    "alertId": "alert_xyz789",
    "severity": "critical",
    "message": "High crash rate detected",
    "triggeredAt": "2024-01-15T10:30:00Z"
  }
}
```

#### System Status
```json
{
  "type": "system_status",
  "data": {
    "ai_service": "online",
    "database": "online",
    "storage": "online",
    "analysis_queue": 5
  }
}
```

## SDK and Libraries

### JavaScript/TypeScript SDK

```bash
npm install @alexandria/hadron-sdk
```

```javascript
import { HadronClient } from '@alexandria/hadron-sdk';

const client = new HadronClient({
  baseUrl: 'https://your-instance.com',
  apiKey: 'your-api-key'
});

// Upload and analyze crash log
const result = await client.crashAnalyzer.uploadLog({
  file: logFile,
  metadata: {
    platform: 'iOS',
    appVersion: '1.2.3'
  },
  autoAnalyze: true
});

// Get analysis result
const analysis = await client.crashAnalyzer.getAnalysis(result.logId);
```

### Python SDK

```bash
pip install alexandria-hadron-sdk
```

```python
from alexandria_hadron import HadronClient

client = HadronClient(
    base_url='https://your-instance.com',
    api_key='your-api-key'
)

# Upload crash log
with open('crash.log', 'rb') as f:
    result = client.crash_analyzer.upload_log(
        file=f,
        metadata={
            'platform': 'Android',
            'app_version': '2.1.0'
        },
        auto_analyze=True
    )

# Wait for analysis
analysis = client.crash_analyzer.wait_for_analysis(result['logId'])
```

### cURL Examples

#### Upload Crash Log
```bash
curl -X POST \
  https://your-instance.com/api/hadron/crash-analyzer/logs \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@crash.log" \
  -F 'metadata={"platform":"iOS","appVersion":"1.2.3"}'
```

#### Get Analytics
```bash
curl -X GET \
  "https://your-instance.com/api/hadron/analytics/overview?timeRange=7d" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Rate Limiting

### Limits
- **API Requests**: 1000 requests per hour per API key
- **File Uploads**: 100 uploads per hour per user
- **Analysis Requests**: 50 analyses per hour per user
- **WebSocket Connections**: 10 concurrent connections per user

### Headers
```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 750
X-RateLimit-Reset: 1642262400
X-RateLimit-Retry-After: 3600
```

### Rate Limit Response
```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Try again in 3600 seconds.",
    "details": {
      "limit": 1000,
      "remaining": 0,
      "resetAt": "2024-01-15T11:00:00Z"
    }
  }
}
```

## Examples

### Complete Crash Analysis Workflow

```javascript
async function analyzeCrash() {
  // 1. Upload crash log
  const upload = await fetch('/api/hadron/crash-analyzer/logs', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + token
    },
    body: formData
  });
  
  const { data: { logId } } = await upload.json();
  
  // 2. Poll for analysis completion
  let analysis;
  do {
    await new Promise(resolve => setTimeout(resolve, 5000));
    const response = await fetch(`/api/hadron/crash-analyzer/logs/${logId}/analysis`, {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    analysis = await response.json();
  } while (analysis.data.status === 'analyzing');
  
  // 3. Display results
  console.log('Primary Error:', analysis.data.result.primaryError);
  console.log('Root Causes:', analysis.data.result.potentialRootCauses);
  console.log('Troubleshooting:', analysis.data.result.troubleshootingSteps);
}
```

### Real-time Monitoring Setup

```javascript
// Set up WebSocket connection
const ws = new WebSocket('wss://your-instance.com/api/hadron/ws');

ws.onopen = () => {
  // Subscribe to specific events
  ws.send(JSON.stringify({
    type: 'subscribe',
    events: ['analysis_complete', 'alert_triggered']
  }));
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  
  switch (message.type) {
    case 'analysis_complete':
      handleAnalysisComplete(message.data);
      break;
    case 'alert_triggered':
      handleAlert(message.data);
      break;
  }
};

function handleAnalysisComplete(data) {
  // Update UI with completed analysis
  updateAnalysisStatus(data.logId, 'completed');
  showNotification(`Analysis completed for ${data.logId}`);
}

function handleAlert(data) {
  // Display critical alert
  showAlert(data.severity, data.message);
}
```

### Bulk Upload and Analysis

```python
import os
import asyncio
from alexandria_hadron import HadronClient

async def bulk_analyze_logs(directory):
    client = HadronClient(base_url='https://your-instance.com', api_key='your-key')
    
    # Get all log files
    log_files = [f for f in os.listdir(directory) if f.endswith('.log')]
    
    # Upload all files
    uploads = []
    for filename in log_files:
        with open(os.path.join(directory, filename), 'rb') as f:
            result = await client.crash_analyzer.upload_log(
                file=f,
                metadata={'batch_id': 'bulk_001'},
                auto_analyze=True
            )
            uploads.append(result['logId'])
    
    # Wait for all analyses to complete
    analyses = []
    for log_id in uploads:
        analysis = await client.crash_analyzer.wait_for_analysis(log_id)
        analyses.append(analysis)
    
    return analyses

# Run bulk analysis
results = asyncio.run(bulk_analyze_logs('./crash_logs'))
```

---

*For additional API documentation, examples, and support, please visit the Alexandria platform developer portal.*