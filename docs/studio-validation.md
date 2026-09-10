# Studio generation repair

## Fixed

- Demo video returns a bundled five-second H.264 MP4, not an SVG in a video element.
- Image and video samples are explicitly labeled as samples, not results generated from the typed prompt. Their displayed cost is zero. Legacy demo gallery entries are migrated.
- Refresh preserves the sample type and URL. Simulated file IDs are not offered for attaching to real ads.
- The app permits HTTPS media playback in its content policy.
- Live creation returns a job ID without holding the interface in a long `--wait` call. Existing jobs are checked every four seconds for up to ten minutes while Studio is open; later checks are manual.
- A file ID without a URL is resolved through `whop files get`. Completed-without-file, provider errors, wrong MIME types, and preview load failures are handled explicitly.
- The creation request has an idempotency key. Retrying an unchanged prompt after a request failure reuses the key; polling never invokes generation.
- Gallery transitions are persisted immediately, including callbacks after leaving the view. Returning to Studio resumes polling eligible jobs.
- Native CLI commands run on blocking workers rather than tying up the UI thread.

## Evidence

Installed CLI schemas checked: `whop media generate --schema`, `whop media get --schema`, `whop files get --schema`.

The [official CLI](https://github.com/whopio/whop-public-cli) documents media generation and file retrieval. [File retrieval documentation](https://docs.whop.com/api-reference/files/retrieve-file) says URLs can be absent until ready, and private URLs can expire.

Run `pnpm test:media` for response/state regression checks and a full sample-video decode. These checks use synthetic responses and a bundled sample, not a paid provider request.

A live paid generation against a real Whop business is still a separate verification step. No real business balance was charged for this repair.

## Studio finishing update

- Production frontend build and media/workflow checks passed.
- Native app build passed.
- Verified native Brief / Artwork / Copy tabs; Copy opens a post preview with saved headline and caption.
- Verified handoff review includes finished artwork, product title, default-plan price, format, and missing-destination state.
- Saved the existing sample creative into Ads and verified artwork, headline, caption, product, and price carried through.
- Verified missing destination produces a Complete details action and disables draft campaign planning.
- No paid generation or campaign publishing performed. Public 0.4.0 DMG has not been replaced by this development build.
