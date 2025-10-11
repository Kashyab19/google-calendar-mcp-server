import type { AuthorizationRequest, ClientRegistration } from './types.js'

export class InMemoryStorage {
	private clients: Map<string, ClientRegistration> = new Map()
	private authorizationCodes: Map<
		string,
		AuthorizationRequest & { user_id: string; expires_at: Date }
	> = new Map()
	private refreshTokens: Map<
		string,
		{ user_id: string; client_id: string; scope: string; expires_at: Date }
	> = new Map()
	private authorizationRequests: Map<
		string,
		AuthorizationRequest & { googleState: string; expires_at: Date }
	> = new Map()
	private userTokens: Map<
		string,
		{ access_token: string; refresh_token?: string; token_type: string; expiry_date?: number }
	> = new Map()

	// Client Registration
	registerClient(
		clientData: Omit<ClientRegistration, 'client_id' | 'created_at'>
	): ClientRegistration {
		const client_id = this.generateClientId()
		const client: ClientRegistration = {
			...clientData,
			client_id,
			created_at: new Date(),
		}

		this.clients.set(client_id, client)
		return client
	}

	getClient(client_id: string): ClientRegistration | undefined {
		return this.clients.get(client_id)
	}

	storeClient(client: ClientRegistration): void {
		this.clients.set(client.client_id, client)
	}

	// Authorization Requests
	storeAuthorizationRequest(googleState: string, request: AuthorizationRequest): void {
		const expires_at = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
		this.authorizationRequests.set(googleState, {
			...request,
			googleState,
			expires_at,
		})
	}

	getAuthorizationRequest(
		googleState: string
	): (AuthorizationRequest & { googleState: string; expires_at: Date }) | undefined {
		const request = this.authorizationRequests.get(googleState)
		if (request && request.expires_at > new Date()) {
			return request
		}
		if (request) {
			this.authorizationRequests.delete(googleState)
		}
		return undefined
	}

	// Authorization Codes
	storeAuthorizationCode(code: string, request: AuthorizationRequest, user_id: string): void {
		const expires_at = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
		this.authorizationCodes.set(code, {
			...request,
			user_id,
			expires_at,
		})
	}

	getAuthorizationCode(
		code: string
	): (AuthorizationRequest & { user_id: string; expires_at: Date }) | undefined {
		const authCode = this.authorizationCodes.get(code)
		if (!authCode) return undefined

		if (authCode.expires_at < new Date()) {
			this.authorizationCodes.delete(code)
			return undefined
		}

		return authCode
	}

	consumeAuthorizationCode(
		code: string
	): (AuthorizationRequest & { user_id: string; expires_at: Date }) | undefined {
		const authCode = this.getAuthorizationCode(code)
		if (authCode) {
			this.authorizationCodes.delete(code)
		}
		return authCode
	}

	// Refresh Tokens
	storeRefreshToken(token: string, user_id: string, client_id: string, scope: string): void {
		const expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
		this.refreshTokens.set(token, {
			user_id,
			client_id,
			scope,
			expires_at,
		})
	}

	getRefreshToken(
		token: string
	): { user_id: string; client_id: string; scope: string; expires_at: Date } | undefined {
		const refreshToken = this.refreshTokens.get(token)
		if (!refreshToken) return undefined

		if (refreshToken.expires_at < new Date()) {
			this.refreshTokens.delete(token)
			return undefined
		}

		return refreshToken
	}

	revokeRefreshToken(token: string): void {
		this.refreshTokens.delete(token)
	}

	// Cleanup expired entries
	cleanup(): void {
		const now = new Date()

		// Clean expired authorization codes
		for (const [code, authCode] of this.authorizationCodes.entries()) {
			if (authCode.expires_at < now) {
				this.authorizationCodes.delete(code)
			}
		}

		// Clean expired refresh tokens
		for (const [token, refreshToken] of this.refreshTokens.entries()) {
			if (refreshToken.expires_at < now) {
				this.refreshTokens.delete(token)
			}
		}
	}

	private generateClientId(): string {
		return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
	}

	// User Tokens Management
	storeUserTokens(
		userId: string,
		tokens: {
			access_token: string
			refresh_token?: string
			token_type: string
			expiry_date?: number
		}
	): void {
		this.userTokens.set(userId, tokens)
	}

	getUserTokens(
		userId: string
	):
		| { access_token: string; refresh_token?: string; token_type: string; expiry_date?: number }
		| undefined {
		return this.userTokens.get(userId)
	}
}
