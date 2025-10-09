import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { Auth, calendar_v3 } from 'googleapis'
import { google } from 'googleapis'
import { z } from 'zod'
import { safeAsyncOperation } from '../errors.js'

export function registerConsolidatedCalendarTools(
	server: McpServer,
	_calendar: calendar_v3.Calendar,
	oauth2Client: Auth.OAuth2Client
) {
	// Helper function to get a fresh calendar instance with current credentials
	const getCalendar = () => {
		return google.calendar({ version: 'v3', auth: oauth2Client })
	}

	// Tool: List Calendars (keeping this as-is since it's already well-designed)
	server.tool('list_calendars', 'List all calendars accessible to the user', {}, async () => {
		return safeAsyncOperation(async () => {
			const currentCalendar = getCalendar()
			const response = await currentCalendar.calendarList.list()
			const calendars = response.data.items || []

			const markdown = `# Available Calendars

${
	calendars.length === 0
		? 'No calendars found.'
		: calendars
				.map(
					(cal) => `
## ${cal.summary || 'Untitled Calendar'}
- **ID:** \`${cal.id}\`
- **Description:** ${cal.description || 'No description'}
- **Time Zone:** ${cal.timeZone || 'Not specified'}
- **Access Role:** ${cal.accessRole || 'Unknown'}
- **Primary:** ${cal.primary ? 'Yes' : 'No'}
`
				)
				.join('\n')
}

**Total:** ${calendars.length} calendar${calendars.length !== 1 ? 's' : ''}`

			return {
				content: [{ type: 'text', text: markdown }],
			}
		}, 'list calendars')
	})

	// Tool: Manage Calendars (consolidated create, get, update, delete)
	server.tool(
		'manage_calendars',
		'Create, get details, update, or delete calendars',
		{
			// Calendar identification
			calendar_id: z.string().optional().describe("Calendar ID (use 'primary' for the user's primary calendar)"),
			calendar_name: z.string().optional().describe('Calendar name to search for (for operations on existing calendars)'),
			
			// Create operation
			create: z.boolean().default(false).describe('Set to true to create a new calendar'),
			summary: z.string().optional().describe('Calendar title/name (required for create)'),
			description: z.string().optional().describe('Calendar description'),
			time_zone: z.string().optional().describe("Time zone (e.g., 'America/New_York')"),
			
			// Update operation
			update: z.boolean().default(false).describe('Set to true to update an existing calendar'),
			updates: z.object({
				summary: z.string().optional(),
				description: z.string().optional(),
				time_zone: z.string().optional()
			}).optional().describe('Fields to update'),
			
			// Delete operation
			delete: z.boolean().default(false).describe('Set to true to delete a calendar'),
			force_delete: z.boolean().default(false).describe('Skip confirmation for calendar deletion (use with caution)')
		},
		async (params) => {
			return safeAsyncOperation(async () => {
				const {
					calendar_id,
					calendar_name,
					create,
					summary,
					description,
					time_zone,
					update,
					updates,
					delete: shouldDelete,
					force_delete
				} = params

				const currentCalendar = getCalendar()

				// Handle create operation
				if (create) {
					if (!summary) {
						throw new Error('Calendar summary (name) is required for creation')
					}

					const response = await currentCalendar.calendars.insert({
						requestBody: {
							summary,
							description,
							timeZone: time_zone,
						},
					})

					const cal = response.data
					const markdown = `# Calendar Created Successfully

## ${cal.summary}
- **ID:** \`${cal.id}\`
- **Description:** ${cal.description || 'No description'}
- **Time Zone:** ${cal.timeZone || 'Not specified'}
- **ETag:** ${cal.etag}

## Next Steps
- You can now add events to this calendar
- Use the calendar ID \`${cal.id}\` in event operations
- The calendar will appear in your Google Calendar interface`

					return {
						content: [{ type: 'text', text: markdown }],
					}
				}

				// Handle delete operation
				if (shouldDelete) {
					let targetCalendarId = calendar_id

					// If no calendar_id provided, search by name
					if (!targetCalendarId && calendar_name) {
						const listResponse = await currentCalendar.calendarList.list()
						const calendars = listResponse.data.items || []
						const matchingCalendars = calendars.filter(cal => 
							cal.summary?.toLowerCase().includes(calendar_name.toLowerCase())
						)

						if (matchingCalendars.length === 0) {
							return {
								content: [{ type: 'text', text: `# No Calendar Found

No calendar found with name containing "${calendar_name}".

Use \`list_calendars\` to see all available calendars.` }],
							}
						}

						if (matchingCalendars.length > 1 && !force_delete) {
							const markdown = `# Multiple Calendars Found - Please Choose One

Found ${matchingCalendars.length} calendars matching "${calendar_name}":

${matchingCalendars
	.map(
		(cal, index) => `
## Option ${index + 1}: ${cal.summary}
- **ID:** \`${cal.id}\`
- **Description:** ${cal.description || 'No description'}
- **Time Zone:** ${cal.timeZone || 'Not specified'}
- **Primary:** ${cal.primary ? 'Yes' : 'No'}
`
	)
	.join('\n')}

## To Delete a Specific Calendar:
1. **Use the exact calendar ID** with \`calendar_id\` parameter
2. **Or use force_delete=true** to delete the first match (use with caution)

## Example:
\`\`\`
manage_calendars
calendar_id: "abc123def456"
delete: true
\`\`\``

							return {
								content: [{ type: 'text', text: markdown }],
							}
						}

						targetCalendarId = matchingCalendars[0].id
					}

					if (!targetCalendarId) {
						throw new Error('Either calendar_id or calendar_name must be provided for deletion')
					}

					if (targetCalendarId === 'primary') {
						return {
							content: [{ type: 'text', text: '**ERROR:** Cannot delete the primary calendar' }],
						}
					}

					// Get calendar details before deletion for confirmation
					const calendarDetails = await currentCalendar.calendarList.get({
						calendarId: targetCalendarId,
					})

					await currentCalendar.calendars.delete({
						calendarId: targetCalendarId,
					})

					const markdown = `# Calendar Deleted Successfully

## Deleted Calendar Details:
- **Name:** ${calendarDetails.data.summary || 'Untitled Calendar'}
- **ID:** \`${targetCalendarId}\`
- **Description:** ${calendarDetails.data.description || 'No description'}
- **Time Zone:** ${calendarDetails.data.timeZone || 'Not specified'}

**WARNING:** This action cannot be undone. All events in this calendar have been permanently removed.

## Next Steps:
- The calendar has been permanently deleted
- All events in this calendar are gone
- You can create a new calendar using \`manage_calendars\` with \`create: true\``

					return {
						content: [{ type: 'text', text: markdown }],
					}
				}

				// Handle update operation
				if (update) {
					if (!calendar_id) {
						throw new Error('calendar_id is required for updates')
					}

					if (!updates || Object.keys(updates).length === 0) {
						throw new Error('At least one field must be provided in updates object')
					}

					// Get existing calendar
					const existingCalendar = await currentCalendar.calendarList.get({
						calendarId: calendar_id,
					})

					// Prepare update data
					const updateData: any = {}
					if (updates.summary !== undefined) updateData.summary = updates.summary
					if (updates.description !== undefined) updateData.description = updates.description
					if (updates.time_zone !== undefined) updateData.timeZone = updates.time_zone

					// Update the calendar
					const response = await currentCalendar.calendars.update({
						calendarId: calendar_id,
						requestBody: updateData,
					})

					const updatedCalendar = response.data
					const markdown = `# Calendar Updated Successfully

## ${updatedCalendar.summary}
- **ID:** \`${updatedCalendar.id}\`
- **Description:** ${updatedCalendar.description || 'No description'}
- **Time Zone:** ${updatedCalendar.timeZone || 'Not specified'}
- **ETag:** ${updatedCalendar.etag}

## Changes Applied:
${updates.summary !== undefined ? `- **Name:** Updated to "${updates.summary}"\n` : ''}${
	updates.description !== undefined ? `- **Description:** Updated to "${updates.description}"\n` : ''
}${
	updates.time_zone !== undefined ? `- **Time Zone:** Updated to "${updates.time_zone}"\n` : ''
}

## Next Steps:
- The calendar has been updated
- Changes will be reflected in your Google Calendar interface
- You can continue using the same calendar ID for events`

					return {
						content: [{ type: 'text', text: markdown }],
					}
				}

				// Handle get details operation (default behavior)
				let targetCalendarId = calendar_id

				// If no calendar_id provided, search by name
				if (!targetCalendarId && calendar_name) {
					const listResponse = await currentCalendar.calendarList.list()
					const calendars = listResponse.data.items || []
					const matchingCalendars = calendars.filter(cal => 
						cal.summary?.toLowerCase().includes(calendar_name.toLowerCase())
					)

					if (matchingCalendars.length === 0) {
						return {
							content: [{ type: 'text', text: `# No Calendar Found

No calendar found with name containing "${calendar_name}".

Use \`list_calendars\` to see all available calendars.` }],
						}
					}

					if (matchingCalendars.length > 1) {
						const markdown = `# Multiple Calendars Found - Please Choose One

Found ${matchingCalendars.length} calendars matching "${calendar_name}":

${matchingCalendars
	.map(
		(cal, index) => `
## Option ${index + 1}: ${cal.summary}
- **ID:** \`${cal.id}\`
- **Description:** ${cal.description || 'No description'}
- **Time Zone:** ${cal.timeZone || 'Not specified'}
- **Primary:** ${cal.primary ? 'Yes' : 'No'}
`
	)
	.join('\n')}

