# Whop Desktop landing page

Live at https://srikar-desktop.whop.site/. TanStack Start, hosted on Whop. The download button points at the signed 0.4.2 preview on GitHub Releases.

## Develop

```sh
bun install --frozen-lockfile
bun run dev
```

## Deploy

```sh
whop apps deploy
```

Log in as the Whop account that owns the app first. The command builds, typechecks, uploads and promotes in one go. The app id lives in `whop.app.json`. Pushing to GitHub does not deploy anything.
