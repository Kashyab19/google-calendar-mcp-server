/**
 * Constants and configuration values for the Google Calendar MCP Server
 */

// Server Configuration
export const SERVER_CONFIG = {
	NAME: 'Google Calendar MCP Server',
	VERSION: '1.0.0',
} as const

// Default Ports
export const DEFAULT_PORTS = {
	AUTH_SERVER: 3080,
	MCP_SERVER: 8081,
	OAUTH_CALLBACK: 8082,
	OAUTH21_LEGACY: 3081,
	OAUTH21_LEGACY_RESOURCE: 3002,
} as const

// OAuth 2.1 Configuration (for local development: change to http://localhost:3080)
export const OAUTH21_CONFIG = {
	DEFAULT_AUTH_SERVER_URL: 'https://google-auth-server-production-990d.up.railway.app',
	DEFAULT_RESOURCE_ID: 'https://smithery.ai',
	DEFAULT_CALLBACK_URI: '/oauth/callback',
	CALLBACK_SERVER_PORT: 8081,
	CALLBACK_PATH: '/callback',
} as const

// Google API Configuration
export const GOOGLE_API_CONFIG = {
	CALENDAR_VERSION: 'v3',
	OAUTH2_VERSION: 'v2',
	DEFAULT_SCOPES: [
		'https://www.googleapis.com/auth/calendar',
		'https://www.googleapis.com/auth/calendar.events',
	],
	EXTENDED_SCOPES: [
		'https://www.googleapis.com/auth/calendar',
		'https://www.googleapis.com/auth/calendar.events',
		'https://www.googleapis.com/auth/userinfo.email',
		'https://www.googleapis.com/auth/userinfo.profile',
	],
} as const

// Time Configuration
export const TIME_CONFIG = {
	DEFAULT_EVENT_DURATION_MINUTES: 60,
	SEARCH_TIME_RANGE_DAYS: {
		PAST: 7,
		FUTURE: 30,
		EXTENDED_PAST: 365,
		EXTENDED_FUTURE: 365,
	},
	TOKEN_EXPIRY_SECONDS: 3600, // 1 hour
	REFRESH_TOKEN_LIFETIME_DAYS: 1,
} as const

// Error Messages
export const ERROR_MESSAGES = {
	AUTHENTICATION: {
		NOT_AUTHENTICATED: 'You are still not signed in. There are no authentication tokens available.',
		INVALID_GRANT: 'Authentication token is invalid or expired',
		INVALID_CLIENT: 'Invalid client credentials',
		MISSING_CREDENTIALS:
			'Either OAuth 2.1 must be enabled or clientId/clientSecret must be provided',
	},
	CALENDAR: {
		PRIMARY_DELETE: 'Cannot delete the primary calendar',
		NOT_FOUND: 'Calendar or event not found',
		INVALID_DATE_FORMAT: 'Invalid date format. Use RFC3339 format (e.g., 2024-01-15T14:30:00Z)',
		INVALID_TIME_FORMAT: 'Invalid time format. Use HH:MM format (e.g., 14:30)',
	},
	GENERAL: {
		SERVER_ERROR: 'Internal server error',
		VALIDATION_ERROR: 'Invalid input parameters',
		NETWORK_ERROR: 'Network request failed',
	},
} as const

// Success Messages
export const SUCCESS_MESSAGES = {
	AUTHENTICATION: {
		COMPLETE: 'Authentication Complete! You are now authenticated with Google Calendar.',
		TOKENS_RECEIVED: 'OAuth 2.1: Received tokens from auth server',
	},
	EVENTS: {
		CREATED: 'Event Created Successfully',
		UPDATED: 'Event Updated Successfully',
		DELETED: 'Event Deleted Successfully',
	},
	CALENDARS: {
		CREATED: 'Calendar Created Successfully',
		DELETED: 'Calendar Deleted Successfully',
	},
} as const

