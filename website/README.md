# Whop Desktop landing page

Live at https://whop-desktop.sunchusrikar.chatgpt.site/.

This directory contains the published landing page source and demo assets, including the updated SVG arrows and simplified labels. It is a separate npm project from the desktop app.

## Local development

```sh
npm ci
npm run dev
```

## Production build

```sh
npm run build
```

The static output is written to `dist/client`. Sites deployment settings are in `.openai/hosting.json`. Pushing this GitHub repository does not automatically deploy the website.

The download remains disabled until a signed, notarized Mac release is available.
