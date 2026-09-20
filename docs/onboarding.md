# First-launch onboarding

0.4.2 adds a setup flow. It runs from Welcome on a fresh install and from **Account → Workspace setup** any time after. Existing installs keep their completed flag and are not sent through it again.

Three steps.

1. **Business.** Check for the Whop CLI, and show the install command only if it is missing. Open the browser OAuth. Pick a business. Refresh actually waits for the connection check. If you are signed in but have no businesses, there is a path to Whop and back to log in again.
2. **Assistant.** Check for Claude Code and its login, separately. Offer install help, browser sign-in, or skip. The step says that chat runs on your Claude account and that live image generation is billed separately from your Whop balance, after a confirmation.
3. **Ready.** Show the workspace and connection status. If Claude is connected you land in Assistant, otherwise Overview. Finishing setup refreshes the Assistant that is already mounted underneath.

The demo path skips Whop auth and picks Northwind Picks. It still offers the Claude step, so a new user is not dropped into a chat that cannot answer. Demo data and Studio samples are labeled as such.

Setup never installs software, sends a chat message, generates paid media or publishes a campaign. Browser sign-in uses the existing native commands. Tokens never pass through the setup UI.

The 0.4.2 preview includes this flow.

## What I tested

Production frontend and native builds, plus the assistant and business suites. In the browser build: no Whop CLI installed, skipping Claude, demo through to Overview, and reopening setup. In the native app: it found the existing Whop login and four businesses, kept the Frame selection, found the Claude login, and returned to the saved Assistant conversation.

Not tested: fresh OAuth and installing the CLIs on a clean Mac.
