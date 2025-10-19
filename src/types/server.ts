export interface ServerConfig {
	port: number
	host: string
	resourceId: string
}

export interface HttpServerConfig {
	port: number
	host: string
	timeout?: number
}

export interface OAuth2Config {
	clientId?: string
	clientSecret?: string
	refreshToken?: string
}

export interface HttpRequest {
	url?: string
	method?: string
	headers: Record<string, string | string[] | undefined>
}

export interface HttpResponse {
	writeHead: (statusCode: number, headers?: Record<string, string>) => void
	end: (data: string) => void
}

export interface EnvironmentConfig {
	OAUTH21_AUTH_SERVER_URL?: string
	OAUTH21_RESOURCE_ID?: string
	SMITHERY_RESOURCE_ID?: string
	MCP_SERVER_PORT?: string
	MCP_SERVER_HOST?: string
}

export interface ToolResponse {
	content: Array<{
		type: 'text'
		text: string
	}>
}

export interface ErrorResponse {
	content: Array<{
		type: 'text'
		text: string
	}>
}

export interface TimezoneInfo {
	name: string
	offset: string
}

export interface TimeExamples {
	now: string
	oneHour: string
	tomorrow: string
	nextWeek: string
}

export interface ErrorContext {
	operation: string
	originalError?: string
	additionalInfo?: Record<string, unknown>
}

export interface RetryConfig {
	maxRetries: number
	baseDelay: number
	backoffMultiplier: number
}

export type DeepPartial<T> = {
	[P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}

export type NonNullable<T> = T extends null | undefined ? never : T

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>
