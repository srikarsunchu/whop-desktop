# Studio workspace

Studio now keeps the brief, selected creative, version history and image finishing controls together.

## Available

- Product selection seeds an editable brief with the title and description when returned by Whop.
- Up to four PNG/JPEG/WebP reference files, selected or dropped from Finder (15 MB each).
- Live reference uploads create private Whop files, upload their bytes, and wait for file readiness before adding them to the composer. Demo references stay local.
- Make a variation reuses a result as a reference; Animate uses its original image as the opening frame. Neither button submits a generation.
- Headline, supporting line, text color, top/bottom placement and optional shading are editable for images. Original, square, story and landscape compositions use one canvas renderer for preview and PNG export.
- Image PNG and original video MP4 exports save to Downloads and reveal the file in Finder.
- Existing jobs are checked across app views and resume after relaunch. Status checks never submit generation requests.
- Finishing settings persist per account and asset. Removing an asset removes its local history entry, not the remote file.

## Validation

- `pnpm test:media`: reference argument serialization, empty reference omission, four-reference limit, media resolution/failure/idempotency cases and bundled MP4 decode.
- `pnpm build` and native Tauri app build.
- Native UI: selected a sample image, added a headline, chose story format, exported and verified a 1080 × 1920 PNG; handed the original image to the video composer and completed the no-charge sample flow.

## Boundaries

Live paid generation and network reference upload still need an account-backed integration check; no real Whop balance was charged during implementation. Samples remain explicitly labeled and do not respond to prompts or references.

Video typography, logo layers, inline assistant conversations and completion notifications are not part of this increment. Animate uses the original image, not the typography composition. Format presets center-crop locally and do not claim model-level aspect-ratio control. Provider resolution support varies; the CLI does not expose a model selector.


## Seller workflow update

- A persistent offer card keeps the selected product, default plan price and destination visible.
- Social post, paid ad, product cover and custom purposes precede image/video settings. Placement is included in the generation brief; exact image output dimensions come from local composition.
- One inspector separates Brief from Adjust artwork. The generation action remains outside its scrollable fields.
- Briefs persist after generation and navigation. Each generated asset carries its offer, purpose, format and concept metadata.
- Cropping can be repositioned horizontally and vertically. Composition guides and a generic post preview help review framing; guides are not exported and do not claim platform approval.
- Use creative supports download plus separate post-copy copying, or a local ad draft. IndexedDB retains the rendered image snapshot, copy, offer and destination together. Saving a draft does not upload, publish or spend.
- Ads shows local Studio drafts separately from remote campaigns, with editable copy and a planning handoff to the existing assistant. Finished image drafts still need upload before a live campaign can use them.

Native verification: selected VIP Picks and confirmed its $49/month default plan, saved a sample image draft with an ad headline and post copy, and verified that Ads displayed the finished image (including typography), offer, price and copy together with a clear unpublished label. Automated checks cover prompt length, placement hints, destination validation and crop coordinates.
