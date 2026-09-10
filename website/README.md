# Whop Desktop landing page

Live at https://srikar-desktop.whop.site/.

The landing page and demo are hosted on Whop using TanStack Start. The Mac download links to the signed, notarized 0.4.0 preview on GitHub Releases.

## Develop

```sh
bun install --frozen-lockfile
bun run dev
```

## Deploy

```sh
whop apps deploy
```

Sign in to the Whop account that owns the app first. Deployment builds, typechecks, uploads, and promotes the site. The app connection is in whop.app.json. GitHub pushes do not deploy automatically.
