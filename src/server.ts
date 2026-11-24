import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerAllTools } from './tools';
import type { Workspace } from './slack/workspaces';

export function createServer(workspaces: Workspace[]): McpServer {
	const server = new McpServer({ name: 'slack-mcp-server', version: '1.0.0' });
	registerAllTools({ server, workspaces });
	return server;
}
