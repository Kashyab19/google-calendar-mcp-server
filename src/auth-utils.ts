import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js'

/**
 * Check if the user is authenticated (not a guest)
 */
export function isAuthenticated(auth?: AuthInfo): boolean {
	if (!auth) return false
	if (auth.clientId === 'anonymous' || auth.token === 'guest') return false
	if (!auth.scopes || auth.scopes.length === 0) return false
	return true
}

/**
 * Require authentication for a tool/resource
 * Throws an error if user is not authenticated
 */
export function requireAuth(auth?: AuthInfo): void {
	if (!isAuthenticated(auth)) {
		throw new Error(
			'Authentication required. Please complete the OAuth flow to use this feature. ' +
				'Click any tool in the playground to start the authentication process.'
		)
	}
}

/**
 * Check if user has specific scopes
 */
export function hasScopes(auth: AuthInfo | undefined, requiredScopes: string[]): boolean {
	if (!auth || !auth.scopes) return false
	return requiredScopes.every((scope) => auth.scopes.includes(scope))
}
