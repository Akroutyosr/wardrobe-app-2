import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Home, Shirt, CalendarDays, Sparkles, ShoppingBag, Ruler } from "lucide-react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { QuickLog } from "@/components/QuickLog";
import { Toaster } from "@/components/ui/sonner";

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

/**
 * The one navigation for every screen size: a sticky glass bar with the
 * Twinish brand on the left and destination pills on the right. Replaces the
 * old split arrangement (bottom tabs on mobile, sidebar on desktop) so there
 * is exactly one obvious place to look for navigation.
 */
function AppNavbar() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-screen-xl items-center justify-between gap-2 px-3 sm:px-5">
        <Link to="/" aria-label="Twinish home" className="tappable shrink-0">
          <span className="display block text-[1.4rem] leading-none">Twinish</span>
          {/* hand-scribbled underline — the app's annotation habit, shrunk into a signature */}
          <svg
            viewBox="0 0 100 8"
            preserveAspectRatio="none"
            aria-hidden="true"
            className="mt-1 h-1.5 w-14 text-rose"
          >
            <path
              d="M2 6 C 20 2, 35 7, 52 4 S 86 2, 98 5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.6"
              strokeLinecap="round"
            />
          </svg>
        </Link>

        <nav className="flex items-center gap-0.5 sm:gap-1" aria-label="Primary">
          {nav.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              activeOptions={{ exact: to === "/" }}
              aria-label={label}
              className="tappable flex items-center gap-1.5 rounded-full px-2 py-2 text-sm font-bold text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[status=active]:bg-blush data-[status=active]:text-primary sm:px-3"
            >
              <Icon size={19} strokeWidth={2.2} />
              <span className="hidden md:inline">{label}</span>
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const [quickLogOpen, setQuickLogOpen] = useState(false);

  return (
    <QueryClientProvider client={queryClient}>
      <AppNavbar />
      <div className="mx-auto min-h-screen w-full max-w-[30rem] px-5 pt-6 pb-28 md:max-w-screen-xl md:pb-16 md:pl-8 md:pr-8">
        <div className="mx-auto w-full max-w-screen-xl">
          <Outlet />
        </div>
      </div>
      {/* Floating quick-log button */}
      <button
        onClick={() => setQuickLogOpen(true)}
        aria-label="Log today's outfit"
        className="tappable fixed right-4 bottom-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-rose text-2xl text-primary-foreground shadow-lift md:right-8 md:bottom-8"
      >
        👗
      </button>
      <QuickLog isOpen={quickLogOpen} onClose={() => setQuickLogOpen(false)} />
      <Toaster position="top-center" />
    </QueryClientProvider>
  );
}
