import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import helmet from 'helmet'
import { CryptoService } from './crypto.js'
import { GoogleAuthService } from './google-auth.js'
import { InMemoryStorage } from './storage.js'
import type { JWTPayload } from './types.js'

// Load environment variables
dotenv.config()

const app = express()
const PORT = process.env.AUTH_SERVER_PORT || 3080
const ISSUER = process.env.AUTH_SERVER_ISSUER || `http://localhost:3080`
const MCP_RESOURCE_ID = process.env.MCP_RESOURCE_ID || 'https://smithery.ai'

// Initialize services
const cryptoService = new CryptoService()
const storage = new InMemoryStorage()
const googleAuth = new GoogleAuthService(
	process.env.GOOGLE_CLIENT_ID!,
	process.env.GOOGLE_CLIENT_SECRET!,
	process.env.GOOGLE_REDIRECT_URI || `${ISSUER}/oauth/google/callback`
)

// Trust proxy for rate limiting
app.set('trust proxy', true)

// Middleware
app.use(helmet())
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Cleanup expired entries every hour
setInterval(() => storage.cleanup(), 60 * 60 * 1000)

/**
 * OAuth 2.1 Discovery Endpoints
 */

// OAuth Authorization Server Metadata
app.get('/.well-known/oauth-authorization-server', (_req, res) => {
	res.json({
		issuer: ISSUER,
		authorization_endpoint: `${ISSUER}/authorize`,
		token_endpoint: `${ISSUER}/token`,
		registration_endpoint: `${ISSUER}/register`,
		jwks_uri: `${ISSUER}/.well-known/jwks.json`,
		code_challenge_methods_supported: ['S256'],
		scopes_supported: [
			'https://www.googleapis.com/auth/calendar',
			'https://www.googleapis.com/auth/calendar.events',
		],
		response_types_supported: ['code'],
		grant_types_supported: ['authorization_code', 'refresh_token'],
		token_endpoint_auth_methods_supported: ['none'], // Public clients use PKCE
		subject_types_supported: ['public'],
	})
})

// JWKS endpoint for public key
app.get('/.well-known/jwks.json', async (_req, res) => {
	const jwk = await cryptoService.getPublicKeyJWK()
	res.json({
		keys: [jwk],
	})
})

/**
 * Dynamic Client Registration
 */
app.post('/register', (req, res) => {
	try {
		const { client_name, redirect_uris, grant_types, response_types } = req.body

		if (!client_name || !redirect_uris || !Array.isArray(redirect_uris)) {
			return res.status(400).json({
				error: 'invalid_request',
				error_description: 'Missing required fields: client_name, redirect_uris',
			})
		}

		const client = storage.registerClient({
			client_name,
			redirect_uris,
			grant_types: grant_types || ['authorization_code', 'refresh_token'],
			response_types: response_types || ['code'],
			scope: 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events',
		})

		res.status(201).json({
			client_id: client.client_id,
			client_name: client.client_name,
			redirect_uris: client.redirect_uris,
			grant_types: client.grant_types,
			response_types: client.response_types,
			scope: client.scope,
			registration_access_token: 'not_implemented', // For simplicity
			registration_client_uri: `${ISSUER}/client/${client.client_id}`,
		})
	} catch (error) {
		console.error('Client registration error:', error)
		res.status(500).json({
			error: 'server_error',
			error_description: 'Internal server error',
		})
	}
})

/**
 * Authorization Endpoint
 */
