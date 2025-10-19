/**
 * Error handling utilities and custom error classes
 */

import { ERROR_MESSAGES, HTTP_STATUS } from './constants.js'
import type { GoogleAPIError } from './types/api.js'

/**
 * Base error class for the MCP server
 */
export class MCPServerError extends Error {
	public readonly code: string
	public readonly statusCode: number
	public readonly details?: Record<string, unknown>

	constructor(
		message: string,
		code: string = 'MCP_SERVER_ERROR',
		statusCode: number = HTTP_STATUS.INTERNAL_SERVER_ERROR,
		details?: Record<string, unknown>
	) {
		super(message)
		this.name = 'MCPServerError'
		this.code = code
		this.statusCode = statusCode
		this.details = details
	}
}

/**
 * Authentication-related errors
 */
export class AuthenticationError extends MCPServerError {
	constructor(message: string, details?: Record<string, unknown>) {
		super(message, 'AUTHENTICATION_ERROR', HTTP_STATUS.UNAUTHORIZED, details)
		this.name = 'AuthenticationError'
	}
}

/**
 * Validation-related errors
 */
export class ValidationError extends MCPServerError {
	constructor(message: string, details?: Record<string, unknown>) {
		super(message, 'VALIDATION_ERROR', HTTP_STATUS.BAD_REQUEST, details)
		this.name = 'ValidationError'
	}
}

/**
 * Calendar/Event operation errors
 */
export class CalendarError extends MCPServerError {
	constructor(message: string, details?: Record<string, unknown>) {
		super(message, 'CALENDAR_ERROR', HTTP_STATUS.BAD_REQUEST, details)
		this.name = 'CalendarError'
	}
}

/**
 * Network/API errors
 */
export class NetworkError extends MCPServerError {
	constructor(message: string, details?: Record<string, unknown>) {
		super(message, 'NETWORK_ERROR', HTTP_STATUS.INTERNAL_SERVER_ERROR, details)
		this.name = 'NetworkError'
	}
}

/**
 * Standard error response format
 */
export interface ErrorResponse {
	content: Array<{
		type: 'text'
		text: string
	}>
}

/**
 * Create standardized error response
 */
export function createErrorResponse(
	error: Error | MCPServerError,
	context?: string
): ErrorResponse {
	let errorMessage: string
	let errorTitle: string

	if (error instanceof MCPServerError) {
		errorTitle = `${error.name}: ${error.code}`
		errorMessage = error.message
	} else {
		errorTitle = 'Error'
		errorMessage = error.message || 'An unknown error occurred'
	}

	const contextInfo = context ? `\n\n**Context:** ${context}` : ''

	const errorText = `# ${errorTitle}

**Error:** ${errorMessage}${contextInfo}

## Troubleshooting:
1. Check your input parameters
2. Verify authentication status
3. Ensure the calendar/event exists
4. Try again in a few moments`

	return {
		content: [{ type: 'text', text: errorText }],
	}
}

/**
 * Handle common Google API errors
 */
export function handleGoogleAPIError(error: GoogleAPIError): MCPServerError {
	if (error.code === 401) {
		return new AuthenticationError(ERROR_MESSAGES.AUTHENTICATION.INVALID_GRANT, {
			originalError: error.message,
		})
	}

	if (error.code === 400 && error.message?.includes('invalid_client')) {
		return new AuthenticationError(ERROR_MESSAGES.AUTHENTICATION.INVALID_CLIENT, {
			originalError: error.message,
		})
	}

	if (error.code === 404) {
		return new CalendarError(ERROR_MESSAGES.CALENDAR.NOT_FOUND, { originalError: error.message })
	}

	if (error.message?.includes('Invalid date')) {
		return new ValidationError(ERROR_MESSAGES.CALENDAR.INVALID_DATE_FORMAT, {
			originalError: error.message,
		})
	}

	return new NetworkError(ERROR_MESSAGES.GENERAL.NETWORK_ERROR, {
		originalError: error.message,
		code: error.code,
	})
}

/**
 * Validate required parameters
 */
export function validateRequiredParams(
	params: Record<string, unknown>,
	requiredFields: string[]
): void {
	const missingFields = requiredFields.filter(
		(field) => params[field] === undefined || params[field] === null || params[field] === ''
	)

	if (missingFields.length > 0) {
		throw new ValidationError(`Missing required parameters: ${missingFields.join(', ')}`, {
			missingFields,
		})
	}
}

/**
 * Validate email addresses
 */
export function validateEmails(emails: string[]): void {
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
	const invalidEmails = emails.filter((email) => !emailRegex.test(email))

	if (invalidEmails.length > 0) {
		throw new ValidationError(`Invalid email addresses: ${invalidEmails.join(', ')}`, {
			invalidEmails,
		})
	}
}

/**
 * Validate date format
 */
export function validateDateFormat(
	dateString: string,
	format: 'ISO' | 'DATE_ONLY' | 'TIME_ONLY'
): void {
	let isValid = false

	switch (format) {
		case 'ISO':
			isValid = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/.test(dateString)
			break
		case 'DATE_ONLY':
			isValid = /^\d{4}-\d{2}-\d{2}$/.test(dateString)
			break
		case 'TIME_ONLY':
			isValid = /^\d{2}:\d{2}$/.test(dateString)
			break
	}

	if (!isValid) {
		throw new ValidationError(
			`Invalid ${format.toLowerCase()} format: ${dateString}. Expected format: ${
				format === 'ISO'
					? 'YYYY-MM-DDTHH:mm:ss.sssZ'
					: format === 'DATE_ONLY'
						? 'YYYY-MM-DD'
						: 'HH:MM'
			}`
		)
	}
}

/**
 * Safe async operation wrapper
 */
export async function safeAsyncOperation<T>(
	operation: () => Promise<T>,
	context?: string
): Promise<T> {
	try {
		return await operation()
	} catch (error) {
		if (error instanceof MCPServerError) {
			throw error
		}
		throw new NetworkError(
			`Operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
			{ context, originalError: error }
		)
	}
}

/**
 * Retry operation with exponential backoff
 */
export async function retryOperation<T>(
	operation: () => Promise<T>,
	maxRetries: number = 3,
	baseDelay: number = 1000
): Promise<T> {
	let lastError: Error

	for (let attempt = 0; attempt <= maxRetries; attempt++) {
		try {
			return await operation()
		} catch (error) {
			lastError = error instanceof Error ? error : new Error(String(error))

			if (attempt === maxRetries) {
				break
			}

			// Don't retry authentication errors
			if (
				error instanceof AuthenticationError ||
				(error as Error & { code?: number })?.code === 401
			) {
				break
			}

			// Exponential backoff
			const delay = baseDelay * 2 ** attempt
			await new Promise((resolve) => setTimeout(resolve, delay))
		}
	}

	throw lastError
}

/**
 * Create success response
 */
export function createSuccessResponse(
	title: string,
	message: string,
	details?: Record<string, unknown>
) {
	const detailsText = details
		? Object.entries(details)
				.map(([key, value]) => `- **${key}:** ${value}`)
				.join('\n')
		: ''

	const text = `# ${title}

${message}${detailsText ? `\n\n## Details:\n${detailsText}` : ''}`

	return {
		content: [{ type: 'text', text }],
	}
}
