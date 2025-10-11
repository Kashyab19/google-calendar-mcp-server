import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js'
import type { OAuthProvider } from '@smithery/sdk'
import type { Response } from 'express'

// Required scopes for Google Calendar
const REQUIRED_SCOPES = [
	'https://www.googleapis.com/auth/calendar',
	'https://www.googleapis.com/auth/calendar.events',
]

// OAuth 2.1 Auth Server configuration
const AUTH_SERVER_URL = process.env.OAUTH21_AUTH_SERVER_URL || 'http://localhost:3080'
const REDIRECT_URI = process.env.OAUTH_REDIRECT_URI || 'https://smithery.ai/playground/callback'

// Validate auth server URL at startup
console.log('[OAUTH-PROVIDER] Auth Server URL:', AUTH_SERVER_URL)
if (!AUTH_SERVER_URL.startsWith('http')) {
	console.error(
		'[OAUTH-PROVIDER] ERROR: Invalid AUTH_SERVER_URL. Must start with http:// or https://'
	)
}

/**
 * Google Calendar OAuth Provider for Smithery MCP
 *
 * Delegates all OAuth operations to our OAuth 2.1 Auth Server.
 * Implements OAuth 2.1 with PKCE (S256) as required by Smithery.
 * Follows the MCP Authorization specification for secure token handling.
 */
export class GoogleCalendarOAuthProvider implements OAuthProvider {
	private readonly authServerUrl: string
	private readonly redirectUri: string
	private registeredClients: Map<string, any> = new Map()

	constructor() {
		this.authServerUrl = AUTH_SERVER_URL
		this.redirectUri = REDIRECT_URI

		console.log(`[OAUTH-PROVIDER] Initialized with OAuth 2.1 Auth Server`)
		console.log(`   Auth Server URL: ${this.authServerUrl}`)
		console.log(`   Redirect URI: ${this.redirectUri}`)
		console.log(`   Scopes: ${REQUIRED_SCOPES.join(', ')}`)
		console.log(`   Delegating to OAuth 2.1 Auth Server`)
	}

	get clientsStore() {
		return {
			getClient: (clientId: string) => {
				console.log(`[OAUTH-PROVIDER] Getting client: ${clientId}`)

				// Return existing client or create a default one
				let client = this.registeredClients.get(clientId)
				if (!client) {
					client = {
						client_id: clientId,
						client_name: 'Google Calendar MCP',
						redirect_uris: [this.redirectUri],
						grant_types: ['authorization_code', 'refresh_token'],
						response_types: ['code'],
						scope: REQUIRED_SCOPES.join(' '),
						token_endpoint_auth_method: 'none', // PKCE for public clients
						created_at: new Date(),
					}
					this.registeredClients.set(clientId, client)
				}

				return client
			},
			registerClient: async (client: any) => {
				console.log(`[OAUTH-PROVIDER] Registering client: ${client.client_id}`)

				// Don't delegate to auth server - handle locally and register on-demand
				// The auth server will accept dynamic clients during the authorize flow
				const localClient = {
					client_id: client.client_id,
					client_name: 'Google Calendar MCP',
					redirect_uris: [this.redirectUri],
					grant_types: ['authorization_code', 'refresh_token'],
					response_types: ['code'],
					scope: REQUIRED_SCOPES.join(' '),
					token_endpoint_auth_method: 'none',
					created_at: new Date(),
				}

				this.registeredClients.set(client.client_id, localClient)
				console.log(`[OAUTH-PROVIDER] Client registered locally: ${localClient.client_id}`)

				return localClient
			},
		}
	}

	async authorize(client: any, params: any, res: Response): Promise<void> {
		console.log(`[OAUTH-PROVIDER] Starting authorization via OAuth 2.1 Auth Server`)
		console.log(`   Client: ${client.client_id}`)
		console.log(`   Redirect URI: ${params.redirectUri}`)
		console.log(`   Scopes: ${params.scopes?.join(' ') || REQUIRED_SCOPES.join(' ')}`)

		// Ensure auth server URL has protocol
		let authServerUrl = this.authServerUrl
		if (!authServerUrl.startsWith('http://') && !authServerUrl.startsWith('https://')) {
			console.warn(
				`[OAUTH-PROVIDER] Auth server URL missing protocol, adding http://: ${authServerUrl}`
			)
			authServerUrl = `http://${authServerUrl}`
		}

		// Build authorization URL for our OAuth 2.1 auth server
		const authUrl = new URL(`${authServerUrl}/authorize`)
		authUrl.searchParams.set('client_id', client.client_id)
		authUrl.searchParams.set('response_type', 'code')
		authUrl.searchParams.set('redirect_uri', params.redirectUri)
		authUrl.searchParams.set('scope', params.scopes?.join(' ') || REQUIRED_SCOPES.join(' '))
		authUrl.searchParams.set('state', params.state || '')
		authUrl.searchParams.set('code_challenge', params.codeChallenge)
		authUrl.searchParams.set('code_challenge_method', 'S256')
		if (params.resource) {
			authUrl.searchParams.set('resource', params.resource.toString())
		}

		console.log(`[OAUTH-PROVIDER] Redirecting to OAuth 2.1 Auth Server: ${authUrl.toString()}`)
		res.redirect(authUrl.toString())
	}