app.get('/authorize', async (req, res) => {
	try {
		const {
			client_id,
			response_type,
			redirect_uri,
			scope,
			state,
			code_challenge,
			code_challenge_method,
			resource,
		} = req.query

		// Validate required parameters
		if (!client_id || !response_type || !redirect_uri || !code_challenge || !resource) {
			return res.status(400).json({
				error: 'invalid_request',
				error_description: 'Missing required parameters',
			})
		}

		// Validate response_type
		if (response_type !== 'code') {
			return res.status(400).json({
				error: 'unsupported_response_type',
				error_description: 'Only authorization_code flow is supported',
			})
		}

		// Validate code_challenge_method
		if (code_challenge_method !== 'S256') {
			return res.status(400).json({
				error: 'invalid_request',
				error_description: 'Only S256 code challenge method is supported',
			})
		}

		// Validate resource parameter - accept any Smithery resource or localhost
		const isValidResource = resource === MCP_RESOURCE_ID || 
			(resource as string)?.includes('smithery.ai') || 
			(resource as string)?.includes('localhost')
		
		if (!isValidResource) {
			return res.status(400).json({
				error: 'invalid_request',
				error_description: `Invalid resource. Expected: ${MCP_RESOURCE_ID} or Smithery resource`,
			})
		}

		// Get client or create a default one for Smithery
		let client = storage.getClient(client_id as string)
		if (!client) {
			// Create a default client for Smithery-generated client IDs
			client = {
				client_id: client_id as string,
				client_name: 'Smithery MCP Client',
				redirect_uris: [
					'https://smithery.ai/playground/callback',
					'http://localhost:3080/oauth/callback'
				],
				grant_types: ['authorization_code', 'refresh_token'],
				response_types: ['code'],
				scope: 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events',
				created_at: new Date()
			}
			// Store the client using the storage method
			storage.storeClient(client)
		}

		// Validate redirect_uri
		if (!client.redirect_uris.includes(redirect_uri as string)) {
			return res.status(400).json({
				error: 'invalid_request',
				error_description: 'Invalid redirect_uri',
			})
		}

		// Generate Google OAuth URL
		const googleState = cryptoService.generateState()
		const googleAuthUrl = googleAuth.generateAuthUrl(googleState)

		// Store authorization request
		const authRequest = {
			client_id: client_id as string,
			response_type: 'code' as const,
			redirect_uri: redirect_uri as string,
			scope: (scope as string) || 'calendar.read calendar.write',
			state: state as string,
			code_challenge: code_challenge as string,
			code_challenge_method: 'S256' as const,
			resource: resource as string,
		}

		// Store in storage service
		storage.storeAuthorizationRequest(googleState, authRequest)

		// Redirect to Google OAuth
		res.redirect(googleAuthUrl)
	} catch (error) {
		console.error('Authorization error:', error)
		res.status(500).json({
			error: 'server_error',
			error_description: 'Internal server error',
		})
	}
})

/**
 * Google OAuth Callback - Handle existing redirect URI
 */
app.get('/oauth/google/callback', async (req, res) => {
	try {
		const { code, state, error } = req.query

		if (error) {
			return res.status(400).json({
				error: 'access_denied',
				error_description: `Google OAuth error: ${error}`,
			})
		}

		if (!code) {
			return res.status(400).json({
				error: 'invalid_request',
				error_description: 'No authorization code received',
			})
		}

		// Exchange code for Google tokens
		const googleTokens = await googleAuth.exchangeCodeForTokens(code as string)
		const userInfo = await googleAuth.getUserInfo(googleTokens.access_token)

		// Store Google tokens for this user
		storage.storeUserTokens(userInfo.id, googleTokens)

		// Generate authorization code for our OAuth flow
		const authCode = cryptoService.generateState()
		const authRequest = storage.getAuthorizationRequest(state as string)

		if (!authRequest) {
			return res.status(400).json({
				error: 'invalid_request',
				error_description: 'No authorization request found',
			})
		}

		// Store authorization code
		storage.storeAuthorizationCode(authCode, authRequest, userInfo.id)

		// Redirect back to client with authorization code
		const redirectUrl = new URL(authRequest.redirect_uri)
		redirectUrl.searchParams.set('code', authCode)
		redirectUrl.searchParams.set('state', authRequest.state)

		res.redirect(redirectUrl.toString())
	} catch (error) {
		console.error('Google callback error:', error)
		res.status(500).json({
			error: 'server_error',
			error_description: 'Internal server error',
		})
	}
})

/**
 * Google OAuth Callback
 */
app.get('/auth/google/callback', async (req, res) => {
	try {
		const { code, state, error } = req.query

		if (error) {
			return res.status(400).json({
				error: 'access_denied',
				error_description: `Google OAuth error: ${error}`,
			})
		}

		if (!code) {
			return res.status(400).json({
				error: 'invalid_request',
				error_description: 'No authorization code received',
			})
		}

		// Exchange code for Google tokens
		const googleTokens = await googleAuth.exchangeCodeForTokens(code as string)
		const userInfo = await googleAuth.getUserInfo(googleTokens.access_token)

		// Store Google tokens for this user
		storage.storeUserTokens(userInfo.id, googleTokens)

		// Generate authorization code for our OAuth flow
		const authCode = cryptoService.generateState()
		const authRequest = storage.getAuthorizationRequest(state as string)

		if (!authRequest) {
			return res.status(400).json({
				error: 'invalid_request',
				error_description: 'No authorization request found',
			})
		}

		// Store authorization code
		storage.storeAuthorizationCode(authCode, authRequest, userInfo.id)

		// Redirect back to client with authorization code
		const redirectUrl = new URL(authRequest.redirect_uri)
		redirectUrl.searchParams.set('code', authCode)
		redirectUrl.searchParams.set('state', authRequest.state)

		res.redirect(redirectUrl.toString())
	} catch (error) {
		console.error('Google callback error:', error)
		res.status(500).json({
			error: 'server_error',
			error_description: 'Internal server error',
		})
	}
})

