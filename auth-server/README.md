# OAuth 2.1 Authorization Server

A standalone OAuth 2.1 authorization server that provides secure authentication for the Google Calendar MCP server. This server implements the OAuth 2.1 specification with PKCE (Proof Key for Code Exchange) for enhanced security.

## Features

- **OAuth 2.1 Compliance**: Full implementation of OAuth 2.1 specification
- **PKCE Support**: Proof Key for Code Exchange for enhanced security
- **Dynamic Client Registration**: Support for RFC 7591 dynamic client registration
- **Token Management**: Secure access token generation, validation, and refresh
- **Google OAuth Integration**: Seamless integration with Google OAuth 2.0
- **JWT Tokens**: JSON Web Token implementation for secure token handling
- **Database Support**: Optional database storage with in-memory fallback
- **Comprehensive Testing**: Full E2E test suite for validation

## Architecture

The auth server is built with Express.js and implements the following OAuth 2.1 endpoints:

- **Authorization Endpoint**: `/authorize` - Initiates OAuth flow
- **Token Endpoint**: `/token` - Exchanges codes for tokens
- **Revocation Endpoint**: `/revoke` - Revokes access tokens
- **Registration Endpoint**: `/register` - Dynamic client registration
- **Discovery Endpoints**: `/.well-known/oauth-authorization-server` and `/.well-known/oauth-protected-resource`

## Prerequisites

- Node.js 20.0.0 or higher
- npm or yarn
- Google Cloud Console project with OAuth 2.0 credentials

## Installation

1. **Navigate to auth-server directory**
   ```bash
   cd auth-server
   npm install
   ```

2. **Configure environment variables**
   ```bash
   cp env.example .env
   # Edit .env with your configuration
   ```

## Configuration

### Environment Variables

Create a `.env` file with the following configuration:

```env
# Server Configuration
PORT=3080
AUTH_SERVER_ISSUER=http://localhost:3080
MCP_RESOURCE_ID=https://smithery.ai

# Google OAuth Configuration
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3080/oauth/google/callback

# JWT Configuration
JWT_SECRET=your_secure_jwt_secret_key
JWT_ISSUER=http://localhost:3080
JWT_AUDIENCE=https://smithery.ai
JWT_EXPIRES_IN=3600

# Database Configuration (Optional)
DATABASE_URL=sqlite://./auth.db
# Alternative: DATABASE_URL=postgresql://user:pass@localhost:5432/authdb

# Security Configuration
SESSION_SECRET=your_session_secret
CORS_ORIGINS=http://localhost:3000,https://smithery.ai

# Development Settings
NODE_ENV=development
LOG_LEVEL=info
```

### Google Cloud Console Setup

1. **Create OAuth 2.0 credentials** in Google Cloud Console
2. **Configure OAuth consent screen**
3. **Add authorized redirect URIs**:
   - `http://localhost:3080/oauth/google/callback` (development)
   - `https://your-domain.com/oauth/google/callback` (production)

## Usage

### Development Mode

```bash
npm run dev
```

The server will start on `http://localhost:3080` with the following endpoints:

- **Authorization**: `http://localhost:3080/authorize`
- **Token**: `http://localhost:3080/token`
- **Registration**: `http://localhost:3080/register`
- **Discovery**: `http://localhost:3080/.well-known/oauth-authorization-server`

### Production Mode

```bash
npm run build
npm start
```

### Docker Support

```bash
# Build image
docker build -t oauth2-auth-server .

# Run container
docker run -p 3080:3080 --env-file .env oauth2-auth-server
```

## API Reference

### OAuth 2.1 Endpoints

#### Authorization Endpoint

```
GET /authorize
```

**Parameters:**
- `client_id`: Client identifier
- `response_type`: Must be "code"
- `redirect_uri`: Client redirect URI
- `scope`: Requested scopes
- `state`: CSRF protection state
- `code_challenge`: PKCE code challenge
- `code_challenge_method`: PKCE method (S256)

#### Token Endpoint

```
POST /token
```

**Parameters:**
- `grant_type`: "authorization_code" or "refresh_token"
- `code`: Authorization code (for authorization_code grant)
- `refresh_token`: Refresh token (for refresh_token grant)
- `client_id`: Client identifier
- `redirect_uri`: Client redirect URI
- `code_verifier`: PKCE code verifier

#### Client Registration Endpoint

```
POST /register
```

**Parameters:**
- `client_name`: Human-readable client name
- `redirect_uris`: Array of redirect URIs
- `grant_types`: Array of supported grant types
- `response_types`: Array of supported response types
- `scope`: Client scope

#### Token Revocation Endpoint

```
POST /revoke
```

**Parameters:**
- `token`: Token to revoke
- `token_type_hint`: Type of token ("access_token" or "refresh_token")
- `client_id`: Client identifier

### Discovery Endpoints

#### Authorization Server Metadata

```
GET /.well-known/oauth-authorization-server
```

Returns OAuth 2.1 authorization server metadata.

#### Protected Resource Metadata