// Warning Messages
export const WARNING_MESSAGES = {
	IRREVERSIBLE_ACTION: 'This action cannot be undone',
	TOKEN_EXPIRY: 'Access token will expire and may need refresh',
	LIMITED_AUTH: 'Limited Authentication - May need re-authorization when access token expires',
	FORCE_DELETE_CAUTION: 'use force_delete=true to delete the first match (use with caution)',
} as const

// API Endpoints
export const API_ENDPOINTS = {
	OAUTH21: {
		DISCOVERY: '/.well-known/oauth-authorization-server',
		JWKS: '/.well-known/jwks.json',
		REGISTER: '/register',
		AUTHORIZE: '/authorize',
		TOKEN: '/token',
		GOOGLE_TOKENS: '/google-tokens',
		GOOGLE_CALLBACK: '/oauth/google/callback',
		CLIENT_CALLBACK: '/oauth/callback',
	},
	GOOGLE: {
		OAUTH2_AUTH: 'https://accounts.google.com/o/oauth2/v2/auth',
		OAUTH2_TOKEN: 'https://oauth2.googleapis.com/token',
		USER_INFO: 'https://www.googleapis.com/oauth2/v2/userinfo',
	},
} as const

// Tool Names
export const TOOL_NAMES = {
	AUTH: {
		AUTHENTICATE: 'authenticate',
		CHECK_AUTH_STATUS: 'check_auth_status',
		GENERATE_OAUTH_URL: 'generate_oauth_url',
		EXCHANGE_AUTH_CODE: 'exchange_auth_code',
	},
	CALENDARS: {
		LIST: 'list_calendars',
		MANAGE: 'manage_calendars',
	},
	EVENTS: {
		GET_CURRENT_TIME: 'get_current_time',
		LIST: 'list_events',
		CREATE: 'create_events',
		UPDATE: 'update_events',
	},
} as const

// Calendar IDs
export const CALENDAR_IDS = {
	PRIMARY: 'primary',
} as const

// Event Status Values
export const EVENT_STATUS = {
	CONFIRMED: 'confirmed',
	TENTATIVE: 'tentative',
	CANCELLED: 'cancelled',
} as const

// Response Status Values
export const RESPONSE_STATUS = {
	ACCEPTED: 'accepted',
	DECLINED: 'declined',
	TENTATIVE: 'tentative',
	NEEDS_ACTION: 'needsAction',
} as const

// Date/Time Formats
export const DATE_FORMATS = {
	ISO_8601: 'YYYY-MM-DDTHH:mm:ss.sssZ',
	DATE_ONLY: 'YYYY-MM-DD',
	TIME_ONLY: 'HH:MM',
	RFC3339: 'RFC3339',
} as const

// HTTP Status Codes
export const HTTP_STATUS = {
	OK: 200,
	CREATED: 201,
	BAD_REQUEST: 400,
	UNAUTHORIZED: 401,
	FORBIDDEN: 403,
	NOT_FOUND: 404,
	INTERNAL_SERVER_ERROR: 500,
} as const

// Browser Commands
export const BROWSER_COMMANDS = {
	MACOS: 'open',
	LINUX: 'xdg-open',
	WINDOWS: 'start',
} as const

// Default Values
export const DEFAULTS = {
	CALENDAR_ID: CALENDAR_IDS.PRIMARY,
	EVENT_DURATION_MINUTES: TIME_CONFIG.DEFAULT_EVENT_DURATION_MINUTES,
	ACCESS_TYPE: 'offline',
	PROMPT: 'consent',
	TOKEN_TYPE: 'Bearer',
	MAX_EVENTS_PER_PAGE: 250,
	MAX_CALENDARS_PER_PAGE: 250,
} as const

// Validation Patterns
export const VALIDATION_PATTERNS = {
	EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
	ISO_DATE: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/,
	DATE_ONLY: /^\d{4}-\d{2}-\d{2}$/,
	TIME_ONLY: /^\d{2}:\d{2}$/,
	RFC3339: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/,
} as const
