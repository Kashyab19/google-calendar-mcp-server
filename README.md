# Google Calendar MCP Server

A Model Context Protocol (MCP) server for interacting with Google Calendar API, built for [Smithery](https://smithery.ai/).

## Features

- **OAuth 2.1 Authentication**: Modern, secure authentication with automatic browser opening
- **Calendar Management**: List, create, and delete calendars
- **Event Operations**: Create, read, update, and delete calendar events
- **Comprehensive Event Details**: Support for attendees, reminders, locations, and more
- **All-Day Event Support**: Handle both timed and all-day events
- **Search Functionality**: Search events by text and time ranges
- **Server Monitoring**: Built-in server status and metrics

## Prerequisites

Before using this MCP server, you need:

1. **Node.js 18+** installed
2. **Google Cloud Console project** with Calendar API enabled
3. **OAuth2 credentials** (Client ID and Client Secret)

## Google Cloud Setup

### 1. Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google Calendar API:
   - Go to "APIs & Services" > "Library"
   - Search for "Google Calendar API"
   - Click "Enable"

### 2. Configure OAuth Consent Screen

1. Go to "APIs & Services" > "OAuth consent screen"
2. Choose "External" user type
3. Fill in the required information:
   - App name: "Your App Name"
   - User support email: Your email
   - Developer contact information: Your email
4. Add scopes (optional for testing):
   - `https://www.googleapis.com/auth/calendar`
   - `https://www.googleapis.com/auth/calendar.events`

### 3. Create OAuth2 Credentials

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth 2.0 Client IDs"
3. Choose "Web application"
4. Add authorized redirect URIs:
   - `http://localhost:3080/oauth/google/callback`
5. Download the JSON file and note your Client ID and Client Secret

## Installation

### Using Smithery CLI

```bash
npm install -g @smithery/cli
npm create smithery
```

Or clone this repository:

```bash
git clone <repository-url>
cd google-calendar-mcp
npm install
```

## Configuration

Configure the MCP server using environment variables. Create a `.env` file:

```env
# Google OAuth Configuration (Required for OAuth 2.1)
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Pre-existing Refresh Token (Optional - for automatic authentication)
GOOGLE_REFRESH_TOKEN=your-refresh-token-here

# OAuth 2.1 Configuration (Required)
OAUTH21_ENABLED=true
OAUTH21_AUTH_SERVER_URL=http://localhost:3080
OAUTH21_RESOURCE_ID=http://localhost:8081
OAUTH21_AUTO_AUTH=true

# Development Settings
NODE_ENV=development
MCP_SERVER_PORT=8081
MCP_SERVER_HOST=localhost
```

### Configuration Parameters

- **`GOOGLE_CLIENT_ID`** (required): Google OAuth2 Client ID from Google Cloud Console
- **`GOOGLE_CLIENT_SECRET`** (required): Google OAuth2 Client Secret from Google Cloud Console  
- **`GOOGLE_REFRESH_TOKEN`** (optional): Pre-existing refresh token for automatic authentication
- **`OAUTH21_AUTH_SERVER_URL`** (required): OAuth 2.1 authorization server URL
- **`OAUTH21_RESOURCE_ID`** (required): MCP server resource identifier

## Usage

### Development

1. **Start the Auth Server** (in one terminal):
   ```bash
   cd auth-server
   npm run dev
   ```

2. **Start the MCP Server** (in another terminal):
   ```bash
   npm run dev
   ```

### Authentication Flow

The server uses **OAuth 2.1** with automatic authentication:

1. **Run the authenticate tool**:
   ```
   Tool: authenticate
   ```

2. **Browser opens automatically** - Complete Google's consent screen

3. **Authentication complete** - Tokens are automatically exchanged and stored

4. **Ready to use** - All calendar tools are now available

### Available Tools

#### Authentication Tools

- **`authenticate`** - OAuth 2.1 automatic authentication with browser opening
- **`check_auth_status`** - Check current authentication status and token information

#### Calendar Management

- **`list_calendars`** - List all accessible calendars
- **`manage_calendars`** - Create, get details, update, or delete calendars

#### Event Management

- **`list_events`** - List events with filtering and search options
- **`create_events`** - Create single, multiple, or recurring events
- **`update_events`** - Update or delete events by ID, name, or search criteria
- **`get_current_time`** - Get current system time

#### Monitoring

- **`get_server_status`** - Get server metrics (uptime, memory usage, tool count)

### Example Usage

#### Create a Calendar

```typescript
Tool: manage_calendars
Parameters: {
  "create": true,
  "summary": "Work Projects",
  "description": "Calendar for work-related projects and deadlines",
  "time_zone": "America/New_York"
}
```

#### Get Calendar Details

```typescript
Tool: manage_calendars
Parameters: {
  "calendar_id": "primary"
}
```

#### Update a Calendar

```typescript
Tool: manage_calendars
Parameters: {
  "calendar_id": "abc123def456",
  "update": true,
  "updates": {
    "summary": "Updated Calendar Name",
    "description": "New description"
  }
}
```

#### Delete a Calendar

```typescript
Tool: manage_calendars
Parameters: {
  "calendar_id": "abc123def456",
  "delete": true
}
```

#### Create an Event

```typescript
Tool: create_events
Parameters: {
  "calendar_id": "primary",
  "summary": "Team Meeting", 
  "description": "Weekly sync meeting",
  "start_time": "2024-01-15T10:00:00Z",
  "end_time": "2024-01-15T11:00:00Z",
  "location": "Conference Room A",
  "attendees": ["colleague@company.com"]
}
```

#### Create a Recurring Event

```typescript
Tool: create_events
Parameters: {
  "summary": "Weekly Team Standup",
  "start_time": "2024-01-15T09:00:00Z",
  "end_time": "2024-01-15T09:30:00Z",
  "recurrence": ["FREQ=WEEKLY;BYDAY=MO,WE,FR"]
}
```

#### Create an Event Starting Now

```typescript
Tool: create_events
Parameters: {
  "summary": "Quick Meeting",
  "start_offset_minutes": 0,
  "duration_minutes": 30,
  "attendees": ["colleague@company.com"]
}
```

#### List Upcoming Events

```typescript
Tool: list_events
Parameters: {
  "calendar_id": "primary",
  "time_min": "2024-01-15T00:00:00Z",
  "time_max": "2024-01-22T23:59:59Z",
  "max_results": 20
}
```

#### Search Events by Name

```typescript
Tool: list_events
Parameters: {
  "search_text": "team meeting",
  "max_results": 10
}
```

#### Update an Event

```typescript
Tool: update_events
Parameters: {
  "event_id": "abc123def456",
  "updates": {
    "summary": "Updated Meeting Title",
    "location": "New Conference Room"
  }
}
```

#### Delete an Event by Name

```typescript
Tool: update_events
Parameters: {
  "event_name": "Old Meeting",
  "start_date": "2024-01-15",
  "delete": true
}
```

## Security Best Practices

1. **Store credentials securely** - Never commit OAuth2 credentials to version control
2. **Use refresh tokens** - Save refresh tokens in your `.env` file for automatic authentication
3. **Limit scopes** - Only request necessary Calendar API scopes
4. **Monitor usage** - Keep track of API usage in Google Cloud Console
5. **OAuth 2.1 compliance** - Uses PKCE and modern security standards

## Error Handling

The MCP server provides detailed error messages for common issues:

- **Authentication errors** - Clear guidance on OAuth2 setup
- **API quota limits** - Information about rate limiting
- **Permission errors** - Help with scope and access issues
- **Invalid parameters** - Validation errors with helpful descriptions

## Development

### Project Structure

```
google-calendar-mcp/
├── src/
│   ├── index.ts                    # Main MCP server entry point
│   └── tools/
│       ├── auth.ts                 # Authentication tools
│       ├── calendars-consolidated.ts # Consolidated calendar management tools
│       └── events-consolidated.ts  # Consolidated event management tools
├── package.json
├── smithery.yaml
└── README.md
```

### Building

```bash
npx @smithery/cli build
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

- **Documentation**: [Smithery Documentation](https://smithery.ai/docs)
- **Google Calendar API**: [Google Calendar API Reference](https://developers.google.com/calendar/api/v3/reference)
- **Issues**: Submit issues via GitHub

## Related Projects

- [Smithery CLI](https://www.npmjs.com/package/@smithery/cli)
- [Model Context Protocol](https://github.com/modelcontextprotocol/specification)
- [Google APIs Node.js Client](https://github.com/googleapis/google-api-nodejs-client) 