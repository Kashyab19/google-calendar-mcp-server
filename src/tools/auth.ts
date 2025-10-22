import crypto from 'node:crypto'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { Auth } from 'googleapis'
import { z } from 'zod'
import {
	getAuthErrorPage,
	getAuthFailedPage,
	getAuthSuccessPage,
} from '../components/auth-pages.js'
import type {
	AuthTokens,
	CallbackServer,
	OAuth2ClientCredentials,
	OAuth2ClientData,
	OAuth2ClientRegistration,
} from '../types/auth.js'

export function registerAuthTools(server: McpServer, oauth2Client: Auth.OAuth2Client) {
	// OAuth 2.1: Automatic authentication with popup support
	server.tool(
		'authenticate',
		'Automatically authenticate with Google Calendar using OAuth 2.1 with popup support',
		{
			scopes: z
				.array(z.string())
				.optional()
				.default([
					'https://www.googleapis.com/auth/calendar',
					'https://www.googleapis.com/auth/calendar.events',
				])
				.describe('OAuth2 scopes to request (default: full calendar access)'),
			access_type: z
				.enum(['online', 'offline'])
				.optional()
				.default('offline')
				.describe("Access type - 'offline' gets refresh token"),
		},
		async ({ scopes, access_type: _access_type }) => {
			try {
				// OAuth 2.1: Automatic authentication
				const authServerUrl =
					process.env.OAUTH21_AUTH_SERVER_URL ||
					'https://google-auth-server-production-990d.up.railway.app'
				const resourceId = process.env.OAUTH21_RESOURCE_ID || 'https://smithery.ai'

				// Check if auth server is running
				try {
					const response = await fetch(`${authServerUrl}/.well-known/oauth-authorization-server`)
					if (!response.ok) {
						throw new Error('Auth server not responding')
					}
				} catch (_error) {
					return {
						content: [
							{
								type: 'text',
								text: `OAuth 2.1 Auth Server is not running. Please start it first:\n\n\`cd auth-server && npm run dev\``,
							},
						],
					}
				}

				// Perform OAuth 2.1 flow
				try {
					// Step 1: Register client dynamically
					const clientRegistrationResponse = await fetch(`${authServerUrl}/register`, {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							client_name: 'Smithery Playground Client',
							redirect_uris: ['https://smithery.ai/playground/callback'],
							grant_types: ['authorization_code', 'refresh_token'],
							response_types: ['code'],
						} as OAuth2ClientRegistration),
					})

					if (!clientRegistrationResponse.ok) {
						throw new Error('Failed to register OAuth 2.1 client')
					}

					const clientData = (await clientRegistrationResponse.json()) as OAuth2ClientData
					const clientId = clientData.client_id

					// Step 2: Generate PKCE parameters
					const codeVerifier = generateCodeVerifier()
					const codeChallenge = await generateCodeChallenge(codeVerifier)
					const state = generateRandomString()

					// Step 3: Build authorization URL
					const authUrl = new URL(`${authServerUrl}/authorize`)
					authUrl.searchParams.set('client_id', clientId)
					authUrl.searchParams.set('response_type', 'code')
					authUrl.searchParams.set('redirect_uri', 'https://smithery.ai/playground/callback')
					authUrl.searchParams.set('scope', scopes.join(' '))
					authUrl.searchParams.set('state', state)
					authUrl.searchParams.set('code_challenge', codeChallenge)
					authUrl.searchParams.set('code_challenge_method', 'S256')
					authUrl.searchParams.set('resource', resourceId)

					// Step 4: Try to open browser with popup support
					try {
						const { exec } = await import('node:child_process')
						const { promisify } = await import('node:util')
						const execAsync = promisify(exec)

						// Use Smithery's browser opening logic
						const platform = process.platform
						let command: string

						switch (platform) {
							case 'darwin': // macOS
								command = `open "${authUrl.toString()}"`
								break
							case 'win32': // Windows
								command = `start "" "${authUrl.toString()}"`
								break
							default: // Linux and others
								command = `xdg-open "${authUrl.toString()}"`
								break
						}

						await execAsync(command)

						// Start callback server
						let callbackServer: CallbackServer
						try {
							callbackServer = await _startCallbackServer()
						} catch (error) {
							throw new Error(
								`Failed to start callback server: ${error instanceof Error ? error.message : String(error)}`
							)
						}

						// Wait for callback
						let authCode: string
						try {
							authCode = await _waitForCallback(callbackServer, state)
						} catch (error) {
							// Ensure server is closed on error
							try {
								callbackServer.close()
							} catch (closeError) {
								console.error('Error closing callback server:', closeError)
							}
							throw error
						}

						// Step 5: Exchange code for tokens
						const tokenResponse = await fetch(`${authServerUrl}/token`, {
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({
								grant_type: 'authorization_code',
								code: authCode,
								redirect_uri: 'https://smithery.ai/playground/callback',
								client_id: clientId,
								code_verifier: codeVerifier,
								resource: resourceId,
							}),
						})

						if (!tokenResponse.ok) {
							throw new Error('Failed to exchange authorization code for tokens')
						}

						const tokens = (await tokenResponse.json()) as AuthTokens

						// Get the actual Google tokens from the auth server
						const googleTokensResponse = await fetch(`${authServerUrl}/google-tokens`, {
							method: 'GET',
							headers: {
								Authorization: `Bearer ${tokens.access_token}`,
							},
						})

						if (!googleTokensResponse.ok) {
							const errorText = await googleTokensResponse.text()
							throw new Error(`Failed to get Google tokens: ${errorText}`)
						}

						const googleTokens = (await googleTokensResponse.json()) as AuthTokens

						// Store the actual Google tokens in OAuth2 client
						oauth2Client.setCredentials({
							access_token: googleTokens.access_token,
							refresh_token: googleTokens.refresh_token,
							token_type: googleTokens.token_type,
							expiry_date: googleTokens.expiry_date,
						} as OAuth2ClientCredentials)

						return {
							content: [
								{
									type: 'text',
									text: `# OAuth 2.1 Authentication Successful!

**Authentication Complete!** You are now authenticated with Google Calendar.

## Token Information
- **Access Token**: Present
- **Refresh Token**: Present  
- **Expires In**: ${(tokens as { expires_in?: number }).expires_in || 'Unknown'} seconds

## Available Tools
- \`list_calendars\` - List your calendars
- \`list_events\` - List calendar events
- \`create_event\` - Create new events
- \`create_event_now\` - Create events starting now
- \`update_event\` - Update existing events
- \`delete_event\` - Delete events by name/details
- \`get_current_time\` - Get current system time

**You're ready to use Google Calendar!**`,
								},
							],
						}
					} catch (browserError) {
						// Fallback to manual flow if browser opening fails
						return {
							content: [
								{
									type: 'text',
									text: `# Manual Authentication Required

**Browser popup failed, but you can still authenticate manually:**

**Step 1: Click the link below to authorize access to your Google Calendar:**

**[Authorize with Google](${authUrl.toString()})**

**Step 2: After authorization, you'll be redirected to a callback page. Copy the authorization code from the URL and use the \`complete_authentication\` tool with that code.**

## What happens next:
1. Click the authorization link above
2. Sign in with your Google account
3. Review and approve the permissions
4. You'll be redirected to a callback page with an authorization code
5. Copy the code from the URL and use \`complete_authentication\` tool

---
**Direct URL:** \`${authUrl.toString()}\`

**Note:** The automatic popup failed (${browserError instanceof Error ? browserError.message : String(browserError)}), but manual authentication will work perfectly!`,
								},
							],
						}
					}
				} catch (authError: unknown) {
					return {
						content: [
							{
								type: 'text',
								text: `OAuth 2.1 Authentication failed: ${authError instanceof Error ? authError.message : String(authError)}`,
							},
						],
					}
				}
			} catch (e: unknown) {
				return {
					content: [
						{
							type: 'text',
							text: `Error in OAuth 2.1 flow: ${e instanceof Error ? e.message : String(e)}`,
						},
					],
				}
			}
		}
	)

	// Simple authentication check - Smithery handles OAuth automatically!
	server.tool(
		'check_authentication',
		'Check if you are already authenticated with Google Calendar via Smithery',
		{},
		async () => {
			try {
				const credentials = oauth2Client.credentials

				if (!credentials.access_token && !credentials.refresh_token) {
					return {
						content: [
							{
								type: 'text',
								text: `# Authentication Required

**You need to authenticate with Google Calendar first.**

## How to authenticate:

### Option 1: Use Smithery's Built-in OAuth (Recommended)
1. **Go to your Smithery settings**
2. **Connect your Google account** 
3. **Grant calendar permissions**
4. **Return here** - authentication will be automatic!

### Option 2: Manual Authentication
If Smithery OAuth isn't available, use the manual flow:
1. Use \`start_manual_auth\` to get an authorization URL
2. Complete the OAuth flow manually
3. Use \`complete_authentication\` with the authorization code

## Current Status
- **Access Token**: Not available
- **Refresh Token**: Not available
- **Status**: Not authenticated

**Try the Smithery OAuth first - it's much easier!**`,
							},
						],
					}
				}

				const hasRefreshToken = !!credentials.refresh_token
				const accessTokenExpiry = credentials.expiry_date ? new Date(credentials.expiry_date) : null
				const isExpired = accessTokenExpiry ? accessTokenExpiry < new Date() : false

				return {
					content: [
						{
							type: 'text',
							text: `# Already Authenticated!

**Great! You're already authenticated with Google Calendar.**

## Authentication Status
- **Access Token**: ${credentials.access_token ? 'Present' : 'Missing'}
- **Refresh Token**: ${hasRefreshToken ? 'Present' : 'Missing'}
- **Token Type**: ${credentials.token_type || 'Bearer'}

## Token Health
${
	accessTokenExpiry
		? `- **Expires**: ${accessTokenExpiry.toISOString()}
- **Status**: ${isExpired ? 'Expired' : 'Valid'}`
		: '- **Expiry**: Unknown'
}

## Available Tools
- \`list_calendars\` - List your calendars
- \`list_events\` - List calendar events  
- \`create_event\` - Create new events
- \`create_event_now\` - Create events starting now
- \`update_event\` - Update existing events
- \`delete_event\` - Delete events by name/details
- \`get_current_time\` - Get current system time

**You're ready to use Google Calendar!**`,
						},
					],
				}
			} catch (e: unknown) {
				return {
					content: [
						{
							type: 'text',
							text: `Error checking authentication: ${e instanceof Error ? e.message : String(e)}`,
						},
					],
				}
			}
		}
	)

	// Tool: Start Manual Authentication (Fallback)
	server.tool(
		'start_manual_auth',
		'Start manual OAuth authentication if Smithery OAuth is not available',
		{
			scopes: z
				.array(z.string())
				.optional()
				.default([
					'https://www.googleapis.com/auth/calendar',
					'https://www.googleapis.com/auth/calendar.events',
				])
				.describe('OAuth2 scopes to request (default: full calendar access)'),
		},
		async ({ scopes }) => {
			try {
				const authServerUrl =
					process.env.OAUTH21_AUTH_SERVER_URL ||
					'https://google-auth-server-production-990d.up.railway.app'
				const resourceId = process.env.OAUTH21_RESOURCE_ID || 'https://smithery.ai'

				// Register client dynamically
				const clientRegistrationResponse = await fetch(`${authServerUrl}/register`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						client_name: 'Smithery Manual Auth Client',
						redirect_uris: ['https://smithery.ai/playground/callback'],
						grant_types: ['authorization_code', 'refresh_token'],
						response_types: ['code'],
					} as OAuth2ClientRegistration),
				})

				if (!clientRegistrationResponse.ok) {
					throw new Error('Failed to register OAuth client')
				}

				const clientData = (await clientRegistrationResponse.json()) as OAuth2ClientData
				const clientId = clientData.client_id

				// Generate PKCE parameters
				const codeVerifier = generateCodeVerifier()
				const codeChallenge = await generateCodeChallenge(codeVerifier)
				const state = generateRandomString()

				// Build authorization URL
				const authUrl = new URL(`${authServerUrl}/authorize`)
				authUrl.searchParams.set('client_id', clientId)
				authUrl.searchParams.set('response_type', 'code')
				authUrl.searchParams.set('redirect_uri', 'https://smithery.ai/playground/callback')
				authUrl.searchParams.set('scope', scopes.join(' '))
				authUrl.searchParams.set('state', state)
				authUrl.searchParams.set('code_challenge', codeChallenge)
				authUrl.searchParams.set('code_challenge_method', 'S256')
				authUrl.searchParams.set('resource', resourceId)

				return {
					content: [
						{
							type: 'text',
							text: `# Manual Authentication

**Step 1: Click the link below to authorize access to your Google Calendar:**

**[Authorize with Google](${authUrl.toString()})**

**Step 2: After authorization, you'll be redirected to a callback page. Copy the authorization code from the URL and use the \`complete_authentication\` tool with that code.**

## What happens next:
1. Click the authorization link above
2. Sign in with your Google account  
3. Review and approve the permissions
4. You'll be redirected to a callback page with an authorization code
5. Copy the code from the URL and use \`complete_authentication\` tool

---
**Direct URL:** \`${authUrl.toString()}\``,
						},
					],
				}
			} catch (error: unknown) {
				return {
					content: [
						{
							type: 'text',
							text: `Manual authentication setup failed: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
				}
			}
		}
	)

	// Tool: Exchange Authorization Code
	server.tool(
		'exchange_auth_code',
		'Exchange authorization code for access and refresh tokens. Use this after user has authorized via the OAuth URL.',
		{
			auth_code: z.string().describe('Authorization code received from OAuth redirect'),
		},
		async ({ auth_code }) => {
			try {
				const { tokens } = await oauth2Client.getToken(auth_code)
				oauth2Client.setCredentials(tokens)

				const markdown = `# OAuth2 Token Exchange Successful

	## Access Token
	- **Expires:** ${tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : 'Unknown'}
	- **Type:** ${tokens.token_type || 'Bearer'}

	## Refresh Token
	${
		tokens.refresh_token
			? `
	**Refresh Token:** \`${tokens.refresh_token}\`

	**IMPORTANT:** Save this refresh token securely! You can use it in your MCP configuration to avoid re-authorization:

	\`\`\`json
	{
	"refreshToken": "${tokens.refresh_token}"
	}
	\`\`\`
	`
			: "**WARNING:** No refresh token received. This may happen if you've previously authorized this application. To get a new refresh token, revoke access at https://myaccount.google.com/connections and re-authorize."
	}

	## Next Steps
	- Your Google Calendar MCP server is now authenticated and ready to use
	- Use calendar and event tools to interact with your Google Calendar
	- The access token will be automatically refreshed when needed`

				return {
					content: [{ type: 'text', text: markdown }],
				}
			} catch (e: unknown) {
				return {
					content: [
						{
							type: 'text',
							text: `Error exchanging authorization code: ${e instanceof Error ? e.message : String(e)}`,
						},
					],
				}
			}
		}
	)

	// Tool: Complete Authentication
	server.tool(
		'complete_authentication',
		'Complete OAuth 2.1 authentication using authorization code from callback',
		{
			auth_code: z.string().describe('Authorization code received from OAuth callback URL'),
		},
		async ({ auth_code }) => {
			try {
				const authServerUrl =
					process.env.OAUTH21_AUTH_SERVER_URL ||
					'https://google-auth-server-production-990d.up.railway.app'
				const resourceId = process.env.OAUTH21_RESOURCE_ID || 'https://smithery.ai'

				// Exchange authorization code for tokens
				const tokenResponse = await fetch(`${authServerUrl}/token`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						grant_type: 'authorization_code',
						code: auth_code,
						redirect_uri: 'https://smithery.ai/playground/callback',
						client_id: 'smithery-mcp-client', // Use a default client ID
						resource: resourceId,
					}),
				})

				if (!tokenResponse.ok) {
					const errorText = await tokenResponse.text()
					throw new Error(`Failed to exchange authorization code: ${errorText}`)
				}

				const tokens = (await tokenResponse.json()) as AuthTokens

				// Get the actual Google tokens from the auth server
				const googleTokensResponse = await fetch(`${authServerUrl}/google-tokens`, {
					method: 'GET',
					headers: {
						Authorization: `Bearer ${tokens.access_token}`,
					},
				})

				if (!googleTokensResponse.ok) {
					const errorText = await googleTokensResponse.text()
					throw new Error(`Failed to get Google tokens: ${errorText}`)
				}

				const googleTokens = (await googleTokensResponse.json()) as AuthTokens

				// Store the actual Google tokens in OAuth2 client
				oauth2Client.setCredentials({
					access_token: googleTokens.access_token,
					refresh_token: googleTokens.refresh_token,
					token_type: googleTokens.token_type,
					expiry_date: googleTokens.expiry_date,
				} as OAuth2ClientCredentials)

				return {
					content: [
						{
							type: 'text',
							text: `# OAuth 2.1 Authentication Successful!

**Authentication Complete!** You are now authenticated with Google Calendar.

## Token Information
- **Access Token**: Present
- **Refresh Token**: Present  
- **Expires In**: ${(tokens as { expires_in?: number }).expires_in || 'Unknown'} seconds

## Available Tools
- \`list_calendars\` - List your calendars
- \`list_events\` - List calendar events
- \`create_event\` - Create new events
- \`create_event_now\` - Create events starting now
- \`update_event\` - Update existing events
- \`delete_event\` - Delete events by name/details
- \`get_current_time\` - Get current system time

**You're ready to use Google Calendar!**`,
						},
					],
				}
			} catch (error: unknown) {
				return {
					content: [
						{
							type: 'text',
							text: `Authentication failed: ${error instanceof Error ? error.message : String(error)}`,
						},
					],
				}
			}
		}
	)

	// Tool: Check Authentication Status
	server.tool(
		'check_auth_status',
		'Check the current authentication status and token information',
		{},
		async () => {
			try {
				const credentials = oauth2Client.credentials

				// Debug: Log current credentials
				console.log('check_auth_status - Current credentials:', {
					hasAccessToken: !!credentials.access_token,
					hasRefreshToken: !!credentials.refresh_token,
					expiryDate: credentials.expiry_date,
				})

				if (!credentials.access_token && !credentials.refresh_token) {
					return {
						content: [
							{
								type: 'text',
								text: `# Authentication Status: Not Authenticated

	**Status:** No tokens available

	## Next Steps:
	1. Use \`generate_oauth_url\` to get authorization URL
	2. Visit the URL and authorize the application
	3. Use \`exchange_auth_code\` with the received code`,
							},
						],
					}
				}

				const hasRefreshToken = !!credentials.refresh_token
				const accessTokenExpiry = credentials.expiry_date ? new Date(credentials.expiry_date) : null
				const isExpired = accessTokenExpiry ? accessTokenExpiry < new Date() : false

				const markdown = `# Authentication Status: ${hasRefreshToken ? 'Authenticated' : 'Partially Authenticated'}

	## Token Information
	- **Access Token:** ${credentials.access_token ? 'Present' : 'Missing'}
	- **Refresh Token:** ${hasRefreshToken ? 'Present' : 'Missing'}
	- **Token Type:** ${credentials.token_type || 'Bearer'}

	## Access Token Status
	${
		accessTokenExpiry
			? `- **Expires:** ${accessTokenExpiry.toISOString()}
	- **Status:** ${isExpired ? 'Expired' : 'Valid'}`
			: '- **Expiry:** Unknown'
	}

	## Authentication Health
	${
		hasRefreshToken
			? '**Fully Authenticated** - Can access Google Calendar indefinitely'
			: '**Limited Authentication** - May need re-authorization when access token expires'
	}

	${
		!hasRefreshToken
			? `
	## Recommendation
	Consider re-authorizing with \`access_type: "offline"\` to get a refresh token for permanent access.
	`
			: ''
	}`

				return {
					content: [{ type: 'text', text: markdown }],
				}
			} catch (e: unknown) {
				return {
					content: [
						{
							type: 'text',
							text: `Error checking authentication status: ${e instanceof Error ? e.message : String(e)}`,
						},
					],
				}
			}
		}
	)
}

// Helper functions for OAuth 2.1 PKCE flow
function generateCodeVerifier(): string {
	return crypto.randomBytes(32).toString('base64url')
}

async function generateCodeChallenge(verifier: string): Promise<string> {
	const hash = crypto.createHash('sha256').update(verifier).digest()
	return hash.toString('base64url')
}

function generateRandomString(): string {
	return crypto.randomBytes(16).toString('hex')
}

async function _startCallbackServer(): Promise<any> {
	const express = await import('express')
	const app = express.default()

	// Add basic middleware
	app.use(express.default.json())
	app.use(express.default.urlencoded({ extended: true }))

	const server = app.listen(8081, 'localhost')

	return new Promise((resolve, reject) => {
		server.on('listening', () => {
			console.log('Callback server listening on http://localhost:8081')
			resolve(server)
		})

		server.on('error', (error) => {
			console.error('Callback server error:', error)
			reject(error)
		})
	})
}

async function _waitForCallback(server: any, expectedState: string): Promise<string> {
	return new Promise((resolve, reject) => {
		let isResolved = false
		const timeout = setTimeout(
			() => {
				if (!isResolved) {
					server.close()
					reject(new Error('Authentication timeout - no callback received'))
				}
			},
			5 * 60 * 1000
		) // 5 minutes

		server.on(
			'request',
			(req: import('http').IncomingMessage, res: import('http').ServerResponse) => {
				// Prevent multiple responses
				if (isResolved) {
					res.writeHead(400, { 'Content-Type': 'text/plain' })
					res.end('Request already processed')
					return
				}

				if (req.url?.startsWith('/callback')) {
					const serverAddress = server.address()
					console.log('serverAddress', serverAddress)
					const port =
						serverAddress && typeof serverAddress === 'object' ? serverAddress.port : 8081
					const url = new URL(req.url || '', `http://localhost:${port}`)
					const code = url.searchParams.get('code')
					const state = url.searchParams.get('state')
					const error = url.searchParams.get('error')

					clearTimeout(timeout)
					isResolved = true

					if (error) {
						try {
							res.writeHead(400, { 'Content-Type': 'text/html' })
							res.end(getAuthErrorPage(error))
						} catch (e) {
							console.error('Error sending error response:', e)
						}
						server.close()
						reject(new Error(`OAuth error: ${error}`))
						return
					}

					if (!code || state !== expectedState) {
						try {
							res.writeHead(400, { 'Content-Type': 'text/html' })
							res.end(getAuthFailedPage())
						} catch (e) {
							console.error('Error sending failed response:', e)
						}
						server.close()
						reject(new Error('Invalid authorization code or state mismatch'))
						return
					}

					try {
						res.writeHead(200, { 'Content-Type': 'text/html' })
						res.end(getAuthSuccessPage())
					} catch (e) {
						console.error('Error sending success response:', e)
					}
					server.close()
					resolve(code)
				} else {
					// Handle non-callback requests
					res.writeHead(404, { 'Content-Type': 'text/plain' })
					res.end('Not found')
				}
			}
		)
	})
}
