import { z } from 'zod';
import { channel, cursor, defineSlackTool, json, limit, ob, ok, on, os, s, withWorkspace, workspaceArg, type ToolContext } from './define';
import { slackApi } from '../slack/client';
import { parseWorkspacesPublic } from './publicWorkspaces';

export function registerMisc(ctx: ToolContext): void {
	const t = (spec: Parameters<typeof defineSlackTool>[1]) => defineSlackTool(ctx, spec);

	// Search
	t({ name: 'search_messages', method: 'search.messages', readOnly: true, description: 'Search messages (supports Slack search modifiers like in:#chan from:@user).',
		shape: { query: s('Search query'), sort: os('score|timestamp'), sort_dir: os('asc|desc'), count: on('Per page'), page: on('Page'), highlight: ob('Highlight'), cursor } });
	t({ name: 'search_files', method: 'search.files', readOnly: true, description: 'Search files.',
		shape: { query: s('Search query'), sort: os('score|timestamp'), sort_dir: os('asc|desc'), count: on('Per page'), page: on('Page') } });
	t({ name: 'search_all', method: 'search.all', readOnly: true, description: 'Search messages and files.',
		shape: { query: s('Search query'), sort: os('score|timestamp'), sort_dir: os('asc|desc'), count: on('Per page'), page: on('Page') } });
	t({ name: 'search_inline', method: 'search.inline', readOnly: true, description: 'Internal (xoxc): inline/quick search within a channel.',
		shape: { query: s('Query'), channel: os('Channel'), count: on('Count') } });
	t({ name: 'search_modules', method: 'search.modules', readOnly: true, description: 'Internal (xoxc): search modules (messages|files|channels|people).',
		shape: { query: s('Query'), module: s('messages|files|channels|people'), count: on('Count'), page: on('Page'), extracts: ob('Extracts'), highlight: ob('Highlight') } });

	// Team
	t({ name: 'team_info', method: 'team.info', readOnly: true, description: 'Workspace info.', shape: { team: os('Team ID'), domain: os('Domain') } });
	t({ name: 'team_access_logs', method: 'team.accessLogs', readOnly: true, description: 'Access logs (admin).', shape: { count: on('Per page'), page: on('Page'), before: os('Before ts') } });
	t({ name: 'team_billable_info', method: 'team.billableInfo', readOnly: true, description: 'Billable info (admin).', shape: { user: os('User ID') } });
	t({ name: 'team_integration_logs', method: 'team.integrationLogs', readOnly: true, description: 'Integration logs (admin).',
		shape: { app_id: os('App ID'), change_type: os('Change type'), count: on('Per page'), page: on('Page'), service_id: os('Service ID'), user: os('User ID') } });
	t({ name: 'team_profile_get', method: 'team.profile.get', readOnly: true, description: 'Team profile field definitions.', shape: { visibility: os('all|visible|hidden') } });
	t({ name: 'emoji_list', method: 'emoji.list', readOnly: true, description: 'List custom emoji.', shape: { include_categories: ob('Include categories') } });

	// DND
	t({ name: 'dnd_info', method: 'dnd.info', readOnly: true, description: 'Do-not-disturb status.', shape: { user: os('User ID') } });
	t({ name: 'dnd_team_info', method: 'dnd.teamInfo', readOnly: true, description: 'DND status for users.', shape: { users: s('Comma-separated user IDs') } });
	t({ name: 'dnd_set_snooze', method: 'dnd.setSnooze', description: 'Snooze notifications.', shape: { num_minutes: z.number().int().describe('Minutes') } });
	t({ name: 'dnd_end_snooze', method: 'dnd.endSnooze', description: 'End snooze.' });
	t({ name: 'dnd_end_dnd', method: 'dnd.endDnd', description: 'End DND session.' });

	// Reminders
	t({ name: 'reminders_add', method: 'reminders.add', description: 'Create a reminder.',
		shape: { text: s('Text'), time: s('Unix ts, seconds from now, or natural language'), user: os('User ID') } });
	t({ name: 'reminders_complete', method: 'reminders.complete', description: 'Complete a reminder.', shape: { reminder: s('Reminder ID') } });
	t({ name: 'reminders_delete', method: 'reminders.delete', destructive: true, description: 'Delete a reminder.', shape: { reminder: s('Reminder ID') } });
	t({ name: 'reminders_info', method: 'reminders.info', readOnly: true, description: 'Reminder info.', shape: { reminder: s('Reminder ID') } });
	t({ name: 'reminders_list', method: 'reminders.list', readOnly: true, description: 'List reminders.' });

	// Misc / internal
	t({ name: 'auth_test', method: 'auth.test', readOnly: true, description: 'Verify credentials and show identity for a workspace.' });
	t({ name: 'api_test', method: 'api.test', readOnly: true, description: 'Slack API connectivity test.' });
	t({ name: 'client_counts', method: 'client.counts', readOnly: true, description: 'Internal (xoxc): unread counts for channels/DMs/threads.',
		shape: { thread_counts_by_channel: ob('Per-channel thread counts'), org_wide_aware: ob('Org-wide aware'), include_file_channels: ob('Include file channels') } });
	t({ name: 'client_user_boot', method: 'client.userBoot', readOnly: true, description: 'Internal (xoxc): lightweight boot payload.' });
	t({ name: 'conversations_mark_all', method: 'conversations.markAll', description: 'Internal: mark everything as read.' });
	t({ name: 'workflows_triggers_list', method: 'workflows.triggers.list', readOnly: true, description: 'Internal: list workflow triggers.', shape: { cursor, limit } });
	t({ name: 'calls_info', method: 'calls.info', readOnly: true, description: 'Get call info.', shape: { id: s('Call ID') } });
	void channel; void json; void os;

	// Workspace management / generic escape hatch
	ctx.server.registerTool(
		'list_workspaces',
		{
			description: 'List configured Slack workspaces (names only; credentials are never returned).',
			inputSchema: {},
			annotations: { readOnlyHint: true },
		},
		async () => ok(parseWorkspacesPublic(ctx.workspaces)),
	);

	ctx.server.registerTool(
		'auth_test_all',
		{ description: 'Run auth.test against every configured workspace.', inputSchema: {}, annotations: { readOnlyHint: true, openWorldHint: true } },
		async () => {
			const results = await Promise.all(
				ctx.workspaces.map(async (ws) => {
					try {
						const r = await slackApi(ws, 'auth.test');
						return { workspace: ws.name, ok: true, team: r.team, team_id: r.team_id, user: r.user, user_id: r.user_id, url: r.url };
					} catch (e) {
						return { workspace: ws.name, ok: false, error: e instanceof Error ? e.message : String(e) };
					}
				}),
			);
			return { content: [{ type: 'text' as const, text: JSON.stringify(results, null, 2) }] };
		},
	);

	ctx.server.registerTool(
		'slack_api_call',
		{
			description: 'Call ANY Slack Web API method (e.g. "conversations.history"). Use when no dedicated tool exists. Params are form-encoded; objects/arrays are JSON-stringified.',
			inputSchema: {
				workspace: workspaceArg,
				method: s('Slack method name, e.g. "users.admin.invite"'),
				params: z.record(z.string(), z.any()).optional().describe('Method parameters'),
			},
			annotations: { destructiveHint: true, openWorldHint: true },
		},
		async ({ workspace, method, params }: { workspace?: string; method: string; params?: Record<string, unknown> }) =>
			withWorkspace(ctx, workspace, async (ws) => {
				if (!/^[a-zA-Z0-9_.]+$/.test(method)) throw new Error('Invalid method name');
				return slackApi(ws, method, params ?? {});
			}),
	);
}
