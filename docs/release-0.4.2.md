# 0.4.2 preview

A guided first launch, and creative work inside the chat.

[![Tour](media/tour.jpg)](media/tour.mp4)

*48 seconds through Assistant, Overview, Studio and Ads. [Creative workflow demo](media/creative-workflow.mp4), 27 seconds.*

- First launch connects Whop, picks a business and connects Claude. It finds logins you already have. You can skip Claude and start in Overview, or try the demo business instead. Setup is always available again from Account.
- Ask the chat for an image and it shows a brief to review before anything is generated. Import your own artwork, edit it in Studio, save it as a local ad draft with the product, price and copy attached.
- Conversations and creative work come back after a restart.
- Smaller fixes across the business pages.

**Install:** Apple Silicon (M1 or newer), macOS 11+. Open the DMG, drag Whop Desktop into Applications. Signed with Developer ID, notarized, stapled.

Live business data needs the Whop CLI. Chat needs Claude Code, installed and signed in. Live image generation costs money from your Whop balance and asks first. Ad drafts stay on your Mac and never publish a campaign. Studio in demo mode shows labeled samples, not generated output.

## What I tested

Production build. The native onboarding with existing Whop and Claude logins. The browser build for the two paths I could not reproduce natively: no Whop CLI installed, and skipping Claude. The assistant, creative, media, business and campaign suites.

Not tested: a fresh install with OAuth on a clean Mac, and a paid generation. Imported artwork lives in browser storage, so many large imports will fill it. Campaign lists still show only the first 100 rows.
