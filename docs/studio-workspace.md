# Studio

Studio is where you make an image or a short video for one offer. The brief, the selected creative, its version history and the finishing controls live on one screen.

## The offer

Pick a product and Studio pins an offer card at the top: product, default-plan price, destination. It stays there while you scroll. The product's title and description seed an editable brief when Whop returns them. Products can also open Studio with the offer already filled in.

## The brief

Pick a purpose first (social post, paid ad, product cover, or custom), then image or video settings. Placement goes into the generation brief. The actual pixel dimensions come from local cropping, not from the model.

Up to four PNG, JPEG or WebP references, picked or dropped from Finder, 15 MB each. On a live business each reference becomes a private Whop file, uploaded and confirmed ready before the composer uses it. In demo mode references stay local.

Briefs survive generation and navigation. Every generated asset remembers its offer, purpose, format and concept.

**Make a variation** feeds a result back in as a reference. **Animate** uses the original image as the opening frame of a video. Neither button generates anything by itself.

## Artwork and copy

The inspector has three tabs. **Brief** is above. **Artwork** has the format (original, square, story, landscape), crop position in both axes, a center-crop button, and typography: headline, supporting line, text color, top or bottom placement, optional shading. Composition guides help you judge framing and are not exported. Reset keeps the format you chose. **Copy** opens a post preview with the headline and caption.

One canvas renderer draws the preview and the PNG export, so what you see is what you get. Preview updates are batched on animation frames. Exports and ad drafts render a fresh canvas from the current edits before capturing bytes.

Finishing settings are saved per account and per asset. Removing an asset removes its local history, not the remote file.

## Getting it out

**Use creative** offers a download, a copy of the post text on its own, or a local ad draft. Image exports are PNG, video exports are the original MP4. Both land in Downloads and are revealed in Finder.

An ad draft is saved in IndexedDB with the rendered image, the copy, the offer and the destination. Saving never uploads, publishes or spends. The handoff dialog shows the finished creative next to its offer, price, destination and format, and tells you if the headline, caption or HTTPS destination is missing. A complete draft points you on to audience and budget planning in Ads. Ads lists local Studio drafts apart from remote campaigns, with editable copy and a handoff to the assistant. A draft still needs an upload before a live campaign can use it.

## Jobs

Open jobs are polled from any view and resume after a relaunch. Polling never submits a generation.

## What I tested

```bash
pnpm test:media
pnpm build
```

The media suite covers reference argument serialization, empty references being omitted, the four-reference limit, media resolution and failure cases, idempotency, and decoding the bundled MP4. Other checks cover prompt length, placement hints, destination validation and crop coordinates. The native Tauri build passes.

In the native app: picked a sample image, added a headline, chose story format, exported and got a 1080 × 1920 PNG. Handed the original image to the video composer and ran the free sample flow. Picked VIP Picks, saw its $49 a month default plan, saved a sample draft with an ad headline and post copy, and saw Ads show the finished image with typography, offer, price and copy, labeled unpublished.

## Not yet

Live paid generation and live reference upload have not been run against a real account. No balance was charged while building this. Samples are labeled and ignore prompts and references.

No typography on video, no logo layer, no inline assistant conversation, no completion notification. Animate uses the original image, not the typography composition. Format presets are a local center crop, not model-level aspect control. The CLI has no model selector, so resolution depends on the provider.
