import type { Workspace } from '../slack/workspaces';

/** Credential-free view of workspaces. */
export function parseWorkspacesPublic(workspaces: Workspace[]) {
	return workspaces.map((w) => ({
		name: w.name,
		default: w.default === true,
		team_id: w.teamId,
		domain: w.domain,
		token_type: w.token.split('-')[0],
		has_cookie: Boolean(w.cookie),
	}));
}
