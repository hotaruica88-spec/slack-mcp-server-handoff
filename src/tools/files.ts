import { z } from 'zod';
import { slackApi, slackFetchFile, uploadToSlackUrl } from '../slack/client';
import { channel, cursor, defineSlackTool, ob, on, os, s, withWorkspace, workspaceArg, type ToolContext } from './define';

const MAX_DOWNLOAD_BYTES = 8 * 1024 * 1024;

function b64ToBytes(b64: string): Uint8Array {
	const bin = atob(b64);
	const out = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
	return out;
}
function bytesToB64(bytes: Uint8Array): string {
	let bin = '';
	for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
	return btoa(bin);
}

export function registerFiles(ctx: ToolContext): void {
	const t = (spec: Parameters<typeof defineSlackTool>[1]) => defineSlackTool(ctx, spec);

	t({ name: 'files_list', method: 'files.list', readOnly: true, paginateKey: 'files', description: 'List files.',
		shape: { channel: os('Channel'), user: os('User'), types: os('all,spaces,snippets,images,gdocs,zips,pdfs'),
			ts_from: os('From ts'), ts_to: os('To ts'), count: on('Per page'), page: on('Page'), show_files_hidden_by_limit: ob('Include hidden') } });
	t({ name: 'files_info', method: 'files.info', readOnly: true, description: 'Get file info.',
		shape: { file: s('File ID'), count: on('Comments per page'), page: on('Page'), cursor } });
	t({ name: 'files_delete', method: 'files.delete', destructive: true, description: 'Delete a file.', shape: { file: s('File ID') } });
	t({ name: 'files_shared_public_url', method: 'files.sharedPublicURL', description: 'Enable a public link for a file.', shape: { file: s('File ID') } });
	t({ name: 'files_revoke_public_url', method: 'files.revokePublicURL', description: 'Revoke a file public link.', shape: { file: s('File ID') } });
	t({ name: 'files_comments_delete', method: 'files.comments.delete', destructive: true, description: 'Delete a file comment.',
		shape: { file: s('File ID'), id: s('Comment ID') } });
	t({ name: 'files_remote_list', method: 'files.remote.list', readOnly: true, description: 'List remote files.',
		shape: { channel: os('Channel'), cursor, limit: on('Limit') } });

	ctx.server.registerTool(
		'files_download',
		{
			description: `Download a Slack file (url_private) with workspace credentials. Returns text for text files, else base64. Max ${MAX_DOWNLOAD_BYTES} bytes.`,
			inputSchema: { workspace: workspaceArg, file: os('File ID (resolved via files.info)'), url: os('Direct url_private / url_private_download') },
			annotations: { readOnlyHint: true, openWorldHint: true },
		},
		async ({ workspace, file, url }: { workspace?: string; file?: string; url?: string }) =>
			withWorkspace(ctx, workspace, async (ws) => {
				let target = url;
				let meta: Record<string, unknown> = {};
				if (!target) {
					if (!file) throw new Error('Provide file or url');
					const info = await slackApi(ws, 'files.info', { file });
					target = info.file.url_private_download ?? info.file.url_private;
					meta = { name: info.file.name, mimetype: info.file.mimetype, size: info.file.size };
				}
				const res = await slackFetchFile(ws, target!);
				if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);
				const len = Number(res.headers.get('content-length') ?? 0);
				if (len > MAX_DOWNLOAD_BYTES) throw new Error(`File too large (${len} bytes)`);
				const buf = new Uint8Array(await res.arrayBuffer());
				if (buf.length > MAX_DOWNLOAD_BYTES) throw new Error(`File too large (${buf.length} bytes)`);
				const type = res.headers.get('content-type') ?? '';
				const isText = /^text\/|json|xml|javascript/.test(type);
				return { ...meta, content_type: type, bytes: buf.length,
					...(isText ? { text: new TextDecoder().decode(buf) } : { base64: bytesToB64(buf) }) };
			}),
	);

	ctx.server.registerTool(
		'files_upload',
		{
			description: 'Upload a file (v2 external upload flow) and optionally share it to a channel.',
			inputSchema: {
				workspace: workspaceArg,
				filename: s('File name'),
				content: os('Text content'),
				content_base64: os('Binary content, base64'),
				title: os('Title'),
				channel_id: os('Channel to share into'),
				thread_ts: os('Thread ts'),
				initial_comment: os('Message text'),
			},
			annotations: { openWorldHint: true },
		},
		async (a: { workspace?: string; filename: string; content?: string; content_base64?: string; title?: string; channel_id?: string; thread_ts?: string; initial_comment?: string }) =>
			withWorkspace(ctx, a.workspace, async (ws) => {
				const bytes = a.content_base64 ? b64ToBytes(a.content_base64) : new TextEncoder().encode(a.content ?? '');
				const start = await slackApi(ws, 'files.getUploadURLExternal', { filename: a.filename, length: bytes.length });
				await uploadToSlackUrl(start.upload_url, bytes);
				return slackApi(ws, 'files.completeUploadExternal', {
					files: [{ id: start.file_id, title: a.title ?? a.filename }],
					channel_id: a.channel_id, thread_ts: a.thread_ts, initial_comment: a.initial_comment,
				});
			}),
	);
	void z; void channel;
}