/**
 * Client OAuth Callback (for client integration)
 */
app.get('/oauth/callback', async (req, res) => {
	try {
		const { code, state, error } = req.query

		if (error) {
			return res.status(400).json({
				error: 'access_denied',
				error_description: `OAuth error: ${error}`,
			})
		}

		if (!code) {
			return res.status(400).json({
				error: 'invalid_request',
				error_description: 'No authorization code received',
			})
		}

		// Exchange code for Google tokens
		const googleTokens = await googleAuth.exchangeCodeForTokens(code as string)
		const userInfo = await googleAuth.getUserInfo(googleTokens.access_token)

		// Store Google tokens for this user
		storage.storeUserTokens(userInfo.id, googleTokens)

		// Generate authorization code for our OAuth flow
		const authCode = cryptoService.generateState()
		const authRequest = storage.getAuthorizationRequest(state as string)

		if (!authRequest) {
			return res.status(400).json({
				error: 'invalid_request',
				error_description: 'No authorization request found',
			})
		}

		// Store authorization code
		storage.storeAuthorizationCode(authCode, authRequest, userInfo.id)

		// Redirect back to client with authorization code
		const redirectUrl = new URL(authRequest.redirect_uri)
		redirectUrl.searchParams.set('code', authCode)
		redirectUrl.searchParams.set('state', authRequest.state)

		res.redirect(redirectUrl.toString())
	} catch (error) {
		console.error('Client callback error:', error)
		res.status(500).json({
			error: 'server_error',
			error_description: 'Internal server error',
		})
	}
})

/**
 * Google Tokens Endpoint - Return actual Google tokens for authenticated clients
 */
app.get('/google-tokens', async (req, res) => {
	try {
		const authHeader = req.headers.authorization
		if (!authHeader || !authHeader.startsWith('Bearer ')) {
			return res.status(401).json({
				error: 'unauthorized',
				error_description: 'Missing or invalid authorization header',
			})
		}

		const jwtToken = authHeader.substring(7)

		// Verify JWT token and get user info
		try {
			const decoded = await cryptoService.verifyJWT(jwtToken)
			const userId = decoded.sub

			// Get stored Google tokens for this user
			const userTokens = storage.getUserTokens(userId)
			if (!userTokens) {
				return res.status(404).json({
					error: 'not_found',
					error_description: 'No Google tokens found for user',
				})
			}

			res.json({
				access_token: userTokens.access_token,
				refresh_token: userTokens.refresh_token,
				token_type: 'Bearer',
				expiry_date: userTokens.expiry_date,
			})
		} catch (_jwtError) {
			return res.status(401).json({
				error: 'invalid_token',
				error_description: 'Invalid JWT token',
			})
		}
	} catch (error) {
		console.error('Google tokens error:', error)
		res.status(500).json({
			error: 'server_error',
			error_description: 'Internal server error',
		})
	}
})

/**
 * Token Verification Endpoint
 */
app.post('/verify', async (req, res) => {
	try {
		const authHeader = req.headers.authorization
		if (!authHeader || !authHeader.startsWith('Bearer ')) {
			return res.status(401).json({
				error: 'unauthorized',
				error_description: 'Missing or invalid authorization header',
			})
		}

		const jwtToken = authHeader.substring(7)

		// Verify JWT token and return token info
		try {
			const decoded = await cryptoService.verifyJWT(jwtToken)
			
			res.json({
				client_id: decoded.client_id,
				scope: decoded.scope,
				exp: decoded.exp,
				iat: decoded.iat,
				sub: decoded.sub,
				aud: decoded.aud,
			})
		} catch (_jwtError) {
			return res.status(401).json({
				error: 'invalid_token',
				error_description: 'Invalid JWT token',
			})
		}
	} catch (error) {
		console.error('Token verification error:', error)
		res.status(500).json({
			error: 'server_error',
			error_description: 'Internal server error',
		})
	}
})

/**
 * Token Endpoint
 */
app.post('/token', async (req, res) => {
	try {
		const { grant_type, code, redirect_uri, client_id, code_verifier, refresh_token, resource } =
			req.body

		// Validate resource parameter - accept any Smithery resource or localhost
		const isValidResource = resource === MCP_RESOURCE_ID || 
			(resource as string)?.includes('smithery.ai') || 
			(resource as string)?.includes('localhost')
		
		if (!isValidResource) {
			return res.status(400).json({
				error: 'invalid_request',
				error_description: `Invalid resource. Expected: ${MCP_RESOURCE_ID} or Smithery resource`,
			})
		}

		if (grant_type === 'authorization_code') {
			return await handleAuthorizationCodeGrant(req, res)
		} else if (grant_type === 'refresh_token') {
			return await handleRefreshTokenGrant(req, res)
		} else {
			return res.status(400).json({
				error: 'unsupported_grant_type',
				error_description: 'Only authorization_code and refresh_token grants are supported',
			})
		}
	} catch (error) {
		console.error('Token endpoint error:', error)
		res.status(500).json({
			error: 'server_error',
			error_description: 'Internal server error',
		})
	}
})

