import type { AppEnv } from '../env';

export interface Workspace {
	name: string;
	token: string;
	cookie?: string;
	default?: boolean;
	teamId?: string;
	domain?: string;
}

export function normalizeCookie(cookie?: string): string | undefined {
	if (!cookie) return undefined;
	const c = cookie.trim();
	if (!c) return undefined;
	// Bare "xoxd-..." value -> d cookie; otherwise assume a full Cookie header.
	return c.startsWith('xoxd-') ? `d=${c}` : c;
}

function toWorkspace(o: Record<string, unknown>, label: string, i: number, sharedCookie?: string): Workspace {
	if (typeof o.token !== 'string' || !o.token) throw new Error(`${label}.token is required`);
	return {
		name: typeof o.name === 'string' && o.name ? o.name : `workspace${i + 1}`,
		token: o.token,
		cookie: normalizeCookie(typeof o.cookie === 'string' ? o.cookie : undefined) ?? sharedCookie,
		default: o.default === true,
		teamId: typeof o.team_id === 'string' ? o.team_id : undefined,
		domain: typeof o.domain === 'string' ? o.domain : undefined,
	};
}

function parseJson(text: string, label: string): unknown {
	try {
		return JSON.parse(text);
	} catch {
		throw new Error(`${label} is not valid JSON`);
	}
}

/**
 * Workspaces come from SLACK_WORKSPACES (JSON array) and/or any number of
 * SLACK_WORKSPACE_* variables (one JSON object each). Each Workers variable is
 * limited to 5 KB, so split workspaces across variables when needed.
 */
export function parseWorkspaces(env: AppEnv): Workspace[] {
	const sharedCookie = normalizeCookie(typeof env.SLACK_COOKIE === 'string' ? env.SLACK_COOKIE : undefined);
	const out: Workspace[] = [];

	if (env.SLACK_WORKSPACES) {
		const raw = parseJson(env.SLACK_WORKSPACES, 'SLACK_WORKSPACES');
		if (!Array.isArray(raw)) throw new Error('SLACK_WORKSPACES must be a JSON array');
		raw.forEach((w, i) => out.push(toWorkspace(w as Record<string, unknown>, `SLACK_WORKSPACES[${i}]`, out.length, sharedCookie)));
	}

	for (const key of Object.keys(env).filter((k) => k.startsWith('SLACK_WORKSPACE_')).sort()) {
		const v = env[key];
		if (typeof v !== 'string') continue;
		const raw = parseJson(v, key);
		if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new Error(`${key} must be a JSON object`);
		out.push(toWorkspace(raw as Record<string, unknown>, key, out.length, sharedCookie));
	}

	if (out.length === 0) throw new Error('No workspaces configured (set SLACK_WORKSPACES or SLACK_WORKSPACE_*)');
	return out;
}

export function resolveWorkspace(workspaces: Workspace[], selector?: string): Workspace {
	if (selector) {
		const s = selector.toLowerCase();
		const hit = workspaces.find(
			(w) => w.name.toLowerCase() === s || w.teamId?.toLowerCase() === s || w.domain?.toLowerCase() === s,
		);
		if (!hit) {
			throw new Error(`Unknown workspace "${selector}". Available: ${workspaces.map((w) => w.name).join(', ')}`);
		}
		return hit;
	}
	if (workspaces.length === 1) return workspaces[0];
	const def = workspaces.find((w) => w.default);
	if (def) return def;
	throw new Error(
		`Multiple workspaces configured; specify "workspace". Available: ${workspaces.map((w) => w.name).join(', ')}`,
	);
}
