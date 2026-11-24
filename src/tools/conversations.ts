import { z } from 'zod';
import { channel, cursor, defineSlackTool, limit, ob, on, os, s, ts, type ToolContext } from './define';

export function registerConversations(ctx: ToolContext): void {
	const t = (spec: Parameters<typeof defineSlackTool>[1]) => defineSlackTool(ctx, spec);

	t({
		name: 'conversations_list', method: 'conversations.list', readOnly: true, paginateKey: 'channels',
		description: 'List channels/DMs visible to the user.',
		shape: {
			types: os('Comma-separated: public_channel,private_channel,mpim,im (default public_channel)'),
			exclude_archived: ob('Exclude archived channels'), limit, cursor, team_id: os('Team ID (Enterprise Grid)'),
		},
	});
	t({ name: 'conversations_info', method: 'conversations.info', readOnly: true, description: 'Get channel info.',
		shape: { channel, include_num_members: ob('Include member count'), include_locale: ob('Include locale') } });
	t({ name: 'conversations_history', method: 'conversations.history', readOnly: true, paginateKey: 'messages',
		description: 'Fetch channel messages (newest first).',
		shape: { channel, oldest: os('Only after this ts'), latest: os('Only before this ts'), inclusive: ob('Include oldest/latest bounds'), limit, cursor } });
	t({ name: 'conversations_replies', method: 'conversations.replies', readOnly: true, paginateKey: 'messages',
		description: 'Fetch a thread (parent + replies).',
		shape: { channel, ts, oldest: os('Only after this ts'), latest: os('Only before this ts'), inclusive: ob('Include bounds'), limit, cursor } });
	t({ name: 'conversations_members', method: 'conversations.members', readOnly: true, paginateKey: 'members',
		description: 'List member user IDs of a channel.', shape: { channel, limit, cursor } });
	t({ name: 'conversations_join', method: 'conversations.join', description: 'Join a public channel.', shape: { channel } });
	t({ name: 'conversations_leave', method: 'conversations.leave', destructive: true, description: 'Leave a channel.', shape: { channel } });
	t({ name: 'conversations_open', method: 'conversations.open',
		description: 'Open/resume a DM or group DM (provide users or channel).',
		shape: { users: os('Comma-separated user IDs (1 = DM, 2+ = group DM)'), channel: os('Existing conversation ID'), return_im: ob('Return full IM object') } });
	t({ name: 'conversations_close', method: 'conversations.close', description: 'Close a DM / group DM.', shape: { channel } });
	t({ name: 'conversations_create', method: 'conversations.create', description: 'Create a channel.',
		shape: { name: s('Channel name'), is_private: ob('Create private channel'), team_id: os('Team ID (Enterprise Grid)') } });
	t({ name: 'conversations_archive', method: 'conversations.archive', destructive: true, description: 'Archive a channel.', shape: { channel } });
	t({ name: 'conversations_unarchive', method: 'conversations.unarchive', description: 'Unarchive a channel.', shape: { channel } });
	t({ name: 'conversations_rename', method: 'conversations.rename', description: 'Rename a channel.', shape: { channel, name: s('New name') } });
	t({ name: 'conversations_invite', method: 'conversations.invite', description: 'Invite users to a channel.',
		shape: { channel, users: s('Comma-separated user IDs'), force: ob('Skip invalid users') } });
	t({ name: 'conversations_kick', method: 'conversations.kick', destructive: true, description: 'Remove a user from a channel.',
		shape: { channel, user: s('User ID') } });
	t({ name: 'conversations_set_topic', method: 'conversations.setTopic', description: 'Set channel topic.', shape: { channel, topic: s('Topic') } });
	t({ name: 'conversations_set_purpose', method: 'conversations.setPurpose', description: 'Set channel purpose.', shape: { channel, purpose: s('Purpose') } });
	t({ name: 'conversations_mark', method: 'conversations.mark', description: 'Mark conversation as read up to ts.', shape: { channel, ts } });
	t({ name: 'conversations_view', method: 'conversations.view', readOnly: true,
		description: 'Internal (xoxc): load conversation view with history and read state.',
		shape: { channel, canonical_avatars: ob('Use canonical avatars'), no_user_profile: ob('Omit user profiles') } });
	t({ name: 'conversations_mute', method: 'users.prefs.set', description: 'Set a user preference by name (e.g. muted_channels = comma-separated IDs).',
		shape: { name: s('Preference name'), value: s('Preference value') } });
	t({ name: 'conversations_canvases_create', method: 'conversations.canvases.create', description: 'Create a channel canvas.',
		shape: { channel_id: s('Channel ID'), document_content: z.any().optional().describe('Canvas content object {type:"markdown",markdown:"..."}') } });
	void on;
}
