# Whop Desktop — design audit

September 10, 2026. Goal: show Whop a considered extension of its own product and developer platform.

## Reference and scope

Reviewed the live [Whop website](https://whop.com/), the signed-in business Home and Analytics screens, and the AI side panel. Compared them with the native desktop app and its shared components; reviewed the other view implementations for recurring problems. No real business data was changed. The native visual checks use Northwind Picks.

Whop's public homepage uses orange branding, bold type, illustration, and motion. Its dashboard uses a different balance: restrained dark surfaces, compact controls, blue product actions, grouped navigation, and developer details behind a small control. The desktop should follow the dashboard's interaction language, with native window behavior. Copying the homepage's orange onto every control would miss that distinction.

## Assessment

The app had the right component library and recognizable typography, but the composition made it feel like a collection of command outputs. Frosted UI supplies components; the craft comes from deciding what gets attention, what belongs together, and what happens when someone interacts.

The strongest original idea is inspectable work: a business question, a real command, an understandable result. That should be the memorable interaction. It does not require permanently displaying every flag in every panel.

## Implemented in this pass

| Bottleneck | Change | Why it matters |
|---|---|---|
| Eleven undifferentiated navigation rows | Assistant has a dedicated entry; Business, Grow, and Build groups; Account and connection status at the bottom | Gives the workspace an understandable structure without removing destinations or changing existing numeric shortcuts |
| Raw syntax dominates each panel | Compact command chip opens a Frosted popover with the full command, updated time, copy confirmation, and terminal action; refresh remains accessible | Keeps the CLI identity discoverable without competing with the business task |
| Revenue repeated with no focal point | One prominent revenue total and chart, three supporting metrics, and focused prompts into Claude | Establishes a reading order and connects the dashboard to the assistant |
| Inert chart with a permanent tooltip | Entrance reveal, fading area fill, pointer inspection, keyboard arrows/Home/End, UTC day labels, and a real 7/30/90-day selector | Adds useful movement and inspection rather than decorative animation |
| Sample counts presented as business totals | Overview uses the aggregate paid-membership series and sums new-user stats | Removes the mismatch between six sample rows and a thousand-plus-member sparkline |
| Demo data changes when changing the range | Daily fixtures are seeded by date rather than the start of the requested range | The same date has the same value in each time window |
| Past-due example has a future renewal date | Renewal now falls two days in the past; the recommendation reflects one overdue membership | The demo tells a coherent story |
| Eight long chat suggestion pills | Three concise task cards that draft a prompt before sending | Gives the user a clear starting point and control over the request |
| Chat feels like a generic terminal transcript | Identifiable Claude author, compact command cards, explicit output disclosure, clearer running state, better line height | Makes the answer readable while preserving its evidence |
| Composer can fall below the viewport | Flexible chat layout with a persistent composer and keyboard hints | Works as a native conversation surface instead of a scrolling web page |
| Stream forces the reader back to the bottom | Follow streaming only while the reader is near the bottom | Allows inspecting previous work during a response |
| Repeated send during startup | Immediate in-flight guard; clear disabled/stop states | Prevents accidental duplicate questions while the process starts |
| Studio starts with an unrelated scrubber example | Relevant prompt starters, concise header, explicit demo/paid-generation context, illustrated empty state | Makes the next action understandable and the demo account unambiguous |
| Exposed account identifiers in navigation | Business title and workspace state in the sidebar; account details stay in Account | Removes noise and makes the app easier to show |

Motion respects Reduce Motion. The data itself is not animated through fabricated intermediate values.

## Remaining bottlenecks, in priority order

1. **Complete a task inside the app.** Product creation, some member actions, and app setup still lead into raw commands. Build one excellent end-to-end flow: inspect a past-due member, ask Claude for a draft, review the proposed change, and confirm it. A focused member detail drawer would contribute more than another dashboard metric.
2. **Keep the assistant next to the work.** Whop's AI can sit beside the current page. A contextual assistant drawer would let a campaign or membership remain visible while discussing it. The full conversation view should remain available. This is a larger state-management change, not just a CSS panel.
3. **Make large lists usable.** Several lists request the first 50 or 100 records with no paging UI. Add cursor pagination, search, meaningful sorting, and a visible loaded-count label before presenting the app as ready for a large business.
4. **Connect Ads and Studio.** Campaigns, ad groups, and ads currently read as separate tables. A campaign detail view should connect performance, targeting, and creative; generated assets should be selectable without manually copying file IDs.
5. **Make every action's destination honest.** “New product” should open a creation flow, or explicitly say it opens a command draft. “View” should reveal useful details rather than unexpectedly switch to a terminal. Placeholder command strings are not finished product interactions.
6. **Strengthen recovery states.** Add retry in place, preserve draft input on failures, distinguish stopped from failed runs, and clarify which operations are running when leaving a view. Audit write permission lifetime and conversation ownership across account changes separately.
7. **Tighten the fixture universe.** Daily aggregates now agree across periods, but the twelve illustrative member records are still samples rather than a complete backing population. Label samples or generate matching pagination fixtures before making claims about exhaustive lists.

## Validation

- TypeScript and production frontend build pass.
- Native macOS bundle builds successfully.
- Native UI checked for Overview, period switching, command inspector, assistant transcript, and assistant empty state. A live read-only demo question completed, returned the corrected past-due date, and its output expanded while the answer and composer remained visible.
- Fixture checks: overlapping 7/30/90-day ranges agree for revenue, paid memberships, new users, and balance; the past-due record is in the past and retains its $129 renewal price.
- Review uses the bundled app in `src-tauri/target/release/bundle/macos`; the installed `/Applications` copy is not replaced by this build.

## Demo direction after the product pass

Show one complete thought: ask a specific business question, watch the command run, read the answer, inspect its evidence. Use the Overview period change to demonstrate the chart interaction. Keep the demo label visible. Film the actual interaction, then cut the waiting time and place the app over a restrained wallpaper. The video should reveal the craft already in the app.
