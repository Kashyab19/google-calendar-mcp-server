export interface AuthTokens {
	access_token: string
	refresh_token?: string
	token_type: string
	expiry_date?: number
	expires_in?: number
}

export interface OAuth2ClientCredentials {
	access_token?: string
	refresh_token?: string
	token_type?: string
	expiry_date?: number
}

export interface AuthServerConfig {
	authServerUrl: string
	resourceId: string
}

export interface PKCEParams {
	codeVerifier: string
	codeChallenge: string
	state: string
}

export interface OAuth2ClientRegistration {
	client_name: string
	redirect_uris: string[]
	grant_types: string[]
	response_types: string[]
}

export interface OAuth2ClientData {
	client_id: string
}

export interface CallbackServer {
	on: (
		event: string,
		handler: (req: import('http').IncomingMessage, res: import('http').ServerResponse) => void
	) => void
	close: () => void
	address: () => string | import('net').AddressInfo | null
}

export interface CallbackRequest {
	url?: string
	method?: string
	headers: Record<string, string | string[] | undefined>
}

export interface CallbackResponse {
	writeHead: (statusCode: number, headers?: Record<string, string>) => void
	end: (data: string) => void
}

export interface AuthStatus {
	isAuthenticated: boolean
	hasAccessToken: boolean
	hasRefreshToken: boolean
	expiryDate?: Date
	isExpired: boolean
}

export interface AuthError {
	code: number
	message: string
	originalError?: string
}
