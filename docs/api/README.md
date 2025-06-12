# Alexandria Platform API Documentation

Welcome to the Alexandria Platform API documentation! This directory contains comprehensive documentation for all REST API endpoints.

## 🚀 Quick Start

### View Interactive Documentation

**Local Development:**
```bash
# Start the development server
pnpm run dev

# Open API documentation
open http://localhost:4000/api-docs
```

**Static Documentation:**
```bash
# Generate static documentation files
pnpm run docs:generate

# Serve documentation locally
pnpm run docs:serve

# Open browser
open http://localhost:8080
```

### Get Started with the API

1. **Authentication:**
   ```bash
   curl -X POST http://localhost:4000/api/v1/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email": "admin@alexandria.local", "password": "admin123"}'
   ```

2. **Use the JWT token:**
   ```bash
   curl -X GET http://localhost:4000/api/v1/health/detailed \
     -H "Authorization: Bearer YOUR_JWT_TOKEN"
   ```

## 📚 Documentation Formats

| Format | File | Description |
|--------|------|-------------|
| **Interactive** | `index.html` | Swagger UI with live testing |
| **OpenAPI JSON** | `openapi.json` | Machine-readable API specification |
| **OpenAPI YAML** | `openapi.yaml` | Human-readable API specification |
| **Postman** | `*.postman_collection.json` | Import into Postman for testing |

## 🔐 Authentication

The Alexandria Platform API uses **JWT (JSON Web Token)** authentication:

### Login Flow

1. **POST** `/api/v1/auth/login` with credentials
2. Receive JWT token in response  
3. Include token in subsequent requests: `Authorization: Bearer <token>`
4. Token expires after 24 hours (or 30 days with "remember me")

### Demo Credentials

For development and testing:
- **Email:** `admin@alexandria.local`
- **Password:** `admin123`

### Security Headers

All authenticated requests require:
```http
Authorization: Bearer <your-jwt-token>
Content-Type: application/json
```

## 🛠️ API Versioning

The API supports multiple versioning strategies:

| Method | Example | Description |
|--------|---------|-------------|
| **Path** | `/api/v1/health` | URL path versioning (recommended) |
| **Header** | `API-Version: v1` | Custom header |
| **Accept** | `Accept: application/vnd.alexandria.v1+json` | Content negotiation |
| **Query** | `/api/health?version=v1` | Query parameter |

### Supported Versions

- **v1** - Current stable version
- **v2** - Latest features (beta)

## 📋 Available Endpoints

### 🔐 Authentication (`/api/v1/auth/`)
- `POST /login` - User authentication
- `POST /logout` - User logout  
- `GET /validate` - Token validation

### 🏥 Health Monitoring (`/api/v1/health/`)
- `GET /` - Basic health check
- `GET /detailed` - Comprehensive system status

### 📊 System Metrics (`/api/v1/system/`)
- `GET /metrics` - Performance metrics
- `GET /metrics?format=prometheus` - Prometheus format

### 🔌 Plugin Management (`/api/v1/plugins/`)
- `GET /` - List installed plugins
- `POST /` - Install new plugin
- `GET /{id}` - Get plugin details
- `PUT /{id}` - Update plugin configuration
- `DELETE /{id}` - Uninstall plugin
- `POST /{id}/activate` - Activate plugin
- `POST /{id}/deactivate` - Deactivate plugin

## 🚨 Error Handling

All API errors follow a consistent format:

```json
{
  "success": false,
  "error": "ERROR_CODE",
  "message": "Human-readable error message",
  "requestId": "uuid-for-tracking",
  "timestamp": "2024-12-11T10:30:00Z",
  "details": {
    "field": ["validation errors if applicable"]
  }
}
```

### Common Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `INVALID_CREDENTIALS` | 401 | Login failed |
| `UNAUTHORIZED` | 401 | Missing or invalid token |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 422 | Request validation failed |
| `INTERNAL_ERROR` | 500 | Server error |

## 🔢 Rate Limiting

API requests are rate limited:

| User Type | Limit | Headers |
|-----------|-------|---------|
| **Anonymous** | 100 req/min | `X-RateLimit-*` |
| **Authenticated** | 1000 req/min | `X-RateLimit-*` |
| **Admin** | 5000 req/min | `X-RateLimit-*` |

Rate limit information is included in response headers:
```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1234567890
```

## 🧪 Testing

### Using Swagger UI

1. Open the interactive documentation
2. Click "Authorize" and enter your JWT token
3. Try out endpoints directly in the browser

### Using Postman

1. Generate Postman collection: `pnpm run docs:generate --postman`
2. Import `alexandria-api.postman_collection.json`
3. Set environment variables:
   - `base_url`: `http://localhost:4000`
   - `jwt_token`: (obtain from login endpoint)

### Using cURL

```bash
# Login and save token
TOKEN=$(curl -s -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@alexandria.local", "password": "admin123"}' \
  | jq -r '.token')

# Use token for subsequent requests
curl -X GET http://localhost:4000/api/v1/plugins \
  -H "Authorization: Bearer $TOKEN"
```

## 🔧 Development

### Generate Documentation

```bash
# Generate all documentation formats
pnpm run docs:generate

# Generate with Postman collection
pnpm run docs:generate --postman

# Generate to custom directory
pnpm run docs:generate --output ./custom-docs

# Validate only (no file generation)
pnpm run docs:validate
```

### Validate Documentation

```bash
# Comprehensive validation
pnpm run docs:validate

# Check coverage and quality
pnpm run docs:validate --verbose
```

### Update Documentation

1. **Add JSDoc comments** to API route handlers:
   ```typescript
   /**
    * @swagger
    * /api/v1/example:
    *   get:
    *     summary: Example endpoint
    *     description: Detailed description
    *     responses:
    *       200:
    *         description: Success response
    */
   router.get('/example', handler);
   ```

2. **Update OpenAPI YAML** file: `docs/api/openapi.yaml`

3. **Regenerate documentation**: `pnpm run docs:generate`

## 🚀 Production Deployment

### Security Considerations

- API documentation is **disabled in production** for security
- Use HTTPS for all API communications
- Store JWT secrets securely
- Implement proper CORS policies
- Monitor for unusual API usage patterns

### Monitoring

- Health checks: `/api/v1/health`
- Metrics: `/api/v1/system/metrics`
- Logs: Check application logs for API errors

## 📞 Support

Need help with the API?

- **Documentation**: https://docs.alexandria-platform.com
- **Support Email**: support@alexandria-platform.com
- **GitHub Issues**: https://github.com/alexandria-platform/issues
- **Community**: https://community.alexandria-platform.com

## 🔄 Changelog

### v0.1.0 (Current)
- Initial API release
- JWT authentication
- Plugin management
- Health monitoring  
- System metrics
- Comprehensive documentation

---

**Last Updated:** December 11, 2024  
**API Version:** v0.1.0  
**Documentation Version:** 1.0.0