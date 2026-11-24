import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { Hono, type Context } from 'hono';
import type { AppEnv } from './env';
import { createServer } from './server';
import { parseWorkspaces } from './slack/workspaces';

const app = new Hono<{ Bindings: AppEnv }>();

/** Constant-time string compare (hashes both sides so length doesn't leak). */
async function safeEqual(a: string, b: string): Promise<boolean> {
	const enc = new TextEncoder();
	const [ha, hb] = await Promise.all([
		crypto.subtle.digest('SHA-256', enc.encode(a)),
		crypto.subtle.digest('SHA-256', enc.encode(b)),
	]);
	return crypto.subtle.timingSafeEqual(ha, hb);
}

app.get('/health', (c) => c.json({ ok: true }));

async function handleMcp(c: Context<{ Bindings: AppEnv }>, urlToken?: string): Promise<Response> {
	const expected = c.env.MCP_AUTH_TOKEN;
	if (!expected) return c.json({ error: 'Server misconfigured: MCP_AUTH_TOKEN not set' }, 500);
	// Accept the token from the Authorization header or from the URL (/mcp/<token>)
	// for clients such as ChatGPT that cannot send custom headers.
	const m = /^Bearer\s+(.+)$/i.exec(c.req.header('Authorization') ?? '');
	const provided = m?.[1] ?? urlToken;
	if (!provided || !(await safeEqual(provided, expected))) {
		return c.json({ error: 'Unauthorized' }, 401, { 'WWW-Authenticate': 'Bearer' });
	}

	let workspaces;
	try {
		workspaces = parseWorkspaces(c.env);
	} catch (e) {
		return c.json({ error: e instanceof Error ? e.message : 'Invalid workspace config' }, 500);
	}

	// Stateless: fresh server + transport per request.
	const server = createServer(workspaces);
	const transport = new WebStandardStreamableHTTPServerTransport({
		sessionIdGenerator: undefined,
		enableJsonResponse: true,
	});
	await server.connect(transport);
	return transport.handleRequest(c.req.raw);
}

app.all('/mcp', (c) => handleMcp(c));
app.all('/mcp/:token', (c) => handleMcp(c, c.req.param('token')));

app.notFound((c) => c.json({ error: 'Not found' }, 404));

export default app;
