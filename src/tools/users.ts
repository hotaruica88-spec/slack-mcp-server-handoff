import { cursor, defineSlackTool, json, limit, ob, on, os, s, type ToolContext } from './define';

export function registerUsers(ctx: ToolContext): void {
	const t = (spec: Parameters<typeof defineSlackTool>[1]) => defineSlackTool(ctx, spec);

	t({ name: 'users_list', method: 'users.list', readOnly: true, paginateKey: 'members', description: 'List workspace users.',
		shape: { limit, cursor, include_locale: ob('Include locale'), team_id: os('Team ID (Grid)') } });
	t({ name: 'users_info', method: 'users.info', readOnly: true, description: 'Get a user.', shape: { user: s('User ID'), include_locale: ob('Include locale') } });
	t({ name: 'users_lookup_by_email', method: 'users.lookupByEmail', readOnly: true, description: 'Find a user by email.', shape: { email: s('Email') } });
	t({ name: 'users_get_presence', method: 'users.getPresence', readOnly: true, description: 'Get presence.', shape: { user: os('User ID (default: self)') } });
	t({ name: 'users_set_presence', method: 'users.setPresence', description: 'Set own presence.', shape: { presence: s('auto|away') } });
	t({ name: 'users_conversations', method: 'users.conversations', readOnly: true, paginateKey: 'channels', description: "List a user's conversations.",
		shape: { user: os('User ID (default: self)'), types: os('public_channel,private_channel,mpim,im'), exclude_archived: ob('Exclude archived'), limit, cursor } });
	t({ name: 'users_identity', method: 'users.identity', readOnly: true, description: 'Identity of the token owner.' });
	t({ name: 'users_profile_get', method: 'users.profile.get', readOnly: true, description: 'Get a profile.', shape: { user: os('User ID'), include_labels: ob('Include labels') } });
	t({ name: 'users_profile_set', method: 'users.profile.set', description: 'Update own profile (status, name, fields…).',
		shape: { profile: json('Profile object, e.g. {"status_text":"…","status_emoji":":smile:"}'), user: os('User ID'), name: os('Single field name'), value: os('Single field value') } });
	t({ name: 'users_delete_photo', method: 'users.deletePhoto', destructive: true, description: 'Delete own profile photo.' });
	t({ name: 'users_prefs_get', method: 'users.prefs.get', readOnly: true, description: 'Internal (xoxc): get user preferences.' });
	t({ name: 'users_channel_sections_list', method: 'users.channelSections.list', readOnly: true, description: 'Internal (xoxc): list sidebar sections.' });

	// Usergroups
	t({ name: 'usergroups_list', method: 'usergroups.list', readOnly: true, description: 'List user groups.',
		shape: { include_count: ob('Include counts'), include_disabled: ob('Include disabled'), include_users: ob('Include users'), team_id: os('Team ID') } });
	t({ name: 'usergroups_create', method: 'usergroups.create', description: 'Create a user group.',
		shape: { name: s('Name'), handle: os('Handle'), description: os('Description'), channels: os('Comma-separated default channel IDs') } });
	t({ name: 'usergroups_update', method: 'usergroups.update', description: 'Update a user group.',
		shape: { usergroup: s('Usergroup ID'), name: os('Name'), handle: os('Handle'), description: os('Description'), channels: os('Channel IDs') } });
	t({ name: 'usergroups_enable', method: 'usergroups.enable', description: 'Enable a user group.', shape: { usergroup: s('Usergroup ID') } });
	t({ name: 'usergroups_disable', method: 'usergroups.disable', destructive: true, description: 'Disable a user group.', shape: { usergroup: s('Usergroup ID') } });
	t({ name: 'usergroups_users_list', method: 'usergroups.users.list', readOnly: true, description: 'List members of a user group.',
		shape: { usergroup: s('Usergroup ID'), include_disabled: ob('Include disabled') } });
	t({ name: 'usergroups_users_update', method: 'usergroups.users.update', description: 'Replace members of a user group.',
		shape: { usergroup: s('Usergroup ID'), users: s('Comma-separated user IDs (full replacement)') } });
	void on;
}
