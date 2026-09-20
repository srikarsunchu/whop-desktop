# Design audit

September 10, 2026. The goal is for the app to read as a considered extension of Whop's own product, not a wrapper around a CLI.

## What I compared against

The public [whop.com](https://whop.com/) homepage, the signed-in business Home and Analytics screens, and the AI side panel. Then the native app and its shared components, and a read through the other views for repeated problems. No real business data was touched. Visual checks used Northwind Picks.

The homepage and the dashboard are two different registers. The homepage is orange, bold, illustrated, in motion. The dashboard is quiet dark surfaces, compact controls, blue actions, grouped navigation, and developer details behind a small control. The desktop app belongs to the second register, with native window behavior on top. Painting the homepage orange onto every button would miss that.

## Where it stood

The right component library and the right typography, but the composition felt like a stack of command outputs. Frosted supplies parts. The craft is in deciding what gets attention, what belongs together, and what happens when you touch something.

The one original idea worth protecting is inspectable work: a business question, a real command, a result you can understand. That should be the thing people remember. It does not require every flag to be on screen in every panel all the time.

## What changed in this pass

- **Navigation.** Eleven flat rows became: Assistant on its own, then Business, Grow and Build groups, with Account and connection status at the bottom. Same destinations, same number shortcuts.
- **Command strip.** The raw command line on every panel became a small chip. Click it for a popover with the full command, when it last ran, copy with confirmation, and open in Terminal. Refresh stays where it was.
- **Overview.** One big revenue figure and chart, three supporting numbers, and prompts that go into Claude. Before, revenue was shown three times with no focal point.
- **Chart.** Entrance reveal, fading area fill, hover inspection, arrow keys and Home and End, UTC day labels, and a working 7, 30 and 90 day selector. The old one was static with a tooltip that never went away.
- **Demo numbers.** Overview now uses the aggregate paid-membership series and sums new-user stats, so six sample rows no longer sit next to a sparkline of a thousand members. Daily fixtures are seeded by calendar date, so the same day has the same value in every range. The past-due example now renews two days ago instead of in the future, and the recommendation matches.
- **Chat.** Eight long suggestion pills became three short task cards that draft a prompt before sending. Claude is named as the author, commands are compact cards, output is behind a disclosure, the running state is clear, and line height went up. The composer is always visible and the transcript only follows the stream while you are near the bottom, so you can scroll back mid-reply. A send during startup is guarded so you cannot ask twice.
- **Studio.** The unrelated scrubber example is gone. Starters are relevant, the header is short, demo versus paid is stated, and the empty state is illustrated.
- **Sidebar.** Business name and workspace state instead of raw account ids. Ids live in Account.

Motion respects Reduce Motion. Data is never animated through made-up intermediate values.

## What is still in the way, in order

1. **Finish a task without leaving the app.** Product creation, some member actions and app setup still drop into raw commands. Build one end-to-end flow properly: open a past-due member, ask Claude for a draft, review the change, confirm it. A good member drawer is worth more than another metric.
2. **Keep the assistant beside the work.** Whop's AI sits next to the current page. A contextual drawer would let a campaign or membership stay visible while you talk about it, with the full conversation view still available. This is a state-management change, not a CSS panel.
3. **Make long lists usable.** Several lists fetch the first 50 or 100 rows and stop. Cursor pagination, search, real sorting and a visible loaded count are needed before this is ready for a big business.
4. **Connect Ads and Studio.** Campaigns, groups and ads read as three separate tables. A campaign detail view should tie performance, targeting and creative together, and generated assets should be pickable without copying file ids.
5. **Make every button honest.** New product should open a creation flow or say it opens a command draft. View should show something useful, not switch to a terminal. Placeholder commands are not finished interactions.
6. **Recover better.** Retry in place, keep draft input on failure, tell stopped from failed, and say what is still running when you leave a view. Write-permission lifetime and conversation ownership across account switches need their own audit.
7. **Tighten the fixtures.** Daily aggregates agree now, but the twelve member records are samples, not a population. Label them or generate matching pagination fixtures before claiming complete lists.

## What I tested

TypeScript and production build pass. The native bundle builds. Checked Overview, period switching, the command inspector, the chat transcript and the chat empty state in the native app. A read-only demo question ran end to end, returned the corrected past-due date, and its output expanded with the answer and composer still in view. Fixture checks: overlapping 7, 30 and 90 day ranges agree for revenue, paid memberships, new users and balance, and the past-due record is in the past with its $129 renewal intact. This review used the bundle in `src-tauri/target/release/bundle/macos`, not the copy in Applications.

## How to film it

One complete thought. Ask a specific business question, watch the command run, read the answer, open the evidence. Switch the Overview period to show the chart. Keep the demo label in frame. Record the real interaction, cut the waiting, put the window over a quiet wallpaper. The craft is already in the app. The video just has to show it.
