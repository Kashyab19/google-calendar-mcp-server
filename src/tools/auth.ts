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
	OAuth2ClientData,
	OAuth2ClientRegistration,
} from '../types/auth.js'

export function registerAuthTools(server: McpServer, oauth2Client: Auth.OAuth2Client) {
	// OAuth 2.1: Provide automatic authentication
	server.tool(
		'authenticate',
		'Automatically authenticate with Google Calendar using Single Sign-On',
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

					// Step 4: Return authorization URL for Smithery environment
					// In Smithery, we can't open browser or start callback server
					// Instead, return the URL for manual authorization
					return {
						content: [
							{
								type: 'text',
								text: `# OAuth 2.1 Authorization Required

**Please complete the authorization process:**

1. **Click this link to authorize:** [Authorize with Google](${authUrl.toString()})

2. **After authorization**, you'll be redirected to Smithery's callback page

3. **The MCP server will automatically receive your tokens** and you'll be authenticated

**Note:** This is a one-time setup. Once authenticated, you won't need to repeat this process.

**Authorization URL:** \`${authUrl.toString()}\``,
							},
						],
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
