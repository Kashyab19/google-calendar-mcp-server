/**
 * Calendar-related types for Google Calendar
 */

export interface CalendarData {
	id: string
	summary: string
	description?: string
	timeZone?: string
	location?: string
	accessRole?: string
	primary?: boolean
	created?: string
	updated?: string
	etag?: string
}

export interface CalendarCreationParams {
	summary: string
	description?: string
	time_zone?: string
}

export interface CalendarUpdateParams {
	calendar_id: string
	summary?: string
	description?: string
	time_zone?: string
}

export interface CalendarListParams {
	max_results?: number
	min_access_role?: string
	show_hidden?: boolean
	show_deleted?: boolean
}

export interface CalendarListResponse {
	calendars: CalendarData[]
	total: number
	nextPageToken?: string
}

export interface CalendarPermission {
	id: string
	role: 'owner' | 'reader' | 'writer' | 'freeBusyReader'
	scope: {
		type: 'user' | 'group' | 'domain' | 'default'
		value?: string
	}
}

export interface CalendarAclParams {
	calendar_id: string
	role: string
	scope: {
		type: string
		value?: string
	}
}

export interface CalendarSettings {
	timeZone: string
	locale: string
	weekStart: 'SUNDAY' | 'MONDAY'
	reminders: {
		useDefault: boolean
		overrides?: Array<{
			method: 'email' | 'popup'
			minutes: number
		}>
	}
}

export interface CalendarColor {
	id: string
	background: string
	foreground: string
}

export interface CalendarValidation {
	isValid: boolean
	errors: string[]
	warnings: string[]
}

export interface CalendarAccessValidation {
	hasAccess: boolean
	accessLevel: 'none' | 'freeBusyReader' | 'reader' | 'writer' | 'owner'
	canRead: boolean
	canWrite: boolean
	canDelete: boolean
}
