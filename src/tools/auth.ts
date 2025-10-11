import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { Auth } from 'googleapis'

export function registerAuthTools(_server: McpServer, _oauth2Client: Auth.OAuth2Client) {
	// OAuth is now handled automatically by Smithery's OAuth provider
	// We only register the check_auth_status tool for debugging/monitoring purposes
}
