import type { Workspace } from './workspaces';

export class SlackApiError extends Error {
	constructor(
		public method: string,
		public slackError: string,
		public response?: unknown,
	) {
		super(`Slack API error (${method}): ${slackError}`);
	}
}

type Params = Record<string, unknown>;
const MAX_RETRIES = 5;

function headers(ws: Workspace, extra: Record<string, string> = {}): Record<string, string> {
	return {
		Authorization: `Bearer ${ws.token}`,
		...(ws.cookie ? { Cookie: ws.cookie } : {}),
		...extra,
	};
}

function toForm(params: Params): URLSearchParams {
	const form = new URLSearchParams();
	for (const [k, v] of Object.entries(params)) {
		if (v === undefined || v === null) continue;
		form.set(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
	}
	return form;
}

/** Call a Slack Web API method. Form-encoded POST (works for xoxc + cookie and xoxp). */
export async function slackApi(ws: Workspace, method: string, params: Params = {}): Promise<Record<string, any>> {
	for (let attempt = 0; ; attempt++) {
		const res = await fetch(`https://slack.com/api/${method}`, {
			method: 'POST',
			headers: headers(ws, { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' }),
			body: toForm(params),
		});

		if (res.status === 429) {
			if (attempt >= MAX_RETRIES) throw new SlackApiError(method, 'rate_limited (max retries exceeded)');
			const retryAfter = Number(res.headers.get('Retry-After'));
			const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 2 ** attempt * 1000;
			await new Promise((r) => setTimeout(r, Math.min(waitMs, 15_000)));
			continue;
		}

		const json = (await res.json()) as Record<string, any>;
		if (!json.ok) throw new SlackApiError(method, String(json.error ?? 'unknown_error'), json);
		return json;
	}
}

/** Authenticated GET/PUT of a Slack-hosted file (url_private etc). */
export async function slackFetchFile(ws: Workspace, url: string): Promise<Response> {
	const u = new URL(url);
	if (!/(^|\.)slack\.com$|(^|\.)slack-edge\.com$|(^|\.)slack-files\.com$/.test(u.hostname) || u.protocol !== 'https:') {
		throw new Error('Refusing to send Slack credentials to a non-Slack host');
	}
	return fetch(url, { headers: headers(ws), redirect: 'follow' });
}

/** Upload raw bytes to a pre-signed upload URL returned by files.getUploadURLExternal. */
export async function uploadToSlackUrl(url: string, bytes: Uint8Array): Promise<void> {
	const u = new URL(url);
	if (u.protocol !== 'https:' || !/(^|\.)slack\.com$|(^|\.)slack-edge\.com$/.test(u.hostname)) {
		throw new Error('Unexpected upload host');
	}
	const res = await fetch(url, { method: 'POST', body: bytes });
	if (!res.ok) throw new Error(`File upload failed: HTTP ${res.status}`);
}

/** Follow response_metadata.next_cursor up to maxPages, merging array field `key`. */
export async function paginate(
	ws: Workspace,
	method: string,
	params: Params,
	key: string,
	maxPages: number,
): Promise<Record<string, any>> {
	const items: unknown[] = [];
	let cursor: string | undefined = params.cursor as string | undefined;
	let last: Record<string, any> = {};
	for (let page = 0; page < maxPages; page++) {
		last = await slackApi(ws, method, { ...params, cursor });
		items.push(...((last[key] as unknown[]) ?? []));
		cursor = last.response_metadata?.next_cursor || undefined;
		if (!cursor) break;
	}
	return { ...last, [key]: items, response_metadata: { next_cursor: cursor ?? '' }, fetched_pages_limit: maxPages };
}
