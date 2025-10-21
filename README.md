# Google Calendar MCP Server
[![smithery badge](https://smithery.ai/badge/@Kashyab19/google-calendar-mcp-server)](https://smithery.ai/server/@Kashyab19/google-calendar-mcp-server)

Welcome to the Google Calendar MCP Server for Claude Desktop! This server implements the Model Context Protocol (MCP), providing an interface between Google's calendar data and Claude Desktop (a Large Language Model).

To utilize this server as a tool for Claude Desktop, please follow the installation instructions below:

### Installing via Smithery

To install Google Calendar automatically via [Smithery](https://smithery.ai/server/@Kashyab19/google-calendar-mcp-server):

```bash
npx -y @smithery/cli install @Kashyab19/google-calendar-mcp-server
```

## Features
- Query Google Calendar events.
- Create, update, and delete calendar events.
- Seamless integration with Claude Desktop through the MCP interface.

## Getting Started

### Prerequisites
- A Claude Desktop setup supporting MCP.
- Google Calendar API credentials, as required by the selected calendar interaction tools.

### How to Run

Run the server locally, ensuring it can reach your Google Calendar API:
```bash
node server.js
```

The server will listen on the default port and provide available tools to interact with Google Calendar through Claude Desktop.

## Configuration

### Environment Variables
- `GOOGLE_API_KEY`: Your Google API Key for calendar access.
- `PORT`: Port for the server (default 8080).

Ensure to set the environment variables appropriately before running the server.

## License
This project is licensed under the MIT License. See the LICENSE file for more information.

## Contributing
Pull requests are welcome! For significant changes, please open an issue first to discuss what you would like to change.

## Contact
For questions or feedback, please feel free to contact the repository maintainer.


