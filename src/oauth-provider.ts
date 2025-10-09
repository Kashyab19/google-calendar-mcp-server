import crypto from 'node:crypto'

// OAuth 2.1 Configuration
const OAUTH21_CONFIG = {
	DEFAULT_AUTH_SERVER_URL: 'http://localhost:3080',
	DEFAULT_RESOURCE_ID: 'http://localhost:8081',
	DEFAULT_CALLBACK_URI: '/callback'
}

// Required scopes for Google Calendar
const REQUIRED_SCOPES = [
	'https://www.googleapis.com/auth/calendar',
	'https://www.googleapis.com/auth/calendar.events'
]

export class GoogleCalendarOAuthProvider {
	private authServerUrl: string
	private resourceId: string

	constructor() {
		// Use the auth server URL from environment, with fallback to localhost for local development
		// For production/Smithery deployment, use the ngrok URL
		this.authServerUrl = process.env.OAUTH21_AUTH_SERVER_URL || 
			(process.env.NODE_ENV === 'production' ? 'https://valery-uninsultable-subaggregately.ngrok-free.dev' : OAUTH21_CONFIG.DEFAULT_AUTH_SERVER_URL)

		// Use the Smithery resource ID from the environment or default
		this.resourceId = process.env.OAUTH21_RESOURCE_ID || process.env.SMITHERY_RESOURCE_ID || OAUTH21_CONFIG.DEFAULT_RESOURCE_ID

		console.log('OAuth Provider initialized with:')
		console.log(`  Auth Server URL: ${this.authServerUrl}`)
		console.log(`  Resource ID: ${this.resourceId}`)
	}

	// OAuth provider configuration for Smithery
	get authorizationUrl(): string {
		return `${this.authServerUrl}/authorize`
	}

	get tokenUrl(): string {
		return `${this.authServerUrl}/token`
	}

	get clientId(): string {
		return process.env.GOOGLE_CLIENT_ID || ''
	}

	get clientSecret(): string {
		return process.env.GOOGLE_CLIENT_SECRET || ''
	}

	get redirectUri(): string {
		return `${this.authServerUrl}/oauth/google/callback`
	}

	get scopes(): string[] {
		return REQUIRED_SCOPES
	}

	// Method to handle OAuth callback during initialization
	async handleCallback(code: string, state: string): Promise<any> {
		console.log('Handling OAuth callback during initialization...')
		
		try {
			// Exchange authorization code for tokens via your auth server
			const tokenResponse = await fetch(`${this.authServerUrl}/token`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
				},
				body: new URLSearchParams({
					grant_type: 'authorization_code',
					code: code,
					redirect_uri: this.redirectUri,
					client_id: this.clientId,
					client_secret: this.clientSecret,
				}),
			})

			if (!tokenResponse.ok) {
				throw new Error(`Token exchange failed: ${tokenResponse.status}`)
			}

			const tokens = await tokenResponse.json()
			console.log('✅ Successfully obtained tokens during initialization')
			
			return {
				access_token: tokens.access_token,
				refresh_token: tokens.refresh_token,
				token_type: tokens.token_type || 'Bearer',
				expires_in: tokens.expires_in,
			}
		} catch (error) {
			console.error('❌ OAuth callback handling failed:', error)
			throw error
		}
	}
}