```
GET /.well-known/oauth-protected-resource
```

Returns protected resource metadata for the MCP server.

## Testing

### E2E Tests

Run the comprehensive end-to-end test suite:

```bash
# Interactive E2E test (requires browser)
npm run test:interactive

# Automated E2E test
npm run test:e2e

# Setup ngrok for external testing
npm run setup:ngrok
```

### Test Configuration

Update `tests/test-config.js` with your testing URLs:

```javascript
export const TEST_CONFIG = {
    AUTH_SERVER_URL: 'http://localhost:3080',
    MCP_RESOURCE_ID: 'http://localhost:8081',
    CLIENT_NAME: 'Test Client',
    REDIRECT_URI: 'https://smithery.ai/playground/callback',
    SCOPE: 'https://www.googleapis.com/auth/calendar',
    TIMEOUT: 30000,
    VERBOSE: true
};
```

### Test Coverage

The test suite covers:

- Server connectivity and health checks
- Dynamic client registration
- OAuth authorization flow
- Token exchange and validation
- Token refresh functionality
- Token revocation
- Google OAuth integration
- Error handling and edge cases

## Security Features

### PKCE Implementation

- **Code Verifier**: Cryptographically random string
- **Code Challenge**: SHA256 hash of code verifier
- **S256 Method**: Base64URL-encoded SHA256 hash

### Token Security

- **JWT Tokens**: Signed and optionally encrypted
- **Short Expiration**: Access tokens expire in 1 hour
- **Refresh Tokens**: Long-lived refresh tokens for renewal
- **Secure Storage**: Tokens stored with proper encryption

### CORS Configuration

- **Origin Validation**: Configurable allowed origins
- **Method Restrictions**: Limited to necessary HTTP methods
- **Header Controls**: Controlled exposed headers

## Database Support

### In-Memory Storage (Default)

- Fast and lightweight for development
- Data lost on server restart
- Suitable for testing and development

### SQLite Database

```env
DATABASE_URL=sqlite://./auth.db
```

- Persistent storage for production
- File-based database
- Automatic table creation

### PostgreSQL Database

```env
DATABASE_URL=postgresql://user:password@localhost:5432/authdb
```

- Production-ready database
- High performance and scalability
- ACID compliance

## Monitoring and Logging

### Log Levels

- **DEBUG**: Detailed debugging information
- **INFO**: General information messages
- **WARN**: Warning messages
- **ERROR**: Error messages

### Health Checks

```bash
# Check server health
curl http://localhost:3080/health

# Check OAuth discovery
curl http://localhost:3080/.well-known/oauth-authorization-server
```

### Metrics

The server provides basic metrics for monitoring:

- Request count and response times
- Token generation and validation metrics
- Error rates and types
- Client registration statistics

## Deployment

### Environment Setup

1. **Production Environment Variables**
   ```env
   NODE_ENV=production
   AUTH_SERVER_ISSUER=https://your-domain.com
   MCP_RESOURCE_ID=https://smithery.ai
   JWT_SECRET=your_secure_production_secret
   DATABASE_URL=postgresql://user:pass@db:5432/authdb
   ```

2. **Reverse Proxy Configuration**
   - Use nginx or Apache as reverse proxy
   - Configure SSL/TLS termination
   - Set proper CORS headers

### Docker Deployment

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist/ ./dist/
EXPOSE 3080
CMD ["node", "dist/index.js"]
```

### Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: oauth2-auth-server
spec:
  replicas: 3
  selector:
    matchLabels:
      app: oauth2-auth-server
  template:
    metadata:
      labels:
        app: oauth2-auth-server
    spec:
      containers:
      - name: oauth2-auth-server
        image: oauth2-auth-server:latest
        ports:
        - containerPort: 3080
        env:
        - name: NODE_ENV
          value: "production"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: auth-db-secret
              key: url
```

## Troubleshooting

### Common Issues

1. **Google OAuth Errors**
   - Verify client ID and secret
   - Check redirect URI configuration
   - Ensure OAuth consent screen is configured

2. **Token Validation Failures**
   - Check JWT secret configuration
   - Verify token expiration
   - Ensure proper audience and issuer

3. **Database Connection Issues**
   - Verify database URL format
   - Check database server connectivity
   - Ensure proper permissions

### Debug Mode

Enable detailed logging:

```bash
LOG_LEVEL=debug npm run dev
```

### Health Check

```bash
# Check server status
curl -f http://localhost:3080/health || echo "Server not responding"

# Check OAuth discovery
curl http://localhost:3080/.well-known/oauth-authorization-server | jq .
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Run the test suite
6. Submit a pull request

### Development Setup

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Run tests
npm test

# Run linting
npm run lint
```

## License

MIT License - see LICENSE file for details.

## Support

- **Issues**: Report bugs via GitHub Issues
- **Documentation**: [OAuth 2.1 Specification](https://datatracker.ietf.org/doc/draft-ietf-oauth-v2-1/)
- **Community**: [OAuth Community](https://oauth.net/community/)
