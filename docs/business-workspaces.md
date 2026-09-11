# Business workspaces

Local implementation, September 10, 2026. Not a published release.

The remaining business pages now use searchable lists, in-page detail workspaces, editable forms, and explicit review before mutations. Ads and Studio remain available. Products can seed a new Studio brief with the selected offer, price, and description.

## Available workflows

- Products: create a hidden product, edit copy, preview content, add/edit pricing plans, publish/unpublish/delete, open its storefront, and continue to Studio. Editing a plan first retrieves its details and preserves custom checkout fields.
- Members: membership and member directories, detail inspection, free-plan invitation, pause/resume billing, and cancellation either immediately or at period end. A member can reveal matching memberships from the first 100 records.
- Money: balances, income statement, financial activity, payout/dispute details, and a reviewed withdrawal using a saved destination and balance currency. Quotes are requested during review. Standard speed is used and bank-name warnings are not bypassed.
- People: customer facts, full profile inspection, event activity, and a link into matching memberships.
- Growth: create a bounty with explicit reward-per-submission × winner-slot funding, edit its brief, inspect public submissions, cancel a bounty, inspect referrals, and enroll as a partner.
- Apps: create/scaffold an app or blueprint in a specified folder, inspect builds and logs, deploy a preview, and separately review promotion to production.
- Account: business/connection details, saved profiles, browser OAuth sign-in, team invitation and role editing. The native sign-in bridge keeps the authorization URL outside the renderer and times out after five minutes.
- Overview: recommended actions open the relevant business workspace rather than a command draft.

## Shared behavior

Search and sorting apply to the current page, explicitly labeled. Lists expose previous/next controls when cursor metadata is returned. Financial activity uses `--limit`/`--cursor`; other lists use `--first`/`--after`.

Forms and filters persist in session storage, scoped by account; demo mutations persist in local storage on this Mac. Supported create requests keep stable idempotency keys across retries and reopening a draft. Changing the submitted body creates a new key. Failed forms remain open. Active writes disable the form and cannot be dismissed through the dialog. Successful mutations invalidate cached results and older reads cannot repopulate the cache afterward.

Demo writes never call the live command bridge. Demo product/plan relationships, membership changes, payouts, team records, and app previews are stored locally. Demo payouts affect available balance and appear in financial activity. The sample population is illustrative rather than an exhaustive backing population for aggregate analytics.

## Validation

- Frontend TypeScript/production build and native macOS app build.
- `node scripts/test-business.mjs`: validation, hidden product creation, product/plan relationships, pagination, persisted actions, free-plan restrictions, membership transitions, bank-warning guard, and retry deduplication.
- Existing campaign and media/Studio validation suites.
- Native demo walkthrough: created Creator launch kit, added Monthly access at $29/month, verified product price refresh, and opened Studio with the offer and brief. Paused Kayla Underwood's demo membership and verified Resume replaced Pause. Submitted a $25 local demo withdrawal and verified the available balance decreased. Inspected Growth, Apps build/log controls, Account/team layout, and People.

## Boundaries

Live writes, OAuth completion, live project scaffolding/deployment, payout execution, and bank quote response variants have not been exercised against a real account. No money was moved and no messages were sent in testing. The local app bundle is a development build; this work does not update the downloadable installer or website.

Public bounty submissions are inspectable; this CLI has no submission approval/payout command. New bounties publish and fund immediately; scheduling is not exposed in this form. Product content preview is illustrative, not an exact live storefront rendering. Blank optional text is skipped and cannot clear an existing value. Plan/member pickers and linked-membership inspection use the first 100 records. Local project operations depend on the installed CLI and do not have API idempotency guarantees. Advanced account settings, owner transfer, dispute response submission, and payout-method setup remain outside these forms.

## Money layout refinement

Restored the earlier dashboard composition at the user's request: prominent total balance and stacked breakdown, income statement alongside it, full-width financial activity, and payouts/disputes side by side. The newer searchable/paginated tables, record details, saved payout methods, and reviewed withdrawal remain. Detail dialogs open only when a record is selected. Balance totals and the breakdown are scoped to a selected currency when multiple currencies are returned.

## Members layout refinement

Members now uses a full-width table with customer identity, product, plan, status, renewal/access timing, and joined date. A compact snapshot counts active/trialing, past-due, canceling, and paused memberships from the first 100 records, explicitly labeled. Selecting a customer opens a profile dialog with billing/access context and the existing reviewed actions. Paused and canceled memberships no longer display an old date as an upcoming renewal. The directory retains links to a person's loaded memberships, search, sorting, and pagination.


### Final page consistency pass
People uses a full-width customer table with lifetime value, purchase counts, location and last seen, plus focused profile and activity dialogs. Growth places bounty status, submission counts, accepted work and payouts in one table, with a readable full-width brief and funding details. Apps uses project cards, build history, preview deployment reviews and a timestamped runtime log view. Account separates business identity, connection, explicit profile switching and team access; owners are not offered ordinary role changes. Products now uses a full-width offer table and a focused pricing/content dialog. Shared tables retain keyboard-accessible record buttons, filters, refresh and pagination. Long dialogs scroll within the window; mutation review dialogs return to their parent record.

Verification: business, campaign and media/Studio checks passed. Production frontend and native app builds passed; native demo walkthrough covered People profiles, Growth briefs/editor return, Apps gallery/builds/logs, Account and the existing dashboard layouts. Live mutations, invitations, production deployments and payments were not exercised. The public 0.4.1 release is unchanged; these changes are in the local app build.

## Overview UX refinement

Overview keeps the existing dashboard style while prioritizing net revenue and current issues. Membership, new-user and available-balance cards now have direct destinations and local retry actions for failed reads. Period metrics show an explicit UTC range and preserve the selected period for the current business session; the available balance is explicitly current and uses the returned currency rather than a total-balance fallback.

Needs attention derives from current past-due memberships, disputes and product records instead of static recommendations. Record coverage is explicit (up to 100 per list). Review links apply the relevant filters; dispute navigation waits for layout data before scrolling to the dispute section. Latest transactions are ordered by time. Assistant help is a compact briefing action with the chosen period included in the draft prompt.
