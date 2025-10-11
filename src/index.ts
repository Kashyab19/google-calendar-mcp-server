#!/usr/bin/env node
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { google, type Auth } from 'googleapis'
import { z } from 'zod'
import { isAuthenticated } from './auth-utils.js'
import { SERVER_CONFIG } from './constants.js'
import { registerAuthTools } from './tools/auth.js'
import { registerConsolidatedCalendarTools } from './tools/calendars.js'
import { registerConsolidatedEventTools } from './tools/events.js'
import { GoogleCalendarOAuthProvider } from './oauth-provider.js'
import type { OAuthProvider } from '@smithery/sdk'

export const configSchema = z.object({
	refreshToken: z
		.string()
		.optional()
		.describe('Optional: Pre-existing refresh token for Google Calendar access'),
})

export default function createServer({
	config,
	auth,
}: {
	config: z.infer<typeof configSchema>
	auth?: AuthInfo
}) {
	try {
		console.log(`[SERVER DEBUG] Starting ${SERVER_CONFIG.NAME}...`)

		console.log(`[SERVER DEBUG] OAuth configuration:`)
		console.log(`   Provider Type: GoogleCalendarOAuthProvider (OAuth 2.1 + PKCE)`)
		console.log(`   Using Google OAuth with PKCE for secure authentication`)

		// Create a new MCP server
		const server = new McpServer({
			name: SERVER_CONFIG.NAME,
			version: SERVER_CONFIG.VERSION,
		})

		// OAuth is enabled with GoogleCalendarOAuthProvider
		console.log('[SERVER DEBUG] Using GoogleCalendarOAuthProvider for authentication')

		// Initialize OAuth2 client with auth info from Smithery
		console.log(`[SERVER DEBUG] Auth parameter received:`, auth ? 'PRESENT' : 'NULL')
		if (auth) {
			console.log(`   Token: ${auth.token ? 'PRESENT' : 'MISSING'}`)
			console.log(`   Client ID: ${auth.clientId}`)
			console.log(`   Expires At: ${auth.expiresAt || 'MISSING'}`)
			console.log(`   Scopes: ${auth.scopes ? auth.scopes.join(', ') : 'MISSING'}`)

			// Check if this is a guest/anonymous user
			if (!isAuthenticated(auth)) {
				console.log('[SERVER DEBUG] Guest/anonymous user detected')
				console.log('[SERVER DEBUG] Tools will require authentication when called')
			}
		}

		let oauth2Client: Auth.OAuth2Client
		if (auth?.token && isAuthenticated(auth)) {
			// Use the token from Smithery's OAuth provider (real authenticated user)
			oauth2Client = new google.auth.OAuth2()
			oauth2Client.setCredentials({
				access_token: auth.token,
				refresh_token: config.refreshToken, // Fallback if available
				token_type: 'Bearer',
				expiry_date: auth.expiresAt ? auth.expiresAt * 1000 : undefined,
			})
			console.log('[SERVER DEBUG] Using OAuth 2.1 authentication via Smithery')
			console.log(
				`   Token expires at: ${auth.expiresAt ? new Date(auth.expiresAt * 1000).toISOString() : 'unknown'}`
			)
			console.log(`   Scopes: ${auth.scopes.join(', ')}`)
		} else if (config.refreshToken) {
			// Fallback to refresh token if provided
			oauth2Client = new google.auth.OAuth2()
			oauth2Client.setCredentials({
				refresh_token: config.refreshToken,
			})
			console.log('[SERVER DEBUG] Using refresh token authentication (fallback)')
		} else {
			// No authentication - will need to use refresh token from config
			oauth2Client = new google.auth.OAuth2()
			console.warn('[SERVER DEBUG] WARNING: No OAuth credentials available')
			console.warn('[SERVER DEBUG] Tools will fail unless you provide a refreshToken in config')
			console.warn(
				'[SERVER DEBUG] Get a refresh token from: https://developers.google.com/oauthplayground'
			)
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

// OAuth DISABLED - Reaching out to Smithery developers about infinite loop issue
// The Smithery SDK's requireBearerAuth middleware blocks initial MCP connections
// causing infinite loops during playground registration/initialization
console.log('[SERVER DEBUG] OAuth is DISABLED - contacting Smithery developers')
console.log('[SERVER DEBUG] Issue: requireBearerAuth blocks MCP initialize method')
console.log('[SERVER DEBUG] To re-enable: uncomment the oauth export below')
// export const oauth: OAuthProvider = new GoogleCalendarOAuthProvider()
