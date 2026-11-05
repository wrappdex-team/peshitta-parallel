import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { NativeShell, ThemeColor } from "@/components/device-shell";
import appCss from "../styles.css?url";

import { SITE_DESCRIPTION, SITE_NAME, SITE_ORIGIN } from "@/lib/site";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: SITE_NAME },
      { name: "description", content: SITE_DESCRIPTION },
      { name: "application-name", content: SITE_NAME },
      { name: "robots", content: "index, follow, max-image-preview:large" },
      { name: "theme-color", content: "#f3efe4" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
    ],
  }),
  component: () => (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{if(JSON.parse(localStorage.getItem('peshitta-parallel')||'{}').theme==='night')document.documentElement.dataset.theme='night'}catch(e){}",
          }}
        />
        <PreviewHostBridge />
        <ThemeColor />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "WebSite",
                  name: SITE_NAME,
                  url: `${SITE_ORIGIN}/`,
                  description: SITE_DESCRIPTION,
                  inLanguage: ["en", "syr", "ar", "fr", "ru", "es", "zh", "de", "ja"],
                },
                {
                  "@type": "WebApplication",
                  name: SITE_NAME,
                  url: `${SITE_ORIGIN}/`,
                  applicationCategory: "EducationalApplication",
                  operatingSystem: "Any",
                  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
                  description: SITE_DESCRIPTION,
                },
              ],
            }),
          }}
        />
        <NativeShell />
        <AuthProvider>
          <Outlet />
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  ),
});
