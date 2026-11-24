import { z } from 'zod';
import { channel, cursor, defineSlackTool, json, limit, ob, on, os, s, ts, type ToolContext } from './define';

export function registerChat(ctx: ToolContext): void {
	const t = (spec: Parameters<typeof defineSlackTool>[1]) => defineSlackTool(ctx, spec);
	const msgCommon = {
		text: os('Message text (mrkdwn)'),
		blocks: json('Block Kit blocks (array or JSON string)'),
		attachments: json('Legacy attachments (array or JSON string)'),
	};

	t({ name: 'chat_post_message', method: 'chat.postMessage', description: 'Post a message (optionally in a thread).',
		shape: { channel, ...msgCommon, thread_ts: os('Reply in thread'), reply_broadcast: ob('Also send to channel'),
			unfurl_links: ob('Unfurl links'), unfurl_media: ob('Unfurl media'), mrkdwn: ob('Parse mrkdwn'), as_user: ob('Post as the user'), parse: os('none|full') } });
	t({ name: 'chat_update', method: 'chat.update', description: 'Edit a message.', shape: { channel, ts, ...msgCommon } });
	t({ name: 'chat_delete', method: 'chat.delete', destructive: true, description: 'Delete a message.', shape: { channel, ts } });
	t({ name: 'chat_me_message', method: 'chat.meMessage', description: 'Post a /me message.', shape: { channel, text: s('Text') } });
	t({ name: 'chat_post_ephemeral', method: 'chat.postEphemeral', description: 'Post an ephemeral message to one user.',
		shape: { channel, user: s('Target user ID'), ...msgCommon, thread_ts: os('Thread ts') } });
	t({ name: 'chat_get_permalink', method: 'chat.getPermalink', readOnly: true, description: 'Get a message permalink.', shape: { channel, message_ts: ts } });
	t({ name: 'chat_schedule_message', method: 'chat.scheduleMessage', description: 'Schedule a message.',
		shape: { channel, post_at: z.number().int().describe('Unix timestamp (seconds, future)'), ...msgCommon, thread_ts: os('Thread ts') } });
	t({ name: 'chat_delete_scheduled_message', method: 'chat.deleteScheduledMessage', destructive: true, description: 'Delete a scheduled message.',
		shape: { channel, scheduled_message_id: s('Scheduled message ID') } });
	t({ name: 'chat_scheduled_messages_list', method: 'chat.scheduledMessages.list', readOnly: true, paginateKey: 'scheduled_messages',
		description: 'List scheduled messages.', shape: { channel: os('Channel'), latest: os('Latest ts'), oldest: os('Oldest ts'), limit, cursor } });
	t({ name: 'chat_unfurl', method: 'chat.unfurl', description: 'Provide custom unfurl for a link.',
		shape: { channel, ts, unfurls: json('Map of URL -> unfurl object') } });

	// Reactions
	t({ name: 'reactions_add', method: 'reactions.add', description: 'Add an emoji reaction.', shape: { channel, timestamp: ts, name: s('Emoji name without colons') } });
	t({ name: 'reactions_remove', method: 'reactions.remove', description: 'Remove an emoji reaction.',
		shape: { channel: os('Channel'), timestamp: os('Message ts'), name: s('Emoji name'), file: os('File ID') } });
	t({ name: 'reactions_get', method: 'reactions.get', readOnly: true, description: 'Get reactions on an item.',
		shape: { channel: os('Channel'), timestamp: os('Message ts'), file: os('File ID'), full: ob('Return full list') } });
	t({ name: 'reactions_list', method: 'reactions.list', readOnly: true, paginateKey: 'items', description: 'List items the user reacted to.',
		shape: { user: os('User ID'), full: ob('Full list'), count: on('Items per page'), page: on('Page'), cursor, limit } });

	// Pins
	t({ name: 'pins_add', method: 'pins.add', description: 'Pin a message.', shape: { channel, timestamp: ts } });
	t({ name: 'pins_remove', method: 'pins.remove', description: 'Unpin a message.', shape: { channel, timestamp: ts } });
	t({ name: 'pins_list', method: 'pins.list', readOnly: true, description: 'List pinned items.', shape: { channel } });

	// Saved items / stars
	t({ name: 'stars_add', method: 'stars.add', description: 'Save (star) an item.', shape: { channel: os('Channel'), timestamp: os('Message ts'), file: os('File ID') } });
	t({ name: 'stars_remove', method: 'stars.remove', description: 'Remove a saved item.', shape: { channel: os('Channel'), timestamp: os('Message ts'), file: os('File ID') } });
	t({ name: 'stars_list', method: 'stars.list', readOnly: true, paginateKey: 'items', description: 'List saved items.', shape: { count: on('Items per page'), page: on('Page'), cursor, limit } });
	t({ name: 'saved_list', method: 'saved.list', readOnly: true, description: 'Internal (xoxc): list "Saved for later" items.',
		shape: { limit, filter: os('saved|completed|in_progress|archived'), cursor } });

	// Bookmarks
	t({ name: 'bookmarks_add', method: 'bookmarks.add', description: 'Add a channel bookmark.',
		shape: { channel_id: s('Channel ID'), title: s('Title'), type: s('link'), link: os('URL'), emoji: os('Emoji'), parent_id: os('Folder ID') } });
	t({ name: 'bookmarks_edit', method: 'bookmarks.edit', description: 'Edit a bookmark.',
		shape: { channel_id: s('Channel ID'), bookmark_id: s('Bookmark ID'), title: os('Title'), link: os('URL'), emoji: os('Emoji') } });
	t({ name: 'bookmarks_remove', method: 'bookmarks.remove', destructive: true, description: 'Remove a bookmark.',
		shape: { channel_id: s('Channel ID'), bookmark_id: s('Bookmark ID') } });
	t({ name: 'bookmarks_list', method: 'bookmarks.list', readOnly: true, description: 'List channel bookmarks.', shape: { channel_id: s('Channel ID') } });
}