## To Get Details for a Specific Calendar:
Use the exact calendar ID with the \`calendar_id\` parameter.

## Example:
\`\`\`
manage_calendars
calendar_id: "abc123def456"
\`\`\``

						return {
							content: [{ type: 'text', text: markdown }],
						}
					}

					targetCalendarId = matchingCalendars[0].id
				}

				if (!targetCalendarId) {
					throw new Error('Either calendar_id or calendar_name must be provided')
				}

				const response = await currentCalendar.calendarList.get({
					calendarId: targetCalendarId,
				})

				const cal = response.data
				const markdown = `# Calendar Details

## ${cal.summary || 'Untitled Calendar'}
- **ID:** \`${cal.id}\`
- **Description:** ${cal.description || 'No description'}
- **Time Zone:** ${cal.timeZone || 'Not specified'}
- **Access Role:** ${cal.accessRole || 'Unknown'}
- **Primary:** ${cal.primary ? 'Yes' : 'No'}
- **Background Color:** ${cal.backgroundColor || 'Default'}
- **Foreground Color:** ${cal.foregroundColor || 'Default'}
- **Selected:** ${cal.selected ? 'Yes' : 'No'}
- **Summary Override:** ${cal.summaryOverride || 'None'}

## Access Information
- **Access Role:** ${cal.accessRole}
- **Default Reminders:** ${cal.defaultReminders?.length ? cal.defaultReminders.map((r) => `${r.method} (${r.minutes} min)`).join(', ') : 'None'}
- **Notification Settings:** ${cal.notificationSettings?.notifications?.length ? cal.notificationSettings.notifications.map((n) => n.type).join(', ') : 'None'}

## Available Operations
- **Update:** Use \`manage_calendars\` with \`update: true\` and \`updates\` object
- **Delete:** Use \`manage_calendars\` with \`delete: true\` (cannot delete primary calendar)
- **List Events:** Use \`list_events\` with this calendar ID`

				return {
					content: [{ type: 'text', text: markdown }],
				}
			}, 'manage calendars')
		}
	)
}
