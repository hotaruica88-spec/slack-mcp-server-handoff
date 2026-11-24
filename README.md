# Slack MCP Server

An MCP server for Slack **user tokens** (xoxc token + `d` cookie). It deploys to Cloudflare Workers and supports **multiple workspaces**.
It uses the same authentication approach as the other repositories in this org (`slack-message-fetch`, `slack-env-generator`, etc.).

- 100+ tools: conversations, chat, reactions, pins, stars, bookmarks, files (upload/download), users, usergroups, search, team, dnd, reminders, and xoxc-only internal APIs
- `slack_api_call` can call **any Slack Web API method**, including ones without a dedicated tool
- Every tool accepts an optional `workspace` argument (name / team ID / domain)
- The MCP endpoint is protected by a Bearer token (stateless, Streamable HTTP)

## Setup

1. Get a token and cookie for each workspace
   - Run `browser.js` from [`slack-env-generator`](https://github.com/slack-selfbots/slack-env-generator) in the console on `app.slack.com` to get the `xoxc-...` token
   - Copy the `d=xoxd-...` value from the `Cookie` header of a Slack request in the DevTools Network tab
2. Register secrets

```bash
pnpm install
pnpm wrangler secret put MCP_AUTH_TOKEN      # a long random string
pnpm wrangler secret put SLACK_WORKSPACES    # JSON, see below
```

```json
[
	{ "name": "acme", "token": "xoxc-...", "cookie": "xoxd-...", "default": true },
	{ "name": "other", "token": "xoxc-...", "cookie": "xoxd-..." }
]
```

`cookie` can be a bare `xoxd-...` value or a full `d=...; ...` header (it can be omitted for xoxp tokens). Add `team_id` / `domain` to also select a workspace by those values through the `workspace` argument.

### Variable size limit (5 KB)

Each Workers variable is limited to 5 KB. If several workspaces in one `SLACK_WORKSPACES` JSON exceed that, use one variable per workspace instead (any number, names starting with `SLACK_WORKSPACE_`):

```bash
pnpm wrangler secret put SLACK_WORKSPACE_ACME   # {"name":"acme","token":"xoxc-...","cookie":"xoxd-...","default":true}
pnpm wrangler secret put SLACK_WORKSPACE_OTHER  # {"name":"other","token":"xoxc-...","cookie":"xoxd-..."}
```

The `d` cookie belongs to your browser login, so workspaces signed in from the same browser usually share it. Set it once as `SLACK_COOKIE` and omit `cookie` from the workspaces. A workspace's own `cookie` takes precedence.

3. Deploy

```bash
pnpm run deploy
```

Local development: copy `.dev.vars.example` to `.dev.vars` and run `pnpm dev`.

## Client configuration

```json
{
	"mcpServers": {
		"slack": {
			"type": "http",
			"url": "https://slack-mcp-server.<subdomain>.workers.dev/mcp",
			"headers": { "Authorization": "Bearer <MCP_AUTH_TOKEN>" }
		}
	}
}
```

### ChatGPT (and other clients that cannot set headers)

Put the token in the URL path instead of a header:

```
https://slack-mcp-server.<subdomain>.workers.dev/mcp/<MCP_AUTH_TOKEN>
```

Choose "No authentication" in the client. The URL is a credential: don't share it, and use a long random token (URL-safe characters only, e.g. `openssl rand -hex 32`). URLs may show up in logs, so rotate the token if it leaks.

Use `list_workspaces` to see the configured workspaces and `auth_test_all` to check connectivity for all of them. With multiple workspaces and no `default`, omitting `workspace` returns an error.

## Security

- A user token has **the same permissions as the user**. Keep `MCP_AUTH_TOKEN` (and any URL containing it) secret; if it is unset, all requests are rejected.
- Tokens and cookies are never returned in tool results, and the server refuses to send credentials to non-Slack hosts.
- Review Slack's terms of service and use this at your own risk.
