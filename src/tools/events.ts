import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { Auth, calendar_v3 } from 'googleapis'
import { z } from 'zod'
import { safeAsyncOperation } from '../errors.js'
import { createCalendarClient, generateTimeExamples, getTimezoneInfo } from '../utils.js'

export function registerConsolidatedEventTools(
	server: McpServer,
	_calendar: calendar_v3.Calendar,
	oauth2Client: Auth.OAuth2Client
) {
	// Helper function to get a fresh calendar instance with current credentials
	const getCalendar = () => createCalendarClient(oauth2Client)

	// Tool: Get Current Time (keeping this as a utility tool)
	server.tool(
		'get_current_time',
		'Get the current system date and time for creating events',
		{},
		async () => {
			return safeAsyncOperation(async () => {
				const now = new Date()
				const examples = generateTimeExamples()
				const timezoneInfo = getTimezoneInfo()

				const markdown = `# Current System Time

## UTC Time (ISO 8601)
- **ISO String:** \`${examples.current}\`
- **UTC Date:** ${now.toUTCString()}

## Local Time
- **Local String:** ${now.toString()}
- **Local Date:** ${now.toLocaleDateString()}
- **Local Time:** ${now.toLocaleTimeString()}

## For Event Creation
When creating events, use the ISO format:
- **Current UTC:** \`${examples.current}\`
- **Example 1 hour from now:** \`${examples.oneHourLater}\`
- **Example tomorrow same time:** \`${examples.tomorrow}\`

## Time Zone Info
- **System Timezone:** ${timezoneInfo.timezone}
- **UTC Offset:** ${timezoneInfo.offset} minutes`

				return {
					content: [{ type: 'text', text: markdown }],
				}
			}, 'get current time')
		}
	)

	// Tool: Create Events (consolidated)
	server.tool(
		'create_events',
		'Create single, multiple, or recurring calendar events',
		{
			calendar_id: z.string().default('primary').describe("Calendar ID (default: 'primary')"),

			// Single event creation (traditional)
			summary: z.string().optional().describe('Event title (required for single event)'),
			description: z.string().optional().describe('Event description'),
			start_time: z.string().optional().describe('Start time (RFC3339 format)'),
			end_time: z.string().optional().describe('End time (RFC3339 format)'),

			// Relative event creation
			start_offset_minutes: z
				.number()
				.optional()
				.describe('Minutes from now to start (0 = start now)'),
			duration_minutes: z.number().optional().describe('Duration in minutes (for relative events)'),

			// Multiple events creation
			events: z
				.array(
					z.object({
						summary: z.string(),
						start_time: z.string(),
						end_time: z.string(),
						description: z.string().optional(),
						location: z.string().optional(),
						attendees: z.array(z.string()).optional(),
					})
				)
				.optional()
				.describe('Array of events to create (for batch creation)'),

			// Recurring events
			recurrence: z
				.array(z.string())
				.optional()
				.describe('RRULE patterns for recurring events (e.g., ["FREQ=WEEKLY;BYDAY=MO,WE,FR"])'),

			// Common fields
			location: z.string().optional().describe('Event location'),
			attendees: z.array(z.string()).optional().describe('List of attendee email addresses'),
			all_day: z.boolean().default(false).describe('Whether this is an all-day event'),
		},
		async (params) => {
			return safeAsyncOperation(async () => {
				const {
					calendar_id,
					summary,
					description,
					start_time,
					end_time,
					start_offset_minutes,
					duration_minutes,
					events,
					recurrence,
					location,
					attendees,
					all_day,
				} = params

				const currentCalendar = getCalendar()

				// Handle multiple events creation
				if (events && events.length > 0) {
					const results = []
					for (const eventData of events) {
						const event: calendar_v3.Schema$Event = {
							summary: eventData.summary,
							description: eventData.description,
							location: eventData.location,
							start: { dateTime: eventData.start_time },
							end: { dateTime: eventData.end_time },
						}

						if (eventData.attendees && eventData.attendees.length > 0) {
							event.attendees = eventData.attendees.map((email) => ({ email }))
						}

						const response = await currentCalendar.events.insert({
							calendarId: calendar_id,
							requestBody: event,
						})

						results.push(response.data)
					}

					const markdown = `# Multiple Events Created Successfully

Created ${results.length} events:

${results
	.map(
		(event, index) => `
## Event ${index + 1}: ${event.summary}
- **ID:** \`${event.id}\`
- **Start:** ${event.start?.dateTime || 'Not specified'}
- **End:** ${event.end?.dateTime || 'Not specified'}
- **Location:** ${event.location || 'Not specified'}
- **HTML Link:** ${event.htmlLink || 'Not available'}
`
	)
	.join('')}

**Total:** ${results.length} events created`

					return {
						content: [{ type: 'text', text: markdown }],
					}
				}

				// Handle single event creation
				if (!summary) {
					throw new Error('Event summary is required for single event creation')
				}

				const event: calendar_v3.Schema$Event = {
					summary,
					description,
					location,
				}

				// Handle time settings
				if (start_offset_minutes !== undefined) {
					// Relative event creation
					const now = new Date()
					const startTime = new Date(now.getTime() + start_offset_minutes * 60 * 1000)
					const endTime = duration_minutes
						? new Date(startTime.getTime() + duration_minutes * 60 * 1000)
						: new Date(startTime.getTime() + 60 * 60 * 1000) // Default 1 hour

					event.start = { dateTime: startTime.toISOString() }
					event.end = { dateTime: endTime.toISOString() }
				} else if (start_time && end_time) {
					// Absolute time creation
					if (all_day) {
						event.start = { date: start_time.split('T')[0] }
						event.end = { date: end_time.split('T')[0] }
					} else {
						event.start = { dateTime: start_time }
						event.end = { dateTime: end_time }
					}
				} else {
					throw new Error('Either start_time/end_time or start_offset_minutes must be provided')
				}

				// Handle attendees
				if (attendees && attendees.length > 0) {
					event.attendees = attendees.map((email) => ({ email }))
				}

				// Handle recurrence
				if (recurrence && recurrence.length > 0) {
					event.recurrence = recurrence
				}

				const response = await currentCalendar.events.insert({
					calendarId: calendar_id,
					requestBody: event,
				})

				const createdEvent = response.data
				const markdown = `# Event Created Successfully

## ${createdEvent.summary}
- **ID:** \`${createdEvent.id}\`
- **Start:** ${createdEvent.start?.dateTime || createdEvent.start?.date || 'Not specified'}
- **End:** ${createdEvent.end?.dateTime || createdEvent.end?.date || 'Not specified'}
- **Location:** ${createdEvent.location || 'Not specified'}
- **Description:** ${createdEvent.description || 'No description'}
- **Status:** ${createdEvent.status || 'Unknown'}
- **HTML Link:** ${createdEvent.htmlLink || 'Not available'}

${
	recurrence && recurrence.length > 0
		? `
## Recurrence
- **Pattern:** ${recurrence.join(', ')}
- **Type:** Recurring event
`
		: ''
}

## Next Steps
- The event has been added to your calendar
- Attendees will receive email invitations (if specified)
- You can view the event in Google Calendar using the HTML link above`

				return {
					content: [{ type: 'text', text: markdown }],
				}
			}, 'create events')
		}
	)

	// Tool: List Events (enhanced)
	server.tool(
		'list_events',
		'List events from a calendar with optional filtering and search',
		{
			calendar_id: z.string().default('primary').describe("Calendar ID (default: 'primary')"),
			time_min: z.string().optional().describe('Lower bound for event start time (RFC3339 format)'),
			time_max: z.string().optional().describe('Upper bound for event start time (RFC3339 format)'),
			max_results: z.number().default(10).describe('Maximum number of events to return'),
			order_by: z
				.enum(['startTime', 'updated'])
				.default('startTime')
				.describe('Order of events returned'),
			search_text: z
				.string()
				.optional()
				.describe('Search text to filter events by name or description'),
			include_recurring: z.boolean().default(true).describe('Whether to include recurring events'),
		},
		async ({
			calendar_id,
			time_min,
			time_max,
			max_results,
			order_by,
			search_text,
			include_recurring,
		}) => {
			return safeAsyncOperation(async () => {
				const currentCalendar = getCalendar()

				const response = await currentCalendar.events.list({
					calendarId: calendar_id,
					timeMin: time_min,
					timeMax: time_max,
					maxResults: max_results,
					singleEvents: include_recurring,
					orderBy: order_by,
					q: search_text,
				})

				const events = response.data.items || []
				const markdown = `# Calendar Events

${search_text ? `**Search:** "${search_text}"\n` : ''}

${
	events.length === 0
		? 'No events found for the specified criteria.'
		: events
				.map(
					(event) => `
## ${event.summary || 'Untitled Event'}
- **ID:** \`${event.id}\`
- **Start:** ${event.start?.dateTime || event.start?.date || 'Not specified'}
- **End:** ${event.end?.dateTime || event.end?.date || 'Not specified'}
- **Location:** ${event.location || 'Not specified'}
- **Description:** ${event.description || 'No description'}
- **Status:** ${event.status || 'Unknown'}
- **HTML Link:** ${event.htmlLink || 'Not available'}
${
	event.attendees
		? `- **Attendees:** ${event.attendees.map((a) => a.email || a.displayName || 'Unknown').join(', ')}`
		: ''
}
${
	event.recurrence
		? `- **Recurring:** Yes (${event.recurrence.length} rule${event.recurrence.length !== 1 ? 's' : ''})`
		: ''
}
`
				)
				.join('\n')
}

**Total:** ${events.length} event${events.length !== 1 ? 's' : ''}`

				return {
					content: [{ type: 'text', text: markdown }],
				}
			}, 'list events')
		}
	)

	// Tool: Update Events (consolidated)
	server.tool(
		'update_events',
		'Update or delete calendar events by ID, name, or search criteria',
		{
			calendar_id: z.string().default('primary').describe("Calendar ID (default: 'primary')"),

			// Event identification (choose one method)
			event_id: z.string().optional().describe('Direct event ID (fastest method)'),
			event_name: z.string().optional().describe('Event name or partial name to search for'),
			start_date: z
				.string()
				.optional()
				.describe('Event start date (YYYY-MM-DD) to help identify the correct event'),
			start_time: z
				.string()
				.optional()
				.describe('Event start time (HH:MM format) to help identify the correct event'),
			location: z.string().optional().describe('Event location to help identify the correct event'),

			// Update operations
			updates: z
				.object({
					summary: z.string().optional(),
					description: z.string().optional(),
					start_time: z.string().optional(),
					end_time: z.string().optional(),
					location: z.string().optional(),
					attendees: z.array(z.string()).optional(),
				})
				.optional()
				.describe('Fields to update'),

			// Delete operations
			delete: z.boolean().default(false).describe('Set to true to delete the event'),
			force_delete: z
				.boolean()
				.default(false)
				.describe('Skip confirmation for single matches (use with caution)'),

			// Recurring event handling
			delete_recurring: z
				.enum(['this', 'following', 'all'])
				.optional()
				.describe(
					'For recurring events: delete this instance, following instances, or all instances'
				),
		},
		async (params) => {
			return safeAsyncOperation(async () => {
				const {
					calendar_id,
					event_id,
					event_name,
					start_date,
					start_time,
					location,
					updates,
					delete: shouldDelete,
					force_delete,
					delete_recurring,
				} = params

				const currentCalendar = getCalendar()

				// If event_id is provided, handle directly
				if (event_id) {
					if (shouldDelete) {
						// Direct delete by ID
						await currentCalendar.events.delete({
							calendarId: calendar_id,
							eventId: event_id,
						})

						return {
							content: [
								{
									type: 'text',
									text: `# Event Deleted Successfully

Event with ID \`${event_id}\` has been permanently deleted.

**WARNING:** This action cannot be undone.`,
								},
							],
						}
					} else if (updates) {
						// Direct update by ID
						const existingEvent = await currentCalendar.events.get({
							calendarId: calendar_id,
							eventId: event_id,
						})

						const eventData = { ...existingEvent.data }

						// Apply updates
						if (updates.summary !== undefined) eventData.summary = updates.summary
						if (updates.description !== undefined) eventData.description = updates.description
						if (updates.location !== undefined) eventData.location = updates.location
						if (updates.start_time !== undefined) {
							eventData.start = eventData.start?.date
								? { date: updates.start_time.split('T')[0] }
								: { dateTime: updates.start_time }
						}
						if (updates.end_time !== undefined) {
							eventData.end = eventData.end?.date
								? { date: updates.end_time.split('T')[0] }
								: { dateTime: updates.end_time }
						}
						if (updates.attendees !== undefined) {
							eventData.attendees = updates.attendees.map((email) => ({ email }))
						}

						const response = await currentCalendar.events.update({
							calendarId: calendar_id,
							eventId: event_id,
							requestBody: eventData,
						})

						const updatedEvent = response.data
						return {
							content: [
								{
									type: 'text',
									text: `# Event Updated Successfully

## ${updatedEvent.summary}
- **ID:** \`${updatedEvent.id}\`
- **Start:** ${updatedEvent.start?.dateTime || updatedEvent.start?.date || 'Not specified'}
- **End:** ${updatedEvent.end?.dateTime || updatedEvent.end?.date || 'Not specified'}
- **Location:** ${updatedEvent.location || 'Not specified'}
- **Description:** ${updatedEvent.description || 'No description'}
- **Status:** ${updatedEvent.status || 'Unknown'}
- **HTML Link:** ${updatedEvent.htmlLink || 'Not available'}

## Changes Applied
- Event details have been updated
- Attendees will receive updated invitations (if changed)`,
								},
							],
						}
					} else {
						// Just get event details
						const response = await currentCalendar.events.get({
							calendarId: calendar_id,
							eventId: event_id,
						})

						const event = response.data
						const markdown = `# Event Details

## ${event.summary || 'Untitled Event'}
- **ID:** \`${event.id}\`
- **Start:** ${event.start?.dateTime || event.start?.date || 'Not specified'}
- **End:** ${event.end?.dateTime || event.end?.date || 'Not specified'}
- **Location:** ${event.location || 'Not specified'}
- **Description:** ${event.description || 'No description'}
- **Status:** ${event.status || 'Unknown'}
- **Created:** ${event.created ? new Date(event.created).toISOString() : 'Unknown'}
- **Updated:** ${event.updated ? new Date(event.updated).toISOString() : 'Unknown'}
- **HTML Link:** ${event.htmlLink || 'Not available'}

## Attendees
${
	event.attendees?.length
		? event.attendees
				.map(
					(attendee) => `
- **${attendee.displayName || attendee.email || 'Unknown'}** (${attendee.email || 'No email'})
  - Response: ${attendee.responseStatus || 'No response'}
  - Optional: ${attendee.optional ? 'Yes' : 'No'}
`
				)
				.join('')
		: 'No attendees'
}

## Reminders
${
	event.reminders?.overrides?.length
		? event.reminders.overrides
				.map(
					(reminder) => `
- **${reminder.method}:** ${reminder.minutes} minutes before
`
				)
				.join('')
		: 'No custom reminders'
}`

						return {
							content: [{ type: 'text', text: markdown }],
						}
					}
				}

				// If no event_id, search for events by name
				if (!event_name) {
					throw new Error('Either event_id or event_name must be provided')
				}

				// Search for events
				const response = await currentCalendar.events.list({
					calendarId: calendar_id,
					timeMin: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year ago
					timeMax: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year from now
					singleEvents: true,
					orderBy: 'startTime',
				})

				const events = response.data.items || []
				let matchingEvents = events.filter((event) =>
					event.summary?.toLowerCase().includes(event_name.toLowerCase())
				)

				// Apply additional filters
				if (start_date) {
					matchingEvents = matchingEvents.filter((event) => {
						const eventDate = event.start?.date || event.start?.dateTime?.split('T')[0]
						return eventDate === start_date
					})
				}

				if (start_time) {
					matchingEvents = matchingEvents.filter((event) => {
						const eventTime = event.start?.dateTime
						if (!eventTime) return false
						const timePart = `${eventTime.split('T')[1]?.split(':')[0]}:${eventTime.split('T')[1]?.split(':')[1]}`
						return timePart.startsWith(start_time)
					})
				}

				if (location) {
					matchingEvents = matchingEvents.filter((event) =>
						event.location?.toLowerCase().includes(location.toLowerCase())
					)
				}

				if (matchingEvents.length === 0) {
					return {
						content: [
							{
								type: 'text',
								text: `# No Events Found

No events found matching your criteria:
- **Name:** "${event_name}"
${start_date ? `- **Date:** ${start_date}\n` : ''}${start_time ? `- **Time:** ${start_time}\n` : ''}${
	location ? `- **Location:** ${location}\n` : ''
}

## Suggestions:
1. Try using a partial name match
2. Use \`list_events\` with search_text to find similar events
3. Check if you're looking in the correct calendar`,
							},
						],
					}
				}

				if (matchingEvents.length > 1 && !force_delete && shouldDelete) {
					const markdown = `# Multiple Events Found - Please Choose One

Found ${matchingEvents.length} events matching your criteria:

${matchingEvents
	.map(
		(event, index) => `
## Option ${index + 1}: ${event.summary}
- **ID:** \`${event.id}\`
- **Start:** ${event.start?.dateTime || event.start?.date || 'Not specified'}
- **End:** ${event.end?.dateTime || event.end?.date || 'Not specified'}
- **Location:** ${event.location || 'Not specified'}
- **Description:** ${event.description || 'No description'}
`
	)
	.join('\n')}

