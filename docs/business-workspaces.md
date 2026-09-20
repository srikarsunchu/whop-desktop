# Business workspaces

Built September 10, 2026 in the local development build. The public installer at the time was 0.4.1 and was not replaced by this work.

The business pages went from command output with a face to actual workspaces: searchable lists, a detail view for each record, editable forms, and a review dialog in front of every write.

## Page by page

**Overview** leads with net revenue and what needs attention. The membership, new-user and balance cards each go somewhere and retry in place if a read fails. Period metrics show their UTC range and remember the period for the session. Available balance is the current figure in the returned currency, not a total-balance fallback. Needs attention is computed from live past-due memberships, disputes and products, up to 100 each, not from canned recommendations. Its links open the page with the right filter already applied. Dispute links wait for layout before scrolling. Latest transactions are in time order. The briefing button drafts an assistant prompt that includes the period.

**Money** keeps the older layout: a big total balance with the stacked breakdown, income statement beside it, financial activity full width, payouts and disputes side by side. Underneath that are searchable, paginated tables, record details, saved payout methods and a reviewed withdrawal. A withdrawal uses a saved destination in the balance currency, fetches a quote during review, uses standard speed, and does not skip bank-name warnings. Detail dialogs open only when you pick a record. With several currencies, totals and the breakdown follow the one you select.

**Members** is a full-width table: customer, product, plan, status, renewal or access timing, joined date. A snapshot above it counts active and trialing, past-due, canceling and paused from the first 100 rows, and says so. Picking a customer opens a profile with billing and access context and the actions: invite to a free plan, pause or resume billing, cancel now or at period end. Paused and canceled memberships no longer show a stale date as an upcoming renewal. A member can reveal their memberships from the first 100 records.

**Products** is a full-width offer table with a pricing and content dialog. Create a hidden product, edit copy, preview content, add or edit plans, publish, unpublish, delete, open the storefront, or continue into Studio with the offer and brief filled in. Editing a plan fetches it first so custom checkout fields survive.

**People** is a customer table with lifetime value, purchase count, location and last seen, plus profile and activity dialogs and a link into matching memberships.

**Growth** puts bounty status, submission counts, accepted work and payouts in one table, with the brief and funding details readable full width. Create a bounty funded as reward per submission × winner slots, edit the brief, look at public submissions, cancel it, look at referrals, or enroll as a partner.

**Apps** shows project cards, build history, preview deployment reviews and a timestamped runtime log. Create or scaffold an app or blueprint into a folder you choose, deploy a preview, and separately review promotion to production.

**Account** separates business identity, connection, profile switching and team access. Browser OAuth runs through a native bridge that keeps the authorization URL out of the renderer and times out after five minutes. Invite team members and edit roles. Owners are not offered ordinary role changes.

## Shared behavior

Search and sort apply to the loaded page and the label says so. Previous and next appear when the CLI returns cursor metadata. Financial activity pages with `--limit` and `--cursor`, everything else with `--first` and `--after`.

Forms and filters persist in session storage per account. Demo writes persist in local storage on this Mac and never touch the live bridge. Demo products, plans, memberships, payouts, team records and app previews are all stored locally, and a demo payout lowers the available balance and shows up in activity. The sample population is a handful of illustrative records, not a full population behind the aggregate numbers.

Creates keep a stable idempotency key across retries and across closing and reopening a draft. Change the body and you get a new key. A failed form stays open. A form mid-write is disabled and cannot be dismissed. A successful write invalidates the cache, and stale reads cannot repopulate it afterwards.

Tables keep keyboard-reachable record buttons, filters, refresh and pagination. Long dialogs scroll inside the window. Review dialogs return you to the record they came from.

## What I tested

```bash
node scripts/test-business.mjs
```

That covers validation, hidden product creation, product and plan relationships, pagination, persisted actions, free-plan restrictions, membership transitions, the bank-warning guard and retry deduplication. The campaign and media suites pass. Production frontend and native macOS builds pass.

In the native app on the demo business: created Creator launch kit, added Monthly access at $29 a month, saw the product price refresh, opened Studio with the offer and brief. Paused Kayla Underwood's membership and saw Resume replace Pause. Submitted a $25 demo withdrawal and saw available balance drop. Walked People profiles, Growth briefs and the editor round trip, the Apps gallery, builds and logs, Account, and the Money and Members layouts.

Not run against a real account: live writes, completing OAuth, scaffolding or deploying a real project, executing a payout, and the different shapes a bank quote can come back in. No money moved, no messages sent.

## Not yet

Public bounty submissions can be viewed, but the CLI has no command to approve or pay one. New bounties publish and fund immediately. There is no scheduling. The product content preview is a sketch, not the live storefront. Leaving an optional text field blank skips it, so you cannot clear a value that way. Plan and member pickers and linked-membership views use the first 100 records. Local project operations depend on the installed CLI and have no API idempotency. Advanced account settings, owner transfer, dispute responses and payout-method setup are not in these forms.
