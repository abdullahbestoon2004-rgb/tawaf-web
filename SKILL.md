---
name: tawaf-conventions
description: Project conventions for Tawaf, an Umrah trip marketplace with three roles (client, companies/agencies, admin). Use this whenever working on the Tawaf Flutter app OR the separate admin/companies dashboard website, on anything touching role logic, Supabase schema/RLS, auth, or data shared between the app and the dashboards. Always check this before writing or modifying Supabase queries, role-gated routes/screens, or dashboard pages, even if the user doesn't say "Tawaf" by name.
---

# Tawaf Project Conventions

Tawaf is an Umrah trip marketplace with three roles: **client**, **companies** (travel agencies), and **admin**.

There are TWO codebases sharing ONE Supabase backend:
1. **The Tawaf app** — Flutter, client-facing and companies/admin-facing mobile flows, Provider for state management.
2. **The dashboard website** — a separate web app (not the Flutter app) where admin and companies manage their side of the platform. This is a distinct repo/deployment from the Flutter app.

Both are still under active development. Because they share one Supabase project, changes to schema, RLS policies, or role logic in one codebase can silently affect the other.

## Before making changes, always:

1. **Identify which surface you're in** — the Flutter app or the dashboard website — and note in your response if a change could affect the other surface (e.g., a schema change, a new RLS policy, a renamed column/table).
2. **Treat Supabase RLS as the actual security boundary**, not client-side role checks. Any new query or table needs RLS policies reviewed for all three roles (client, companies, admin), not just the role you're currently building for.
3. **Keep role-gating consistent.** The three roles are client / companies / admin — use these exact terms in code, comments, and schema (not "agency" or "user" as a substitute) unless the existing codebase already uses different naming, in which case follow what's there.
4. **Flag cross-repo impact explicitly.** If you change a Supabase table/column/policy while working in one repo, say so clearly — don't assume the other repo's code will be updated in the same session.

## Flutter app conventions

- State management: Provider (Selector where possible to scope rebuilds).
- Use `ListView.builder` for lists, paginate Supabase queries, and offload heavy work to `compute()`/isolates rather than blocking the UI thread.

## Dashboard website conventions

- Separate deployment from the Flutter app; serves admin and companies only (no client-facing role here).
- Same Supabase project/credentials pattern as the app — check for an existing `.env`/config setup before introducing a new one.

## When unsure

If a task seems like it only touches one surface but involves auth, roles, or Supabase schema, pause and ask whether the other surface needs a matching update before proceeding.