async function handleAuthorizationCodeGrant(req: any, res: any) {
	const { code, redirect_uri, client_id, code_verifier, resource } = req.body

	if (!code || !client_id || !code_verifier) {
		return res.status(400).json({
			error: 'invalid_request',
			error_description: 'Missing required parameters',
		})
	}

	// Get and consume authorization code
	const authCodeData = storage.consumeAuthorizationCode(code)
	if (!authCodeData) {
		return res.status(400).json({
			error: 'invalid_grant',
			error_description: 'Invalid or expired authorization code',
		})
	}

	// Validate client_id
	if (authCodeData.client_id !== client_id) {
		return res.status(400).json({
			error: 'invalid_grant',
			error_description: 'Client ID mismatch',
		})
	}

	// Validate redirect_uri
	if (authCodeData.redirect_uri !== redirect_uri) {
		return res.status(400).json({
			error: 'invalid_grant',
			error_description: 'Redirect URI mismatch',
		})
	}

	// Validate PKCE
	if (!cryptoService.verifyPKCE(code_verifier, authCodeData.code_challenge)) {
		return res.status(400).json({
			error: 'invalid_grant',
			error_description: 'Invalid code verifier',
		})
	}

	// Generate tokens
	const accessToken = await generateAccessToken(
		authCodeData.user_id,
		client_id,
		authCodeData.scope,
		resource
	)
	const refreshToken = cryptoService.generateState()

	// Store refresh token
	storage.storeRefreshToken(refreshToken, authCodeData.user_id, client_id, authCodeData.scope)

	res.json({
		access_token: accessToken,
		token_type: 'Bearer',
		expires_in: 3600,
		refresh_token: refreshToken,
		scope: authCodeData.scope,
	})
}

async function handleRefreshTokenGrant(req: any, res: any) {
	const { refresh_token, client_id, resource } = req.body

	if (!refresh_token || !client_id) {
		return res.status(400).json({
			error: 'invalid_request',
			error_description: 'Missing required parameters',
		})
	}

	// Get refresh token data
	const refreshTokenData = storage.getRefreshToken(refresh_token)
	if (!refreshTokenData) {
		return res.status(400).json({
			error: 'invalid_grant',
			error_description: 'Invalid or expired refresh token',
		})
	}

	// Validate client_id
	if (refreshTokenData.client_id !== client_id) {
		return res.status(400).json({
			error: 'invalid_grant',
			error_description: 'Client ID mismatch',
		})
	}

	// Generate new access token
	const accessToken = await generateAccessToken(
		refreshTokenData.user_id,
		client_id,
		refreshTokenData.scope,
		resource
	)

	res.json({
		access_token: accessToken,
		token_type: 'Bearer',
		expires_in: 3600,
		scope: refreshTokenData.scope,
	})
}

async function generateAccessToken(
	userId: string,
	clientId: string,
	scope: string,
	resource: string
): Promise<string> {
	const now = Math.floor(Date.now() / 1000)

	const payload: JWTPayload = {
		iss: ISSUER,
		sub: userId,
		aud: resource,
		exp: now + 3600, // 1 hour
		iat: now,
		scope,
		client_id: clientId,
		auth_time: now,
	}

	return await cryptoService.signJWT(payload)
}

// Add session support (in production, use proper session management)
declare global {
	namespace Express {
		interface Request {
			session?: any
		}
	}
}

// Simple in-memory session store (replace with Redis in production)
const sessions = new Map()

app.use((req, res, next) => {
	const sessionId = (req.headers['x-session-id'] as string) || 'default'
	req.session = sessions.get(sessionId) || {}
	res.on('finish', () => {
		if (req.session) {
			sessions.set(sessionId, req.session)
		}
	})
	next()
})

// Start server
app.listen(PORT, () => {
	console.log(`OAuth 2.1 Authorization Server running on port ${PORT}`)
	console.log(`Discovery endpoint: http://localhost:${PORT}/.well-known/oauth-authorization-server`)
	console.log(`JWKS endpoint: http://localhost:${PORT}/.well-known/jwks.json`)
	console.log(`Registration endpoint: http://localhost:${PORT}/register`)
	console.log(`Authorization endpoint: http://localhost:${PORT}/authorize`)
	console.log(`Token endpoint: http://localhost:${PORT}/token`)
})
