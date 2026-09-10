# Campaign workspace

The Ads page manages campaigns, their ad groups, and their ads in a parent-filtered workspace. Clicking a campaign opens its groups; clicking a group opens its ads. Search and delivery filters apply to the displayed first 100 results; the UI indicates additional pages when present.

Supported controls:
- Create campaign drafts with objective, daily/lifetime budget, schedule and special category.
- Edit campaign title, budget and schedule; review launch; pause/resume, duplicate and delete.
- Create paused groups with country targeting, audience presets, placements and optimization goal; edit group settings and delivery.
- Create/edit ads with Studio image uploads, headline, caption, CTA, destination and a connected Facebook page; pause/resume, duplicate and delete.
- Review each mutation before it runs. Creation uses a stable idempotency key across retries. Failed actions remain open with their error.
- Demo mutations are persisted separately on this Mac and never call live write commands. Sample artwork is blocked from live upload.

Limits: no automatic campaign creation from Claude; no live mutations exercised during development. Country targeting replaces existing region targeting when changed. Advanced targeting and lead-form configuration are not yet exposed. Image uploads poll Whop file readiness; videos can use an existing Whop file ID. Included in the 0.4.1 preview release.

Validation: run `node scripts/test-campaigns.mjs`, `pnpm build`, and `pnpm test:media`.

Native validation: created a local `Studio launch test` campaign with a 25/day budget; drilled into it and created a paused `US prospecting` group; opened its ads, selected the existing Studio sample, attached its finished artwork and populated copy, selected the demo Facebook page, added an example.com destination, and created the paused demo ad. Verified each review dialog and parent-filtered result. No live writes or charges occurred.
