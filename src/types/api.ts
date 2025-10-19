export interface GoogleAPIError extends Error {
	code?: number
	message: string
}

export interface GoogleAPICredentials {
	access_token: string
	refresh_token?: string
	token_type: string
	expiry_date?: number
}

export interface APIResponse<T = unknown> {
	success: boolean
	data?: T
	error?: string
	statusCode: number
}

export interface PaginatedResponse<T> {
	items: T[]
	totalItems: number
	nextPageToken?: string
	pageSize: number
}

export interface RateLimitInfo {
	limit: number
	remaining: number
	reset: number
	retryAfter?: number
}

export interface RateLimitConfig {
	maxRequests: number
	windowMs: number
	skipSuccessfulRequests?: boolean
	skipFailedRequests?: boolean
}

export interface APIClientConfig {
	baseURL: string
	timeout: number
	retries: number
	headers: Record<string, string>
}

export interface APIClientOptions {
	method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
	headers?: Record<string, string>
	body?: unknown
	timeout?: number
	retries?: number
}

export interface WebhookEvent {
	id: string
	type: string
	resourceId: string
	resourceUri: string
	token?: string
	expiration?: string
}

export interface WebhookSubscription {
	id: string
	resourceId: string
	resourceUri: string
	eventTypes: string[]
	expiration?: string
	notificationUrl: string
}

export interface ExternalServiceConfig {
	name: string
	baseURL: string
	apiKey?: string
	timeout: number
	retries: number
}

export interface ServiceHealth {
	service: string
	status: 'healthy' | 'degraded' | 'unhealthy'
	responseTime: number
	lastChecked: Date
	error?: string
}
