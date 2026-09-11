# First-launch onboarding

Version 0.4.2 offers a guided setup from Welcome and from **Account → Workspace setup**. Existing installs keep their completed-welcome flag and are not forced through setup again.

1. **Business:** detect the installed Whop CLI, show the official install command only when missing, invoke native browser OAuth, then select a business. Refresh waits for the actual connection check. A signed-in account with no available businesses gets a recovery path to Whop and another login.
2. **Assistant:** detect Claude Code and its authentication independently. Offer installation help or native browser sign-in, or skip this step. Explain that chat uses the user's Claude account and that live image generation is separately billed from Whop balance after confirmation.
3. **Ready:** show the selected workspace and connection status. Connected Claude users land in Assistant; users who skip Claude land in Overview. Finishing setup refreshes the already-mounted Assistant's connection state.

Demo setup skips Whop authentication and selects Northwind Picks. It still offers optional Claude setup rather than dropping a new user into an unusable chat. Demo data and Studio samples are identified as such.

The setup never installs software automatically, submits a chat, generates paid media, or publishes a campaign. Browser sign-in uses the existing native commands; tokens do not enter the setup UI.

The 0.4.2 preview includes this flow in the signed and notarized Mac installer.

Validation: production frontend and native app builds passed, plus the assistant and business regression suites. Browser walkthrough covered missing Whop installation, skipping Claude, demo-to-Overview completion, and reopening setup. Native walkthrough detected the existing Whop login and four businesses, preserved Frame selection, detected authenticated Claude, and returned to the saved Assistant conversation. Fresh OAuth and installing dependencies on a clean Mac were not exercised in this run.
