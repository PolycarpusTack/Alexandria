# Mnemosyne Plugin for Alexandria

**Status: Backend Core Complete (75%) - Testing & Security In Progress**

A comprehensive knowledge management system plugin for the Alexandria platform, providing advanced note-taking, knowledge graph visualization, and semantic search capabilities.

## 🚀 Current Status

✅ **Backend Architecture Complete**  
✅ **Database Schema & Migrations Ready**  
✅ **REST API Endpoints Functional**  
✅ **Real-time WebSocket Features**  
✅ **File Attachment System**  
⏳ **Testing Implementation (60%)**  
⏳ **Security Hardening (40%)**  

See [PLUGIN_STATUS.md](./PLUGIN_STATUS.md) for detailed progress tracking.

## Features

- **Knowledge Graph Visualization**: Interactive D3-based graph visualization of your knowledge network
- **Advanced Search**: Full-text search with PostgreSQL's built-in capabilities  
- **Real-time Collaboration**: WebSocket-based real-time editing and presence awareness
- **Template System**: Customizable templates with variable substitution
- **File Attachments**: Secure file upload/download with validation
- **Hierarchical Organization**: Tree-based structure with parent-child relationships
- **Rich Connections**: Multiple connection types between knowledge nodes
- **Authentication**: Flexible auth system with JWT and Alexandria integration

## Architecture

The plugin follows a clean architecture pattern with clear separation of concerns:

```
mnemosyne/
├── src/
│   ├── api/              # REST API endpoints
│   ├── database/         # TypeORM entities and migrations
│   ├── services/         # Business logic layer
│   ├── repositories/     # Data access layer
│   ├── middleware/       # Express middleware
│   └── ui/               # React components
├── tests/                # Test suites
└── docs/                 # Documentation
```

## Installation

1. Ensure PostgreSQL is installed and running
2. Install dependencies:
   ```bash
   pnpm install
   ```
3. Set up environment variables:
   ```env
   MNEMOSYNE_DB_HOST=localhost
   MNEMOSYNE_DB_PORT=5432
   MNEMOSYNE_DB_USER=alexandria
   MNEMOSYNE_DB_PASSWORD=alexandria
   MNEMOSYNE_DB_NAME=alexandria
   ```
4. Run database migrations:
   ```bash
   pnpm run migration:run
   ```
5. Build the plugin:
   ```bash
   pnpm run build
   ```

## Development

### Current Development Phase
**Primary Focus**: Testing implementation and security hardening

**Next Tasks**:
1. Expand unit test coverage to 80%
2. Implement SQL injection prevention  
3. Add XSS protection middleware
4. Complete CSRF protection

### Running in Development Mode

```bash
# Install dependencies
pnpm install

# Set up environment
cp .env.example .env

# Watch TypeScript files
pnpm run dev

# Build backend only (isolated)
pnpm run build

# Run the development server
pnpm run server:dev
```

### Testing

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Generate coverage report (Target: 80%)
pnpm test:coverage
```

### Database Migrations

```bash
# Run pending migrations
pnpm run migration:run

# Create a new migration
pnpm run migration:create src/database/migrations/YourMigrationName

# Revert last migration
pnpm run migration:revert
```

## API Endpoints

### Nodes
- `GET /api/mnemosyne/nodes` - List all nodes
- `GET /api/mnemosyne/nodes/:id` - Get specific node
- `POST /api/mnemosyne/nodes` - Create new node
- `PUT /api/mnemosyne/nodes/:id` - Update node
- `DELETE /api/mnemosyne/nodes/:id` - Delete node
- `GET /api/mnemosyne/nodes/:id/children` - Get child nodes
- `GET /api/mnemosyne/nodes/:id/path` - Get node path
- `POST /api/mnemosyne/nodes/:id/move` - Move node

### Connections
- `GET /api/mnemosyne/nodes/:id/connections` - Get node connections
- `POST /api/mnemosyne/connections` - Create connection
- `DELETE /api/mnemosyne/connections/:id` - Delete connection

### Templates
- `GET /api/mnemosyne/templates` - List templates
- `GET /api/mnemosyne/templates/:id` - Get template
- `POST /api/mnemosyne/templates` - Create template
- `PUT /api/mnemosyne/templates/:id` - Update template
- `DELETE /api/mnemosyne/templates/:id` - Delete template
- `POST /api/mnemosyne/templates/:id/use` - Use template

### Search
- `POST /api/mnemosyne/search` - Search nodes
- `GET /api/mnemosyne/search/suggestions` - Get search suggestions

## WebSocket Events

### Client -> Server
- `join:node` - Join collaboration room
- `leave:node` - Leave collaboration room
- `node:edit` - Send edit changes
- `cursor:move` - Update cursor position
- `search:suggest` - Request search suggestions

### Server -> Client
- `user:joined` - User joined room
- `user:left` - User left room
- `node:changes` - Receive edit changes
- `cursor:update` - Cursor position update
- `node:created` - New node created
- `node:updated` - Node updated
- `node:deleted` - Node deleted

## Configuration

The plugin can be configured through environment variables:

- `MNEMOSYNE_DB_*` - Database connection settings
- `MNEMOSYNE_SEARCH_ENGINE` - Search engine (default: postgres)
- `MNEMOSYNE_ATTACHMENTS_PATH` - File storage path
- `MNEMOSYNE_MAX_FILE_SIZE` - Maximum file size (default: 10MB)

## Security

- All API endpoints require authentication
- Input validation using express-validator
- SQL injection protection through TypeORM
- XSS protection in React components
- File upload restrictions and validation

## Performance Considerations

- Database indexes on frequently queried fields
- Connection pooling for database efficiency
- Lazy loading for large node trees
- Debounced search suggestions
- Efficient full-text search using PostgreSQL

## Future Enhancements

- Elasticsearch integration for advanced search
- AI-powered content suggestions
- Markdown editor with live preview
- Version control for nodes
- Export to various formats (PDF, DOCX)
- Mobile application support

## Contributing

Please follow the Alexandria contributing guidelines and ensure all tests pass before submitting pull requests.

## License

MIT License - see the Alexandria project license for details.