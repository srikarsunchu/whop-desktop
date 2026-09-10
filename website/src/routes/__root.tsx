import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'
import appCss from '../styles.css?url'
export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Whop Desktop — Your business, on your Mac' },
      { name: 'description', content: 'An unofficial desktop workspace for your Whop business. Revenue, customers, creative tools, and an assistant. Download the signed Mac preview.' },
      { property: 'og:type', content: 'website' },
      { property: 'og:site_name', content: 'Whop Desktop' },
      { property: 'og:title', content: 'Whop Desktop — Your business, on your Mac' },
      { property: 'og:description', content: 'Revenue, customers, creative tools, and an assistant. An unofficial Mac app built on the Whop CLI.' },
      { property: 'og:url', content: 'https://srikar-desktop.whop.site/' },
      { property: 'og:image', content: 'https://srikar-desktop.whop.site/og-image.jpg' },
      { property: 'og:image:type', content: 'image/jpeg' },
      { property: 'og:image:width', content: '1920' },
      { property: 'og:image:height', content: '1080' },
      { property: 'og:image:alt', content: 'Whop Desktop business dashboard on a Mac wallpaper, showing demo revenue and an assistant.' },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: 'Whop Desktop — Your business, on your Mac' },
      { name: 'twitter:description', content: 'Revenue, customers, creative tools, and an assistant. Download the signed Mac preview.' },
      { name: 'twitter:image', content: 'https://srikar-desktop.whop.site/og-image.jpg' },
      { name: 'twitter:image:alt', content: 'Whop Desktop business dashboard on a Mac wallpaper.' },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'icon', href: '/app-icon.png' },
      { rel: 'canonical', href: 'https://srikar-desktop.whop.site/' },
    ],
  }),
  shellComponent: RootDocument,
})
function RootDocument({ children }: { children: React.ReactNode }) {
  return <html lang="en"><head><HeadContent /></head><body>{children}<Scripts /></body></html>
}
