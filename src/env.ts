// Secrets are not declared in wrangler.jsonc, so they are typed here.
export interface AppEnv {
	MCP_AUTH_TOKEN?: string;
	/** JSON array of workspaces (single variable, max 5 KB). */
	SLACK_WORKSPACES?: string;
	/** Shared "d" cookie used by any workspace that has no cookie of its own. */
	SLACK_COOKIE?: string;
	/** Per-workspace variables: SLACK_WORKSPACE_<anything> = JSON object. */
	[key: string]: unknown;
}
