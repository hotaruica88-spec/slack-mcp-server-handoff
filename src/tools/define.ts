import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z, type ZodRawShape } from 'zod';
import { paginate, slackApi, SlackApiError } from '../slack/client';
import { resolveWorkspace, type Workspace } from '../slack/workspaces';

export interface ToolContext {
	server: McpServer;
	workspaces: Workspace[];
}

export const workspaceArg = z
	.string()
	.optional()
	.describe('Workspace name / team ID / domain. Optional when one workspace (or a default) is configured.');

const MAX_OUTPUT_CHARS = 200_000;

export function ok(data: unknown): CallToolResult {
	let text = JSON.stringify(data, null, 2);
	if (text.length > MAX_OUTPUT_CHARS) text = text.slice(0, MAX_OUTPUT_CHARS) + '\n...[truncated]';
	return { content: [{ type: 'text', text }] };
}

export function fail(e: unknown): CallToolResult {
	const msg = e instanceof Error ? e.message : String(e);
	return { isError: true, content: [{ type: 'text', text: e instanceof SlackApiError ? `${msg}` : msg }] };
}

/** Run a handler with the resolved workspace and uniform error handling. */
export async function withWorkspace(
	ctx: ToolContext,
	selector: string | undefined,
	fn: (ws: Workspace) => Promise<unknown>,
): Promise<CallToolResult> {
	try {
		return ok(await fn(resolveWorkspace(ctx.workspaces, selector)));
	} catch (e) {
		return fail(e);
	}
}

export interface SlackToolSpec {
	/** MCP tool name */
	name: string;
	/** Slack Web API method, e.g. "conversations.history" */
	method: string;
	description: string;
	shape?: ZodRawShape;
	readOnly?: boolean;
	destructive?: boolean;
	/** If set, adds fetch_all/max_pages and merges this array field across pages. */
	paginateKey?: string;
}

/** Declare a tool that maps 1:1 onto a Slack Web API method. */
export function defineSlackTool(ctx: ToolContext, spec: SlackToolSpec): void {
	const shape: ZodRawShape = {
		workspace: workspaceArg,
		...(spec.shape ?? {}),
		...(spec.paginateKey
			? {
					fetch_all: z.boolean().optional().describe('Follow cursors and merge all pages (bounded by max_pages).'),
					max_pages: z.number().int().min(1).max(100).optional().describe('Page cap for fetch_all (default 10).'),
				}
			: {}),
	};

	ctx.server.registerTool(
		spec.name,
		{
			description: `${spec.description} (Slack: ${spec.method})`,
			inputSchema: shape,
			annotations: {
				readOnlyHint: spec.readOnly ?? false,
				destructiveHint: spec.destructive ?? false,
				openWorldHint: true,
			},
		},
		async (args: Record<string, unknown>) => {
			const { workspace, fetch_all, max_pages, ...params } = args;
			return withWorkspace(ctx, workspace as string | undefined, (ws) =>
				spec.paginateKey && fetch_all
					? paginate(ws, spec.method, params, spec.paginateKey, (max_pages as number) ?? 10)
					: slackApi(ws, spec.method, params),
			);
		},
	);
}

// Common argument fragments
export const s = (d: string) => z.string().describe(d);
export const os = (d: string) => z.string().optional().describe(d);
export const on = (d: string) => z.number().optional().describe(d);
export const ob = (d: string) => z.boolean().optional().describe(d);
export const channel = s('Channel / conversation ID (e.g. C0123, D0123, G0123)');
export const ts = s('Message timestamp (e.g. 1700000000.000100)');
export const cursor = os('Pagination cursor from a previous response');
export const limit = on('Max items per page');
/** Free-form JSON (blocks, attachments, etc.) passed through to Slack. */
export const json = (d: string) => z.union([z.string(), z.array(z.any()), z.record(z.string(), z.any())]).optional().describe(d);
