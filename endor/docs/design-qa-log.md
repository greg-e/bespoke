# Design Q&A Log

Updated: 2026-05-09

## Purpose

Track product questions, accepted decisions, implementation status, and verification evidence.
Use this as a running source of truth to find gaps quickly during iterative UI changes.

## How To Use

1. Add each new request as a new row in the table below.
2. Keep answers short and implementation-focused.
3. Mark status as one of: Pending, In Progress, Done, Needs Verification.
4. Add at least one evidence reference after implementation.
5. Record any gap explicitly in the Gap column.

## Q&A Progress Matrix

| ID | Question / Request | Decision / Answer | Status | Evidence | Gap / Follow-up |
| --- | --- | --- | --- | --- | --- |
| QA-001 | Build a today-first productivity app with cross-device usage and account distinctions over time. | Use Supabase Auth + RLS-backed tables + route-based SPA with Today, Tasks, Calendar, Settings, and detail pages. | In Progress | src/views/Today.vue, src/views/Settings.vue, src/router/index.js, supabase/migrations/20260509000000_initial_schema.sql | Validate behavior on a second device/session to confirm end-to-end sync and account isolation UX. |
| QA-002 | Add notification preferences UI. | Notification preferences moved to Settings and persisted via Supabase with local cache fallback. | Done | src/views/Settings.vue, src/lib/preferences.js | None. |
| QA-003 | Add real file-upload attachments. | Attachments use Supabase Storage bucket + DB records, with delete support. | Done | src/views/EventDetail.vue, src/lib/attachments.js, supabase/migrations/20260509000003_create_attachments_bucket.sql | None. |
| QA-004 | Run smoke test. | Performed browser-driven smoke checks across views and workflows during iteration. | Done | Shared browser verification during session | Add scripted smoke test command for repeatability. |
| QA-005 | Is there a new script to run in Supabase? | Added migration for attachments bucket and policies. | Done | supabase/migrations/20260509000003_create_attachments_bucket.sql | None. |
| QA-006 | All settings should be in a different view. | Settings consolidated under dedicated Settings route. | Done | src/views/Settings.vue, src/router/index.js | None. |
| QA-007 | Today needs actionable steps to take. | Added task action chips on Today: Start, Done, Pin, Open. | Done | src/views/Today.vue | None. |
| QA-008 | Add the CTA. | Added + Add task CTA in Today hero area. | Done | src/views/Today.vue | None. |
| QA-009 | I do not need an app title or description. | Removed title/description from app shell and kept nav-only header. | Done | src/App.vue | None. |
| QA-010 | Typography: Futura / Eurostile / Microgramma style. | Global typography stack updated with those brand cues. | Done | src/style.css | Verify fallback fonts on non-Windows devices. |
| QA-011 | Favorite color is Ochre with subtle palette. | Applied subtle ochre-oriented design tokens across app surfaces. | Done | src/style.css | None. |
| QA-012 | Views should have a single header and no explanation text. | Simplified view headers to one title line where applicable. | Done | src/views/Today.vue, src/views/Tasks.vue, src/views/Calendar.vue, src/views/Settings.vue | Re-check newly added views for consistency. |
| QA-013 | Open a task just like opening an event. | Added dedicated task detail route and updated list/open interactions to route to task detail. | Done | src/views/TaskDetail.vue, src/views/Tasks.vue, src/router/index.js, src/views/Today.vue | None. |
| QA-014 | Missing capacity selection for Today. | Added Today capacity slider and list-size control. Persistence approach still needs product decision. | Needs Verification | src/views/Today.vue, src/stores/dashboard.js, src/lib/dashboard.js | Decide whether capacity belongs in Settings with server persistence or remains a Today-local control. |

## Active Gaps To Watch

1. Cross-device validation still needs a formal two-session check pass.
2. Smoke test should be codified as a repeatable script instead of manual browser checks.
3. Capacity persistence approach is unresolved: Settings + server profile value vs local Today control.

## Update Protocol

1. On each new request, add a new QA row first.
2. During implementation, move status to In Progress.
3. After code + verification, set status to Done and add evidence.
4. If regression or omission is found, append a new QA row for traceability.
