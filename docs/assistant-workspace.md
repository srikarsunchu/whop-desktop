# Assistant

The app opens in Assistant, and setup lands there when Claude is connected. Launch hints still override this. The business pages keep their shortcuts and sit alongside the conversations.

[![Creative workflow](media/creative-workflow.jpg)](media/creative-workflow.mp4)

*27 seconds. Ask for an ad in chat, review the brief, finish it in Studio, save the draft.*

## Conversations

Conversations and drafts are saved per business. The old single-conversation store is migrated in place and left where it was. New chat keeps the current messages and any draft you typed. Recent conversations are in the sidebar, and History has searchable titles. Quit and reopen and you get the same chat and draft back. A message interrupted by a quit comes back as stopped, not as a locked composer.

The Assistant stays mounted while you visit business pages, so a running reply keeps streaming. Switching business stops the old run. One reply at a time. You cannot switch conversations until it finishes or you stop it, but you can type the next message while you wait. It does not send by itself.

## The composer

It shows the selected business and lets you pick Sonnet or Opus.

**Changes are gated, not switched.** With [wv](https://github.com/srikarsunchu/whop-view) installed, the `whop` Claude runs is handed to `wv`: reads pass through as the CLI's own output, and a write never runs on the first call. It comes back as a plan card in the chat: the command, the amount, the balance, Whop's live limit and wv's cap, before and after for an update, or the steps and blockers of a recipe like `wv money swap`. Approve runs it; a plan that moves money asks for the amount typed back first; Decline leaves nothing run. The approval is a token bound to that exact command for ten minutes, so a stale card refuses itself. A refusal (Whop's limit, wv's cap, an insufficient balance, a blocked recipe) shows the reason in Whop's words and has no button. After you answer, the result goes back to Claude so it can close the loop. Without wv, the older behavior stands: writes are blocked unless "Allow changes" is on, a setting that resets on a new or switched conversation. The demo business is unchanged either way: its writes are simulated. Raw commands are tucked into Settings.

Tool steps read as activity, with the command and its result a click away, and links into the relevant business page. Replies render tables, can be copied, recover from errors, and can show model, turns, time and cost.

## Connecting Claude

Installation and login are checked separately. Signed out, you can still write and save a draft, then hit Connect Claude or Check connection. Connect runs the CLI's browser login and gives up after five minutes.

## Images in chat

Hit **Create image**, or just ask for an image or an ad. Before anything is generated you see the product, its default-plan price, the format, brief, headline, caption and destination, and you can change any of them. Naming a product in your request selects it. The CLI cannot quote a price up front, so a live review says the price is unknown and your confirmation is what authorizes the charge. The card shows the actual cost afterwards. In demo mode you get a labeled free sample that ignores the prompt.

Chat images share Studio's job store, tagged with the conversation, business, the original instruction, the parent image and the request key. Jobs keep going while you navigate and resume polling after a relaunch. A request that died before getting a server id needs an explicit retry, which reuses the same idempotency key. A revision uses the selected image's file id as a reference and never overwrites the earlier version. Switch to chat leaves revision mode.

Each image card has Revise this, Edit in Studio, Download and Create ad draft. Exports use Studio's crop and typography renderer. An ad draft needs an HTTPS destination and a headline, is reviewed, then saved to IndexedDB. No campaign is launched. Claude's own tool access cannot reach `media generate` and skip this review.

**Import artwork** accepts PNG, JPEG or WebP up to 3 MB. Imports stay in local conversation storage, carry the current product, and can go to Studio, to a download, or to an ad draft. They are marked apart from generated images. Live revisions need a remote file id, so they are disabled for imports. Importing uploads nothing and charges nothing.

## What I tested

```bash
node scripts/test-chat-creatives.mjs
```

That covers routing, offer context, reference ids, prompt length, business and conversation scoping, retry keys and deduplicating concurrent submits. The assistant suite covers migration, multiple chats, business isolation, drafts, interrupted runs, partial stream parsing and model metadata. Media and business suites pass. Production frontend and native builds pass.

In the native app, signed in: asked for the demo products and got a five-row price and membership table. A follow-up recalled Free Picks Room with 4,120 members. Open Products went to the right page, coming back kept both replies, and a new chat followed by reopening the saved one restored everything.

Creative, on the demo business: typed "Make an Instagram ad for VIP Picks…", saw the product and price picked automatically, generated a sample, sent "Make it darker and shorten the headline" as a linked revision, reviewed and saved the second version into Ads, opened that exact version in Studio, restarted the app. Both versions, the selected revision, the product context and the ad draft link all came back.

None of this ran a paid generation, launched a campaign or changed live business data. The first live generation I tried, for Frame Creator, asked for a Whop deposit and never completed. The artwork used for import testing was made elsewhere and lives at `output/creatives/frame-launch-v1.png`.
