# Contributing to Apicarus

Thank you for your interest in contributing to Apicarus! This document provides guidelines and instructions for contributing.

## Code of Conduct

By participating in this project, you agree to abide by the [Alexandria Platform Code of Conduct](https://alexandria.platform/code-of-conduct).

## How to Contribute

### Reporting Issues

1. **Check existing issues** first to avoid duplicates
2. **Use issue templates** when available
3. **Provide details**:
   - Plugin version
   - Alexandria Platform version
   - Steps to reproduce
   - Expected vs actual behavior
   - Screenshots if applicable

### Feature Requests

1. **Open a discussion** first for major features
2. **Describe the use case** clearly
3. **Consider alternatives** you've explored
4. **Be open to feedback** from maintainers

### Pull Requests

#### Before You Start

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/your-feature-name`
3. **Set up development environment** (see Developer Guide)
4. **Check existing PRs** to avoid duplicate work

#### Making Changes

1. **Follow code style**:
   ```javascript
   // Good
   async function sendRequest(url, options = {}) {
     const { method = 'GET', headers = {} } = options;
     // ...
   }
   
   // Avoid
   async function send_request(url,options){
     var method=options.method||"GET"
     // ...
   }
   ```
2. **Write tests** for new features:
   ```javascript
   describe('NewFeature', () => {
     it('should work as expected', () => {
       // Test implementation
     });
   });
   ```

3. **Update documentation** if needed
4. **Keep commits focused** and atomic
5. **Write clear commit messages**:
   ```
   feat: add GraphQL support to request builder
   
   - Add GraphQL query editor
   - Support for variables and fragments
   - Auto-complete for schema
   
   Closes #123
   ```

#### Commit Message Format

We use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `style:` Code style changes (formatting, etc.)
- `refactor:` Code refactoring
- `test:` Test additions or fixes
- `chore:` Maintenance tasks

#### Submitting PR

1. **Run all tests**: `npm test`
2. **Check linting**: `npm run lint`
3. **Update changelog** if applicable
4. **Push your branch**: `git push origin feature/your-feature-name`
5. **Create Pull Request** with:
   - Clear title and description
   - Link to related issues
   - Screenshots for UI changes
   - Test coverage report
## Development Workflow

### Setting Up

```bash
# Fork and clone
git clone https://github.com/YOUR_USERNAME/apicarus.git
cd apicarus

# Add upstream
git remote add upstream https://github.com/alexandria-platform/apicarus.git

# Install dependencies
npm install

# Start development
npm run dev
```

### Daily Workflow

```bash
# Sync with upstream
git fetch upstream
git checkout main
git merge upstream/main

# Create feature branch
git checkout -b feature/amazing-feature

# Make changes and test
npm run test:watch

# Commit changes
git add .
git commit -m "feat: add amazing feature"

# Push to your fork
git push origin feature/amazing-feature
```

## Testing Guidelines

### Test Coverage

- Aim for >80% code coverage
- Test edge cases and error scenarios
- Include integration tests for complex features

### Writing Good Tests

```javascript
// Descriptive test names
it('should return 401 when authentication token is invalid', () => {
  // Clear test implementation
});

// Use beforeEach for setup
beforeEach(() => {
  // Reset state
});

// Mock external dependencies
jest.mock('alexandria-sdk');
```
## Code Review Process

### What We Look For

- **Code quality**: Clean, readable, maintainable
- **Test coverage**: Adequate tests for new code
- **Performance**: No performance regressions
- **Security**: No security vulnerabilities
- **Documentation**: Updated docs and comments
- **Compatibility**: Works with supported Alexandria versions

### Review Timeline

- Initial review: Within 3 business days
- Follow-up reviews: Within 1-2 business days
- Merging: After approval from 2 maintainers

## Release Process

1. **Version bump** following semantic versioning
2. **Update CHANGELOG.md**
3. **Run full test suite**
4. **Create release PR**
5. **Tag release** after merge
6. **Publish to Alexandria Registry**

## Getting Help

### Resources

- [Developer Guide](docs/DEVELOPER_GUIDE.md)
- [API Reference](docs/API_REFERENCE.md)
- [Alexandria SDK Docs](https://docs.alexandria.platform/sdk)

### Communication

- **GitHub Issues**: Bug reports and feature requests
- **Discord**: Real-time chat in #apicarus channel
- **Email**: apiforge@alexandria.platform

## Recognition

Contributors will be:
- Listed in [CONTRIBUTORS.md](CONTRIBUTORS.md)
- Mentioned in release notes
- Given credit in the plugin UI

Thank you for contributing to Apicarus! 🙏