	async challengeForAuthorizationCode(_client: any, authorizationCode: string): Promise<string> {
		console.log(`[OAUTH-PROVIDER] Challenge for authorization code: ${authorizationCode}`)

		// Return a placeholder - the OAuth 2.1 auth server will handle PKCE validation
		return 'code_challenge_placeholder'
	}

	async exchangeAuthorizationCode(
		client: any,
		authorizationCode: string,
		codeVerifier?: string,
		redirectUri?: string,
		resource?: URL
	): Promise<any> {
		console.log(`[OAUTH-PROVIDER] Exchanging authorization code via OAuth 2.1 Auth Server`)
		console.log(`   Code: ${authorizationCode.substring(0, 10)}...`)
		console.log(`   Code Verifier: ${codeVerifier ? 'PROVIDED' : 'MISSING'}`)

		try {
			// Exchange authorization code for tokens via our OAuth 2.1 auth server
			const response = await fetch(`${this.authServerUrl}/token`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					grant_type: 'authorization_code',
					code: authorizationCode,
					client_id: client.client_id,
					redirect_uri: redirectUri,
					code_verifier: codeVerifier,
					resource: resource?.toString(),
				}),
				signal: AbortSignal.timeout(10000), // 10 second timeout
			})

			if (!response.ok) {
				const errorText = await response.text()
				console.error(`[OAUTH-PROVIDER] Token exchange failed: ${response.status} ${errorText}`)
				throw new Error(`Token exchange failed: ${response.status}`)
			}

			const tokenResponse = (await response.json()) as {
				access_token: string
				token_type?: string
				expires_in?: number
				scope?: string
				refresh_token?: string
			}

			console.log(`[OAUTH-PROVIDER] Token exchange successful`)
			console.log(`   Token type: ${tokenResponse.token_type}`)
			console.log(`   Expires in: ${tokenResponse.expires_in}s`)
			console.log(`   Has refresh token: ${tokenResponse.refresh_token ? 'YES' : 'NO'}`)

			return {
				access_token: tokenResponse.access_token,
				token_type: tokenResponse.token_type || 'Bearer',
				expires_in: tokenResponse.expires_in,
				scope: tokenResponse.scope,
				refresh_token: tokenResponse.refresh_token,
			}
		} catch (error) {
			console.error(`[OAUTH-PROVIDER] Token exchange error:`, error)
			if (
				error instanceof Error &&
				(error.name === 'AbortError' || error.message.includes('fetch'))
			) {
				console.error(`[OAUTH-PROVIDER] Cannot reach auth server at ${this.authServerUrl}`)
				throw new Error('Auth server not accessible. Please start the auth-server first.')
			}
			throw error
		}
	}

	async exchangeRefreshToken(
		client: any,
		refreshToken: string,
		scopes?: string[],
		resource?: URL
	): Promise<any> {
		console.log(`[OAUTH-PROVIDER] Refreshing access token via OAuth 2.1 Auth Server`)

		try {
			// Exchange refresh token for new access token via our OAuth 2.1 auth server
			const response = await fetch(`${this.authServerUrl}/token`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					grant_type: 'refresh_token',
					refresh_token: refreshToken,
					client_id: client.client_id,
					scope: scopes?.join(' '),
					resource: resource?.toString(),
				}),
			})

			if (!response.ok) {
				const errorText = await response.text()
				console.error(`[OAUTH-PROVIDER] Token refresh failed: ${response.status} ${errorText}`)
				throw new Error(`Token refresh failed: ${response.status}`)
			}

			const tokenResponse = (await response.json()) as {
				access_token: string
				token_type?: string
				expires_in?: number
				scope?: string
				refresh_token?: string
			}

			console.log(`[OAUTH-PROVIDER] Token refresh successful`)

			return {
				access_token: tokenResponse.access_token,
				token_type: tokenResponse.token_type || 'Bearer',
				expires_in: tokenResponse.expires_in,
				scope: tokenResponse.scope,
				refresh_token: tokenResponse.refresh_token || refreshToken,
			}
		} catch (error) {
			console.error(`[OAUTH-PROVIDER] Token refresh error:`, error)
			throw error
		}
	}

	async revokeToken(client: any, request: any): Promise<void> {
		console.log(`[OAUTH-PROVIDER] Revoking token via OAuth 2.1 Auth Server`)

		try {
			// Revoke token via our OAuth 2.1 auth server
			const response = await fetch(`${this.authServerUrl}/revoke`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					token: request.token,
					token_type_hint: request.token_type_hint,
					client_id: client.client_id,
				}),
			})

			if (!response.ok) {
				console.error(`[OAUTH-PROVIDER] Token revocation failed: ${response.status}`)
			} else {
				console.log(`[OAUTH-PROVIDER] Token revoked successfully`)
			}
		} catch (error) {
			console.error(`[OAUTH-PROVIDER] Token revocation error:`, error)
		}
	}

	async verifyAccessToken(token: string): Promise<AuthInfo> {
		console.log(`[OAUTH-PROVIDER] Verifying access token`)

		// Allow guest/anonymous access for initial MCP connection
		// The Smithery playground needs to connect before OAuth flow completes
		if (token === 'guest' || token === 'anonymous' || token === 'mcp-init') {
			console.log(`[OAUTH-PROVIDER] Guest token detected - allowing anonymous read-only access`)
			console.warn(`[OAUTH-PROVIDER] WARNING: Tools requiring authentication will fail`)
			return {
				token: 'guest',
				clientId: 'anonymous',
				scopes: [], // No scopes for guest users
				expiresAt: Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60, // 1 year (never expires)
			}
		}

		// For real tokens, verify via OAuth 2.1 auth server
		console.log(`[OAUTH-PROVIDER] Verifying real access token via OAuth 2.1 Auth Server`)

		try {
			// Ensure auth server URL has protocol
			let authServerUrl = this.authServerUrl
			if (!authServerUrl.startsWith('http://') && !authServerUrl.startsWith('https://')) {
				authServerUrl = `http://${authServerUrl}`
			}

			const response = await fetch(`${authServerUrl}/verify`, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${token}`,
					'Content-Type': 'application/json',
				},
				signal: AbortSignal.timeout(5000), // 5 second timeout
			})

			if (!response.ok) {
				console.error(`[OAUTH-PROVIDER] Token verification failed: ${response.status}`)
				const errorText = await response.text().catch(() => 'Unknown error')
				console.error(`[OAUTH-PROVIDER] Error details: ${errorText}`)
				throw new Error('Token verification failed')
			}

			const tokenInfo = (await response.json()) as {
				client_id?: string
				scope?: string
				exp?: number
				iat?: number
				sub?: string
				aud?: string
			}

			console.log(`[OAUTH-PROVIDER] Token verification successful`)
			console.log(`   Client ID: ${tokenInfo.client_id}`)
			console.log(`   Subject: ${tokenInfo.sub}`)
			console.log(`   Scopes: ${tokenInfo.scope}`)

			return {
				token,
				clientId: tokenInfo.client_id || 'unknown',
				scopes: tokenInfo.scope ? tokenInfo.scope.split(' ') : REQUIRED_SCOPES,
				expiresAt: tokenInfo.exp || Math.floor(Date.now() / 1000) + 3600,
			}
		} catch (error) {
			console.error('[OAUTH-PROVIDER] Token verification error:', error)
			if (error instanceof Error) {
				if (error.name === 'AbortError' || error.message.includes('fetch')) {
					console.error(`[OAUTH-PROVIDER] Cannot reach auth server at ${this.authServerUrl}`)
					console.error('[OAUTH-PROVIDER] Make sure your auth-server is running!')
					throw new Error('Auth server not accessible. Please start the auth-server first.')
				}
			}
			throw new Error('Invalid or expired token')
		}
	}

	// Smithery OAuth provider properties
	basePath = '/oauth'
	callbackPath = '/callback'
	// Don't require scopes for initial connection - only for actual tool calls
	requiredScopes = [] // Empty = allow guest access

	// Resource metadata URL (tells clients where to find OAuth info)
	resourceMetadataUrl = undefined // Let Smithery auto-generate this

	// OAuth 2.1 compliance
	skipLocalPkceValidation = false // Enable PKCE validation
	skipDiscovery = true // Use our metadata() getter instead of external discovery

	// OAuth 2.1 Auth Server URLs (with protocol validation)
	private getFullAuthServerUrl(): string {
		let url = this.authServerUrl
		if (!url.startsWith('http://') && !url.startsWith('https://')) {
			url = `http://${url}`
		}
		return url
	}

	get authorizationUrl() {
		return `${this.getFullAuthServerUrl()}/authorize`
	}

	get tokenUrl() {
		return `${this.getFullAuthServerUrl()}/token`
	}

	get revocationUrl() {
		return `${this.getFullAuthServerUrl()}/revoke`
	}

	// OAuth metadata for our OAuth 2.1 Auth Server (bypasses discovery)
	get metadata() {
		return {
			issuer: this.getFullAuthServerUrl(),
			authorization_endpoint: this.authorizationUrl,
			token_endpoint: this.tokenUrl,
			revocation_endpoint: this.revocationUrl,
			response_types_supported: ['code'],
			grant_types_supported: ['authorization_code', 'refresh_token'],
			code_challenge_methods_supported: ['S256'],
			scopes_supported: REQUIRED_SCOPES,
			token_endpoint_auth_methods_supported: ['none'],
		}
	}
}
