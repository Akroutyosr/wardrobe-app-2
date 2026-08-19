import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Home, Shirt, CalendarDays, Sparkles, ShoppingBag, Ruler } from "lucide-react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Nothing hanging here</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          This page isn't in the closet. Let's head back to something you love.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="tappable inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. Try again, or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="tappable inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground"
          >
            Try again
          </button>
          <a
            href="/"
            className="tappable inline-flex items-center justify-center rounded-full border border-input bg-card px-5 py-2.5 text-sm font-bold text-foreground"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Twinish — your closet, but make it a game" },
      {
        name: "description",
        content:
          "Twinish turns the clothes you already own into outfits you'll actually wear — colour-coded, scored and streaked.",
      },
      { property: "og:title", content: "Twinish — your closet, but make it a game" },
      {
        property: "og:description",
        content: "See your clothes as outfit possibilities, not a pile of stuff.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Caveat:wght@500;600;700&family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;600&display=swap",
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),

  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    // suppressHydrationWarning: browser extensions (Grammarly, etc.) inject
    // attributes into <html>/<body> after SSR, which React would otherwise
    // report as a hydration mismatch every load.
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body suppressHydrationWarning>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

const nav = [
  { to: "/", label: "Today", icon: Home },
  { to: "/closet", label: "Closet", icon: Shirt },
  { to: "/planner", label: "Week", icon: CalendarDays },
  { to: "/should-i-buy", label: "Buy?", icon: ShoppingBag },
  { to: "/fitting-room", label: "Try on", icon: Ruler },
  { to: "/quiz", label: "Quiz", icon: Sparkles },
] as const;

function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 z-40 hidden h-full w-56 flex-col border-r border-border bg-card/70 px-4 py-6 backdrop-blur md:flex">
      <Link to="/" className="display px-2 text-3xl">
        Twinish
      </Link>
      <p className="px-2 font-mono text-[0.6rem] font-bold uppercase tracking-[0.25em] text-muted-foreground">
        your closet, but a game
      </p>
      <nav className="mt-8 flex flex-col gap-1">
        {nav.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            activeOptions={{ exact: to === "/" }}
            className="tappable flex items-center gap-3 rounded-full px-3 py-2.5 text-sm font-bold text-muted-foreground hover:bg-[#FAA4B5]/20 hover:text-foreground data-[status=active]:bg-blush data-[status=active]:text-primary"
          >
            <Icon size={19} strokeWidth={2.2} />
            {label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}

function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-1/2 z-40 w-full max-w-[30rem] -translate-x-1/2 px-3 pb-3 md:hidden">
      <div className="flex items-center justify-between rounded-4xl border border-border bg-card/95 px-2 py-2 shadow-lift backdrop-blur">
        {nav.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            activeOptions={{ exact: to === "/" }}
            className="tappable group flex flex-1 flex-col items-center gap-0.5 rounded-3xl px-1 py-1.5 text-[0.68rem] font-bold text-muted-foreground data-[status=active]:bg-blush data-[status=active]:text-primary"
          >
            <Icon size={20} strokeWidth={2.2} />
            {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <Sidebar />
      <div className="mx-auto min-h-screen w-full max-w-[30rem] px-5 pt-6 pb-28 md:ml-56 md:max-w-none md:px-8 md:pb-16">
        <div className="mx-auto w-full max-w-screen-xl">
          <Outlet />
        </div>
      </div>
      <BottomNav />
    </QueryClientProvider>
  );
}