## To Delete a Specific Event:
1. **Add more details** to narrow down the search:
   - \`start_date\`: "2024-01-15" 
   - \`start_time\`: "14:30"
   - \`location\`: "Conference Room A"

2. **Or use force_delete=true** to delete the first match (use with caution)

## Example:
\`\`\`
update_events
event_name: "Team Meeting"
start_date: "2024-01-15"
start_time: "14:30"
delete: true
\`\`\``

					return {
						content: [{ type: 'text', text: markdown }],
					}
				}

				// Handle single match or force delete
				const targetEvent = matchingEvents[0]

				if (shouldDelete) {
					if (!targetEvent.id) {
						throw new Error('Event ID is missing')
					}

					await currentCalendar.events.delete({
						calendarId: calendar_id,
						eventId: targetEvent.id,
					})

					return {
						content: [
							{
								type: 'text',
								text: `# Event Deleted Successfully

## Deleted Event Details:
- **Title:** ${targetEvent.summary || 'Untitled Event'}
- **ID:** \`${targetEvent.id}\`
- **Start:** ${targetEvent.start?.dateTime || targetEvent.start?.date || 'Not specified'}
- **End:** ${targetEvent.end?.dateTime || targetEvent.end?.date || 'Not specified'}
- **Location:** ${targetEvent.location || 'Not specified'}

**WARNING:** This action cannot be undone. The event has been removed from all attendees' calendars.`,
							},
						],
					}
				} else if (updates) {
					if (!targetEvent.id) {
						throw new Error('Event ID is missing')
					}

					const existingEvent = await currentCalendar.events.get({
						calendarId: calendar_id,
						eventId: targetEvent.id,
					})

					const eventData = { ...existingEvent.data }

					// Apply updates
					if (updates.summary !== undefined) eventData.summary = updates.summary
					if (updates.description !== undefined) eventData.description = updates.description
					if (updates.location !== undefined) eventData.location = updates.location
					if (updates.start_time !== undefined) {
						eventData.start = eventData.start?.date
							? { date: updates.start_time.split('T')[0] }
							: { dateTime: updates.start_time }
					}
					if (updates.end_time !== undefined) {
						eventData.end = eventData.end?.date
							? { date: updates.end_time.split('T')[0] }
							: { dateTime: updates.end_time }
					}
					if (updates.attendees !== undefined) {
						eventData.attendees = updates.attendees.map((email) => ({ email }))
					}

					const response = await currentCalendar.events.update({
						calendarId: calendar_id,
						eventId: targetEvent.id,
						requestBody: eventData,
					})

					const updatedEvent = response.data
					return {
						content: [
							{
								type: 'text',
								text: `# Event Updated Successfully

## ${updatedEvent.summary}
- **ID:** \`${updatedEvent.id}\`
- **Start:** ${updatedEvent.start?.dateTime || updatedEvent.start?.date || 'Not specified'}
- **End:** ${updatedEvent.end?.dateTime || updatedEvent.end?.date || 'Not specified'}
- **Location:** ${updatedEvent.location || 'Not specified'}
- **Description:** ${updatedEvent.description || 'No description'}
- **Status:** ${updatedEvent.status || 'Unknown'}
- **HTML Link:** ${updatedEvent.htmlLink || 'Not available'}

## Changes Applied
- Event details have been updated
- Attendees will receive updated invitations (if changed)`,
							},
						],
					}
				} else {
					// Just show event details
					const markdown = `# Event Found

## ${targetEvent.summary || 'Untitled Event'}
- **ID:** \`${targetEvent.id}\`
- **Start:** ${targetEvent.start?.dateTime || targetEvent.start?.date || 'Not specified'}
- **End:** ${targetEvent.end?.dateTime || targetEvent.end?.date || 'Not specified'}
- **Location:** ${targetEvent.location || 'Not specified'}
- **Description:** ${targetEvent.description || 'No description'}
- **Status:** ${targetEvent.status || 'Unknown'}
- **HTML Link:** ${targetEvent.htmlLink || 'Not available'}

## Next Steps
To update this event, use \`update_events\` with the Event ID and your desired changes.
To delete this event, use \`update_events\` with the Event ID and \`delete: true\`.`

					return {
						content: [{ type: 'text', text: markdown }],
					}
				}
			}, 'update events')
		}
	)
}
