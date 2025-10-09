#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { google } from 'googleapis'
import { z } from 'zod'
import { ERROR_MESSAGES, OAUTH21_CONFIG, SERVER_CONFIG } from './constants.js'
import { registerAuthTools } from './tools/auth.js'
import { registerConsolidatedCalendarTools } from './tools/calendars.js'
import { registerConsolidatedEventTools } from './tools/events.js'
import { GoogleCalendarOAuthProvider } from './oauth-provider.js'

// Check if OAuth 2.1 is enabled at build time
const isOAuth21Enabled = process.env.OAUTH21_ENABLED === 'true'

export const configSchema = z.object({
	// OAuth is now handled automatically by Smithery's OAuth provider
	// No configuration needed for OAuth 2.1 integration
	refreshToken: z.string().optional().describe('Optional: Pre-existing refresh token for Google Calendar access'),
})

// OAuth 2.1 Integration
const oauth21Config = isOAuth21Enabled
	? {
		authServerUrl: process.env.OAUTH21_AUTH_SERVER_URL || OAUTH21_CONFIG.DEFAULT_AUTH_SERVER_URL,
		resourceId: process.env.OAUTH21_RESOURCE_ID || OAUTH21_CONFIG.DEFAULT_RESOURCE_ID,
		autoAuth: process.env.OAUTH21_AUTO_AUTH === 'true',
	}
	: null

export default function ({ config, auth }: { config: z.infer<typeof configSchema>, auth?: any }) {
	try {
		console.log(`Starting ${SERVER_CONFIG.NAME}...`)

		// Check for OAuth 2.1 integration
		if (isOAuth21Enabled && oauth21Config) {
			console.log('OAuth 2.1 Integration Detected!')
			console.log(`   Auth Server: ${oauth21Config.authServerUrl}`)
			console.log(`   Resource ID: ${oauth21Config.resourceId}`)
			console.log(`   Auto Auth: ${oauth21Config.autoAuth}`)
		}

		// Create a new MCP server
		const server = new McpServer({
			name: SERVER_CONFIG.NAME,
			version: SERVER_CONFIG.VERSION,
		})

		// Initialize OAuth2 client
		// With Smithery OAuth provider, we get auth info from the auth parameter
		let oauth2Client
		if (auth && auth.token) {
			// Use the token from Smithery's OAuth provider
			oauth2Client = new google.auth.OAuth2()
			oauth2Client.setCredentials({
				access_token: auth.token,
				refresh_token: config.refreshToken,
			})
			console.log('Using Smithery OAuth provider with authenticated token')
		} else if (config.refreshToken) {
			// Fallback to refresh token if provided
			oauth2Client = new google.auth.OAuth2()
			oauth2Client.setCredentials({
				refresh_token: config.refreshToken,
			})
			console.log('Using refresh token authentication')
		} else {
			// No authentication available - server will need OAuth flow
			oauth2Client = new google.auth.OAuth2()
			console.log('OAuth authentication required - will be handled by Smithery OAuth provider')
		}

		// Initialize Google Calendar API client
		const calendar = google.calendar({ version: 'v3', auth: oauth2Client })

		// Register tools
		console.log('Registering tools...')
		registerAuthTools(server, oauth2Client)
		console.log('   Auth tools registered')

		registerConsolidatedCalendarTools(server, calendar, oauth2Client)
		console.log('   Calendar tools registered')

		registerConsolidatedEventTools(server, calendar, oauth2Client)
		console.log('   Event tools registered')

		console.log('MCP Server ready!')

		return server.server
	} catch (e) {
		console.error('Error initializing MCP server:', e)
		throw e
	}
}

// Export OAuth provider for Smithery integration
export const oauth = new GoogleCalendarOAuthProvider()
