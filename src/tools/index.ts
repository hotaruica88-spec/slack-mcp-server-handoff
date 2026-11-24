import type { ToolContext } from './define';
import { registerChat } from './chat';
import { registerConversations } from './conversations';
import { registerFiles } from './files';
import { registerMisc } from './misc';
import { registerUsers } from './users';

export function registerAllTools(ctx: ToolContext): void {
	registerConversations(ctx);
	registerChat(ctx);
	registerFiles(ctx);
	registerUsers(ctx);
	registerMisc(ctx);
}
