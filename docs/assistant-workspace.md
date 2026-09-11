# Assistant-first Whop Desktop

The assistant is the startup destination and the destination after welcome setup. Explicit launch hints still work. Business pages retain their existing shortcuts and are available alongside conversations.

Conversations and drafts are saved per business. The previous single-conversation format is migrated without deleting its source. New chat preserves existing messages and nonempty drafts. Recent conversations appear in the main sidebar, and History provides searchable titles. Closing and reopening the app restores the selected chat and draft; interrupted messages recover as stopped, rather than leaving the composer locked.

The assistant remains mounted while navigating business pages, so streams and message state continue. Switching businesses stops the old business's run. One reply may run at a time; conversation switching is disabled until it completes or is stopped. Drafting the next message during a reply is supported, but it is not automatically sent.

The composer shows the selected business and offers Claude Sonnet/Opus. Access defaults to reads; allowing changes is an explicit setting that resets for a new or switched conversation. Existing native write controls and chat confirmation instructions remain. Raw commands are a secondary Settings action. Tool steps show readable activity, expandable commands/results, and links to relevant business pages. Replies support tables, copy, error recovery and optional technical metadata.

Claude installation and authentication are checked separately. Signed-out users can compose and save a draft, then use Connect Claude or Check connection. The native sign-in action invokes the installed CLI's browser login and has a five-minute timeout. Its completion has not been exercised on this signed-out Mac.

Validation: production frontend/native builds; assistant checks for migration, multiple chats, business isolation, drafts, interrupted runs, partial stream parsing and model metadata; native UI walkthrough for startup, new chat, history, drafting and page navigation during a run. A read-only demo request reached the installed Claude process but could not complete because Claude is signed out. No successful authenticated response or live Whop mutation is claimed. Public version and installer remain unchanged.


## Authenticated verification
After the user completed Claude sign-in, the native app successfully fetched the current demo products through the Whop tool and rendered a five-row price/membership table. A follow-up correctly recalled Free Picks Room with 4,120 members. Open Products navigated to the matching directory, returning to Assistant preserved both replies, and starting a new chat then selecting the saved conversation restored the complete exchange. Assistant regression checks passed. These were read-only demo requests; live business mutations were not exercised.

## Creative workflow in chat

Use **Create image**, or send an image/ad creation request. Review the product, current default-plan price, format, brief, headline, caption and destination before submitting one image. Product names in the request select a matching loaded product; the review always permits correction. The CLI does not expose an upfront quote: live review explicitly discloses that the price is unavailable and confirmation authorizes a paid generation. Returned cost is shown on the card. Demo mode produces clearly labeled free sample artwork, not prompt-conditioned output.

Images share Studio's persistent job store, with conversation and business IDs, original instruction, parent image and request key. Jobs continue across navigation and server jobs resume polling after launch. Requests interrupted before receiving a server ID require an explicit retry with the same idempotency key. Revisions use the selected image's file ID as a reference; no prior version is overwritten. Switch to chat exits revision mode.

Each card supports Revise this, Edit in Studio, Download, and Create ad draft. Exports use the same crop/typography renderer as Studio. Ad drafts require an HTTPS destination and headline and are reviewed before a local IndexedDB save; no campaign is launched. Native assistant tool execution cannot bypass the creative review through `media generate`.

Validation: `node scripts/test-chat-creatives.mjs` covers routing, offer context, reference IDs, prompt length, business/conversation scoping, retry keys and concurrent submission deduplication. Existing assistant, media and business suites also pass. Live paid generation is not exercised by automated checks.

Native demo verification: entered “Make an Instagram ad for VIP Picks…”, confirmed automatic product/price selection, generated a sample, submitted “Make it darker and shorten the headline” as a linked revision, reviewed and saved the second version into Ads, opened that exact version in Studio, and restarted the app. Both versions, revision selection, product context and ad-draft association restored. No paid generation or campaign launch was performed.

### Imported artwork

The composer also accepts PNG/JPEG/WebP files up to 3 MB through **Import artwork**. Files stay in local conversation storage, carry the current product context, and can be opened in Studio, downloaded or saved as a local ad draft. Imported assets are distinguished from Whop generations. Live Whop revisions need a remote reference file ID, so they remain disabled for local-only imports. Importing does not upload a file or charge a Whop balance.

The first live generation attempt for Frame Creator required a Whop deposit; it did not produce a completed image. Real alternative artwork was generated with the conversation image tool and saved at `output/creatives/frame-launch-v1.png` for import testing.
