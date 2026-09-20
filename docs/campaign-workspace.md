# Campaign workspace

The Ads page is three nested lists. Click a campaign to see its ad groups, click a group to see its ads. Search and delivery filters work on the loaded page, which is the first 100 rows. The UI says when there are more.

## What you can do

- Create a campaign draft with an objective, a daily or lifetime budget, a schedule and a special category.
- Edit a campaign's title, budget and schedule. Review it before launch. Pause, resume, duplicate, delete.
- Create a paused ad group with country targeting, an audience preset, placements and an optimization goal. Edit its settings and delivery.
- Create or edit an ad with a Studio image, headline, caption, CTA, destination and a connected Facebook page. Pause, resume, duplicate, delete.

Every write shows a review dialog first. Creates carry a stable idempotency key so a retry does not make two of them. If a write fails the dialog stays open with the error.

Demo writes are stored on this Mac and never reach the live CLI. Sample artwork cannot be uploaded to a live ad.

## Limits

Claude does not create campaigns on its own. Changing country targeting replaces whatever region targeting was there. Advanced targeting and lead forms are not exposed. Image uploads poll Whop until the file is ready. Video ads need an existing Whop file id. I did not run a live write during development.

Shipped in the 0.4.1 preview.

## What I tested

```bash
node scripts/test-campaigns.mjs
pnpm build
pnpm test:media
```

In the native app, on the demo business: made a campaign called Studio launch test at $25 a day, opened it and made a paused group called US prospecting, opened that and made a paused ad from the existing Studio sample with its artwork and copy, the demo Facebook page and an example.com destination. Every review dialog and every nested list behaved. No live writes, no charges.
