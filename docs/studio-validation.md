# Studio generation repair

## What was wrong, and what changed

- The demo video was an SVG inside a `<video>` tag. It is now a bundled five-second H.264 MP4.
- Image and video samples are labeled as samples. They are not generated from your prompt and they show a cost of zero. Old demo gallery entries were migrated.
- Refresh keeps the sample's type and URL. Simulated file ids cannot be attached to real ads.
- The content security policy allows HTTPS media.
- A live creation returns a job id right away instead of sitting in a long `--wait`. Studio polls open jobs every four seconds for up to ten minutes, after that you refresh by hand.
- A file id with no URL is resolved through `whop files get`. Completed-without-file, provider errors, wrong MIME types and preview load failures each have their own handling.
- Creation requests carry an idempotency key. Retrying the same prompt after a failed request reuses it. Polling never triggers a generation.
- Gallery state is saved immediately, including callbacks that arrive after you leave the view. Coming back to Studio resumes polling.
- CLI calls run on blocking workers, not the UI thread.

## Where the behavior comes from

I checked the installed CLI's own schemas:

```bash
whop media generate --schema
whop media get --schema
whop files get --schema
```

The [public CLI repo](https://github.com/whopio/whop-public-cli) documents media generation and file retrieval. The [file retrieval docs](https://docs.whop.com/api-reference/files/retrieve-file) say a URL can be missing until the file is ready and that private URLs expire.

## What I tested

```bash
pnpm test:media
```

That covers the response and state regressions and decodes the bundled sample video end to end. It uses synthetic responses, not a paid provider call. A real paid generation against a real business is still a separate step. No balance was charged for this repair.

## Studio finishing pass

Production frontend build, media and workflow suites, native build. In the native app: the Brief, Artwork and Copy tabs, with Copy opening a post preview showing the saved headline and caption. The handoff review shows the finished artwork, product title, default-plan price, format, and a missing-destination state. Saving the sample creative into Ads carried artwork, headline, caption, product and price through. A missing destination produces a Complete details action and disables campaign planning. No paid generation, no campaign published. The public 0.4.0 DMG was not replaced by this build.
