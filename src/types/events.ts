/**
 * Event-related types for Google Calendar
 */

export interface CalendarEventData {
	summary: string
	description?: string
	start_time: string
	end_time: string
	location?: string
	attendees?: string[]
}

export interface EventCreationParams {
	calendar_id?: string
	summary?: string
	description?: string
	start_time?: string
	end_time?: string
	start_offset_minutes?: number
	duration_minutes?: number
	events?: CalendarEventData[]
	recurrence?: string[]
	location?: string
	attendees?: string[]
	all_day?: boolean
}

export interface EventUpdateParams {
	calendar_id?: string
	event_id: string
	summary?: string
	description?: string
	start_time?: string
	end_time?: string
	location?: string
	attendees?: string[]
	all_day?: boolean
}

export interface EventListParams {
	calendar_id?: string
	max_results?: number
	time_min?: string
	time_max?: string
	query?: string
}

export interface EventSearchParams {
	calendar_id?: string
	query: string
	time_min?: string
	time_max?: string
	max_results?: number
}

export interface RecurrenceRule {
	frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'
	interval?: number
	count?: number
	until?: string
	byDay?: string[]
	byMonth?: number[]
	byMonthDay?: number[]
}

export interface RecurringEventParams {
	summary: string
	description?: string
	start_time: string
	end_time: string
	recurrence: RecurrenceRule
	location?: string
	attendees?: string[]
}

export interface EventResponse {
	id: string
	summary: string
	description?: string
	start: {
		dateTime?: string
		date?: string
		timeZone?: string
	}
	end: {
		dateTime?: string
		date?: string
		timeZone?: string
	}
	location?: string
	attendees?: Array<{
		email: string
		displayName?: string
		responseStatus?: string
	}>
	htmlLink?: string
	status?: string
	recurrence?: string[]
}

export interface EventListResponse {
	events: EventResponse[]
	total: number
	nextPageToken?: string
}

export interface EventValidation {
	isValid: boolean
	errors: string[]
	warnings: string[]
}

export interface TimeValidation {
	startTime: string
	endTime: string
	isValid: boolean
	duration: number // in minutes
	conflicts: string[]
}
