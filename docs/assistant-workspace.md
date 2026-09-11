# Assistant-first Whop Desktop

The assistant is the startup destination and the destination after welcome setup. Explicit launch hints still work. Business pages retain their existing shortcuts and are available alongside conversations.

Conversations and drafts are saved per business. The previous single-conversation format is migrated without deleting its source. New chat preserves existing messages and nonempty drafts. Recent conversations appear in the main sidebar, and History provides searchable titles. Closing and reopening the app restores the selected chat and draft; interrupted messages recover as stopped, rather than leaving the composer locked.

The assistant remains mounted while navigating business pages, so streams and message state continue. Switching businesses stops the old business's run. One reply may run at a time; conversation switching is disabled until it completes or is stopped. Drafting the next message during a reply is supported, but it is not automatically sent.

The composer shows the selected business and offers Claude Sonnet/Opus. Access defaults to reads; allowing changes is an explicit setting that resets for a new or switched conversation. Existing native write controls and chat confirmation instructions remain. Raw commands are a secondary Settings action. Tool steps show readable activity, expandable commands/results, and links to relevant business pages. Replies support tables, copy, error recovery and optional technical metadata.

Claude installation and authentication are checked separately. Signed-out users can compose and save a draft, then use Connect Claude or Check connection. The native sign-in action invokes the installed CLI's browser login and has a five-minute timeout. Its completion has not been exercised on this signed-out Mac.

Validation: production frontend/native builds; assistant checks for migration, multiple chats, business isolation, drafts, interrupted runs, partial stream parsing and model metadata; native UI walkthrough for startup, new chat, history, drafting and page navigation during a run. A read-only demo request reached the installed Claude process but could not complete because Claude is signed out. No successful authenticated response or live Whop mutation is claimed. Public version and installer remain unchanged.


## Authenticated verification
After the user completed Claude sign-in, the native app successfully fetched the current demo products through the Whop tool and rendered a five-row price/membership table. A follow-up correctly recalled Free Picks Room with 4,120 members. Open Products navigated to the matching directory, returning to Assistant preserved both replies, and starting a new chat then selecting the saved conversation restored the complete exchange. Assistant regression checks passed. These were read-only demo requests; live business mutations were not exercised.
