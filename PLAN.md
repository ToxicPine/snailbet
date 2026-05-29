# Scramjet Local Route Proxy Plan

## Goal

Build lean Scramjet local proxy. `constants.ts` maps stable path-safe IDs to
localhost origins. `localhost:SCRAMJET_PORT/:id/:uri` behaves like Scramjet
visit to mapped origin + `/:uri`.

Keep refresh, deep links, hashes, back/forward synced with Scramjet. No front
page, default framework, styling, bloat, tests, defensive extras, or broad
compatibility work.

## 1. Environment

- Add `flake.nix`; use only `nixpkgs`; provide Deno.
- No `flake-utils` or unrelated tooling.

## 2. Scramjet Research

Confirm current setup: static assets, service worker, controller init, proxy
prefix behavior, frame navigation API, transport needs.

Refs:

- https://docs.titaniumnetwork.org/proxies/scramjet
- https://mercuryworkshop-scramjet.mintlify.app/quickstart
- https://mercuryworkshop-scramjet.mintlify.app/concepts/service-worker
- https://docs.titaniumnetwork.org/api/interfaces/scramjetframe/

## 3. Example App Research

Inspect `MercuryWorkshop/Scramjet-App`. Identify only asset hosting, Scramjet
registration, transport support, browser shell. Do not copy app structure unless
required.

Ref:

- https://github.com/MercuryWorkshop/Scramjet-App

## 4. Route Record

- Create `constants.ts`.
- Hard-code ID -> local origin map as only routing authority.
- Validate IDs before serve; keep IDs path-safe.
- Restrict targets to localhost origins.

## 5. Public URL Contract

- Shape: `/:id/:uri`.
- `:id` selects mapped origin.
- `:uri` carries target path, query, hash intent.
- Unknown ID -> error page.
- Reserved internal paths must not collide with IDs.

## 6. Internal Paths

Choose reserved prefixes for Scramjet assets, service worker, transport support,
optional health/debug routes. Keep internals separate from `/:id/:uri`; keep
visible URL stable/readable.

## 7. Server

- Start with Deno primitives; use Hono if helpful.
- Serve Scramjet internals, valid-ID shell, clear error pages.
- Avoid nonsense.

## 8. Result Model

Add own TS Result type. Maybe use for shell render decisions, etc.

Expected request failures return results, not throws. Keep success/failure
explicit.

## 9. Error Rendering

- Design categories from real request-flow failures.
- Keep only final categories.
- Render one unstyled HTML response per category.
- Keep messages short/specific.
- Preserve useful status codes.

## 10. Shell

Purpose: sync Scramjet with visible URL.

Does: init Scramjet; create Scramjet-controlled frame; translate `/:id/:uri` to
mapped local target; load target in frame.

Does not: provide nav UI; act as landing page; manually rewrite page links.

## 11. Navigation

- Let Scramjet own in-frame nav.
- Observe Scramjet nav events.
- Convert frame target URL back to `/:id/:uri`.
- Update browser history from events.
- Avoid loops between frame nav and outer URL updates.

Ref:

- https://mercuryworkshop-scramjet.mintlify.app/concepts/url-rewriting

## 12. Back/Forward

- Treat `popstate` as browser nav intent.
- Parse current outer URL; resolve through `constants.ts`; ask Scramjet to
  navigate frame.

## 13. Transport

- Decide Deno-compatible transport path.
- Restrict transport destinations to mapped localhost origins.
- Add WebSocket handling if target apps require it.

Ref:

- https://mercuryworkshop-scramjet.mintlify.app/advanced/transport-integration

## 15. Manual Verification

No tests this pass. Verify: direct deep link; refresh; in-frame link click;
relative nav; query string; hash route; redirect; browser back; browser forward;
multiple IDs to different local ports; one error page per category.
