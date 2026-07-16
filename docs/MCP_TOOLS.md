# Locked and Lean MCP tools

Phase 6 provides a separate, locally testable Streamable HTTP MCP server in
`mcp-server/`. It does not call a model API. ChatGPT is responsible for food
interpretation; the server only validates tool input, authenticates the user,
enforces an exact client/action policy, and invokes reviewed Supabase RPCs.

## Tool contract

| Tool                         | Effect                                                     | Backing RPC / status                                                                                                    |
| ---------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `health`                     | Read configuration status without user data                | No authentication; always reports `production_ready: false` in Phase 6                                                  |
| `get_calendar_history`       | Read owner-scoped Manila daily summaries                   | `get_calendar_history`                                                                                                  |
| `get_today_calories`         | Read today's server-calculated calories and active target  | Derived from a one-day `get_calendar_history` call using the MCP server's current `Asia/Manila` date                    |
| `get_weekly_protein_average` | Read the current seven-day daily protein average           | Derived from seven complete `get_calendar_history` days; returns no average when any day's macro data is incomplete     |
| `get_day_history`            | Read owner-scoped confirmed entry snapshots                | `get_day_history`                                                                                                       |
| `get_progress_summary`       | Read owner-scoped progress aggregates                      | `get_progress_summary`                                                                                                  |
| `get_weight_trend`           | Read measured weights without interpolation                | `get_weight_trend`                                                                                                      |
| `preview_food_log`           | Intended to create a temporary, non-permanent preview      | Deterministically blocked: no reviewed OAuth-compatible preview RPC exists                                              |
| `revise_food_log_preview`    | Intended to create the next preview revision               | Deterministically blocked: the existing barcode-only RPC is not a general correction contract and rejects OAuth clients |
| `confirm_food_log`           | Confirm one exact current revision with an idempotency key | `confirm_food_log`; practically unavailable to ChatGPT until an OAuth-compatible preview path exists                    |
| `record_weight`              | Record an owner-scoped metric measurement idempotently     | `record_weight`                                                                                                         |
| `delete_food_entry`          | Soft-delete one owned entry after literal confirmation     | `delete_food_entry`                                                                                                     |

Preview and revision tools authenticate first and then return
`backend_contract_unavailable` with `permanent_write: false`. They never call
the incompatible database RPCs. This is an intentional security boundary, not
a mock success.

## Descriptor rules

Every tool has strict input and output schemas, short invocation status text,
and MCP annotations. Protected tools advertise only the standard `openid`
scope in both top-level `securitySchemes` and the `_meta.securitySchemes`
compatibility mirror. Preview and revision are marked non-read-only because a
compatible future implementation would create temporary database state.

Write inputs never accept `user_id` or client-calculated aggregate totals.
Food confirmation requires the exact `preview_id`, positive
`confirmed_revision`, literal `confirmation: true`, and an idempotency key.
Deletion likewise requires literal confirmation.

The Phase 6 catalog does not claim today/recent shorthand, update/copy-entry,
update/copy-entry, or a general correction workflow. The two read-only
shorthand tools above are safe projections of the existing owner-scoped
calendar RPC; write-oriented shortcuts still require reviewed backend
contracts before they can be added.

References: [Define tools](https://developers.openai.com/apps-sdk/plan/tools),
[Build an MCP server](https://developers.openai.com/apps-sdk/build/mcp-server),
and [Apps SDK reference](https://developers.openai.com/apps-sdk/reference).
