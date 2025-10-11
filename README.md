# Google Calendar MCP Server

A Model Context Protocol (MCP) server that provides Google Calendar integration through the Smithery framework. This server enables AI assistants to interact with Google Calendar data including calendars, events, and user authentication.

## Features

- **OAuth 2.1 Authentication**: Secure authentication using OAuth 2.1 with PKCE
- **Calendar Management**: List, create, update, and delete calendars
- **Event Operations**: Full CRUD operations for calendar events
- **Search Functionality**: Search events across multiple calendars
- **All-day Event Support**: Handle both timed and all-day events
- **Error Handling**: Comprehensive error handling with user-friendly messages
- **Guest Access**: Supports anonymous access for initial connections

## Architecture

This project consists of two main components:

1. **MCP Server** (`src/`): The main MCP server that implements the Model Context Protocol
2. **Auth Server** (`auth-server/`): OAuth 2.1 authorization server for secure authentication

## Prerequisites

- Node.js 20.0.0 or higher
- npm or yarn
- Google Cloud Console project with Calendar API enabled
- OAuth 2.0 credentials from Google Cloud Console

## Installation

1. **Clone and navigate to the project**
   ```bash
   cd gcal-mcp
   npm install
   ```

2. **Install auth-server dependencies**
   ```bash
   cd auth-server
   npm install
   cd ..
   ```

3. **Configure environment variables**
   ```bash
   # Copy example files
   cp auth-server/env.example auth-server/.env
   
   # Edit auth-server/.env with your settings
   ```

## Configuration

### Auth Server Configuration

Create `auth-server/.env` with the following variables:

```env
# Auth Server Configuration
AUTH_SERVER_ISSUER=http://localhost:3080
MCP_RESOURCE_ID=https://smithery.ai

# Google OAuth Configuration
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3080/oauth/google/callback

# JWT Configuration
JWT_SECRET=your_jwt_secret_key
JWT_ISSUER=http://localhost:3080
JWT_AUDIENCE=https://smithery.ai

# Database (optional - uses in-memory by default)
DATABASE_URL=sqlite://./auth.db
```

### Google Cloud Console Setup

1. **Create a Google Cloud project**
2. **Enable the Google Calendar API**
3. **Configure OAuth consent screen**
4. **Create OAuth 2.0 credentials**
5. **Add authorized redirect URIs**:
   - `http://localhost:3080/oauth/google/callback`
   - `https://smithery.ai/playground/callback`

## Usage

### Development Mode

1. **Start the auth server**
   ```bash
   cd auth-server
   npm run dev
   ```

2. **Start the MCP server** (in a new terminal)
   ```bash
   cd gcal-mcp
   npm run dev
   ```

3. **Connect via Smithery Playground**
   - Open [Smithery Playground](https://smithery.ai/playground)
   - Connect to your MCP server
   - Complete OAuth authentication when prompted

### Production Deployment

1. **Build the project**
   ```bash
   npm run build
   ```

2. **Configure production environment**
   - Update auth server URL in production
   - Use HTTPS for all URLs
   - Configure proper CORS settings

## Available Tools

### Calendar Tools

- **list_calendars**: List all accessible calendars
- **get_calendar**: Get details of a specific calendar
- **create_calendar**: Create a new calendar
- **update_calendar**: Update calendar properties
- **delete_calendar**: Delete a calendar
- **search_calendars**: Search calendars by name or description

### Event Tools

- **list_events**: List events from a calendar
- **get_event**: Get details of a specific event
- **create_event**: Create a new event
- **update_event**: Update event properties
- **delete_event**: Delete an event
- **search_events**: Search events across calendars

### Authentication Tools

- **check_auth_status**: Check current authentication status

## API Reference

### Authentication Flow

1. **Initial Connection**: MCP server allows anonymous initial connections
2. **OAuth Registration**: Client registers with the auth server
3. **Authorization**: User authorizes via Google OAuth
4. **Token Exchange**: Authorization code exchanged for access token
5. **Token Verification**: All subsequent requests verify the access token

### Error Handling

The server provides comprehensive error handling with specific error types:

- **AuthenticationError**: OAuth or token-related errors
- **ValidationError**: Input validation failures
- **RateLimitError**: Rate limiting violations
- **GoogleAPIError**: Google Calendar API errors
- **NetworkError**: Network connectivity issues

## Development

### Project Structure

```
gcal-mcp/
├── src/
│   ├── index.ts              # Main MCP server
│   ├── oauth-provider.ts     # OAuth provider implementation
│   ├── auth-utils.ts         # Authentication utilities
│   ├── constants.ts          # Server constants
│   ├── errors.ts             # Error handling
│   └── tools/
│       ├── auth.ts           # Authentication tools
│       ├── calendars.ts      # Calendar management tools
│       └── events.ts         # Event management tools
├── auth-server/
│   ├── src/
│   │   ├── index.ts          # Auth server main
│   │   ├── google-auth.ts    # Google OAuth integration
│   │   ├── storage.ts        # Token storage
│   │   └── crypto.ts         # Cryptographic utilities
│   └── tests/                # E2E tests
└── package.json
```

### Scripts

- `npm run dev`: Start development server
- `npm run build`: Build for production
- `npm run check`: Lint and format code
- `npm run test`: Run tests

### Testing

Run the comprehensive E2E tests:

```bash
cd auth-server
npm run test:e2e
```

## Troubleshooting

### Common Issues

1. **Infinite Loop During Registration**
   - **Cause**: Smithery SDK's requireBearerAuth middleware blocks MCP initialize
   - **Solution**: OAuth is currently disabled. Contact Smithery developers for SDK fix

2. **Authentication Failures**
   - Verify Google OAuth credentials
   - Check redirect URI configuration
   - Ensure Calendar API is enabled

3. **Network Connectivity**
   - Verify auth server is running on port 3080
   - Check firewall settings
   - Ensure proper URL configuration

### Debug Mode

Enable debug logging:

```bash
LOG_LEVEL=debug npm run dev
```

### Configuration Check

Use the configuration checker:

```bash
./check-config.sh
```

## Security Considerations

- **Token Storage**: Access tokens are stored securely with automatic refresh
- **PKCE**: Uses Proof Key for Code Exchange for enhanced security
- **HTTPS**: Always use HTTPS in production
- **Scope Limitation**: Minimal required scopes for Google Calendar access
- **Token Expiration**: Automatic token refresh and cleanup

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Run linting and formatting
6. Submit a pull request

### Code Style

- Use TypeScript strict mode
- Follow the existing code structure
- Add comprehensive error handling
- Include JSDoc comments for public APIs
- Run `npm run check` before committing

## Support

- **Issues**: Report bugs via GitHub Issues
- **Documentation**: [Smithery Docs](https://smithery.ai/docs)
- **Community**: [Smithery Discord](https://discord.gg/smithery)

## Related Projects

- [Smithery CLI](https://www.npmjs.com/package/@smithery/cli)
- [Model Context Protocol](https://github.com/modelcontextprotocol/specification)
- [Google APIs Node.js Client](https://github.com/googleapis/google-api-nodejs-client)
