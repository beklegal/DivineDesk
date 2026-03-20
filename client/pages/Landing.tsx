import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand/BrandLogo";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  Calendar,
  HeartHandshake,
  LineChart,
  ShieldCheck,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react";

const featureCards = [
  {
    icon: Users,
    title: "Member care in one place",
    description:
      "Track people, ministry groups, follow-up notes, and onboarding without spreading records across spreadsheets.",
  },
  {
    icon: Wallet,
    title: "Giving with better visibility",
    description:
      "Monitor tithes, offerings, and campaigns with live totals that help pastors and finance teams stay aligned.",
  },
  {
    icon: Calendar,
    title: "Events that stay organized",
    description:
      "Coordinate services, midweek gatherings, and outreach moments with attendance and registration context built in.",
  },
  {
    icon: HeartHandshake,
    title: "Attendance built for follow-up",
    description:
      "Capture who showed up, who needs care, and where engagement is growing week by week.",
  },
];

const trustPoints = [
  "Persistent local database for churches, users, members, and giving",
  "Clean admin and church dashboards built for fast weekly decisions",
  "Ready for multi-church growth with super-admin oversight",
];

const stats = [
  { label: "Churches using the workflow", value: "21+" },
  { label: "Members coordinated", value: "4.5K" },
  { label: "Monthly giving tracked", value: "$71K" },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(15,23,42,0.08),_transparent_35%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_48%,#ffffff_100%)] text-slate-900">
      <header className="sticky top-0 z-30 border-b border-white/60 bg-white/75 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link to="/" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-lg shadow-slate-950/15 ring-1 ring-slate-200">
              <BrandLogo className="scale-[1.08]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-950">DivineDesk</p>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
                Ministry OS
              </p>
            </div>
          </Link>

          <nav className="hidden items-center gap-8 text-sm font-medium text-slate-500 md:flex">
            <a href="#features" className="transition hover:text-slate-950">
              Features
            </a>
            <a href="#platform" className="transition hover:text-slate-950">
              Platform
            </a>
            <a href="#trust" className="transition hover:text-slate-950">
              Why teams switch
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <Link to="/login">
              <Button
                variant="ghost"
                className="rounded-2xl border border-transparent px-4 text-slate-600 hover:border-slate-200 hover:bg-white hover:text-slate-950"
              >
                Sign in
              </Button>
            </Link>
            <Link to="/signup">
              <Button className="rounded-2xl bg-slate-950 px-5 text-white hover:bg-slate-800">
                Start now
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:py-24">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.26em] text-slate-500 shadow-sm">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              Modern church operations
            </div>
            <h1 className="max-w-3xl text-5xl font-semibold leading-[1.02] text-slate-950 sm:text-6xl">
              Run your church from a system that feels calm, clear, and current.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
              DivineDesk brings member care, giving, events, attendance, and leadership reporting into one polished workspace built for weekly ministry rhythm.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to="/signup">
                <Button className="h-12 rounded-2xl bg-slate-950 px-6 text-white hover:bg-slate-800">
                  Launch your workspace
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link to="/login">
                <Button
                  variant="outline"
                  className="h-12 rounded-2xl border-slate-300 bg-white px-6 text-slate-900 hover:bg-slate-50"
                >
                  Explore demo access
                </Button>
              </Link>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-[28px] border border-white/70 bg-white/80 p-5 shadow-[0_20px_60px_-36px_rgba(15,23,42,0.65)] backdrop-blur"
                >
                  <p className="text-3xl font-semibold text-slate-950">{stat.value}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-500">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="absolute -left-8 top-10 h-32 w-32 rounded-full bg-amber-300/35 blur-3xl" />
            <div className="absolute -right-8 bottom-10 h-40 w-40 rounded-full bg-cyan-300/25 blur-3xl" />

            <div className="relative overflow-hidden rounded-[36px] border border-white/80 bg-slate-950 p-6 text-white shadow-[0_35px_90px_-40px_rgba(15,23,42,0.95)]">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(251,191,36,0.22),_transparent_28%),radial-gradient(circle_at_bottom_left,_rgba(45,212,191,0.16),_transparent_28%)]" />
              <div className="relative space-y-6">
                <div className="flex items-center justify-between rounded-3xl border border-white/10 bg-white/10 px-5 py-4 backdrop-blur">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-300">
                      Grace Community Church
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-white">Leadership snapshot</p>
                  </div>
                  <div className="rounded-2xl bg-amber-300 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-950">
                    Live
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-[28px] border border-white/10 bg-white/10 p-5">
                    <div className="mb-4 flex items-center justify-between">
                      <Users className="h-5 w-5 text-amber-300" />
                      <span className="text-xs uppercase tracking-[0.24em] text-slate-400">
                        Members
                      </span>
                    </div>
                    <p className="text-4xl font-semibold text-white">180</p>
                    <p className="mt-2 text-sm text-slate-300">
                      Active people records with ministry tags and follow-up notes.
                    </p>
                  </div>

                  <div className="rounded-[28px] border border-white/10 bg-white/10 p-5">
                    <div className="mb-4 flex items-center justify-between">
                      <Wallet className="h-5 w-5 text-emerald-300" />
                      <span className="text-xs uppercase tracking-[0.24em] text-slate-400">
                        Giving
                      </span>
                    </div>
                    <p className="text-4xl font-semibold text-white">$7.1K</p>
                    <p className="mt-2 text-sm text-slate-300">
                      Rolling monthly giving with faster visibility for stewardship planning.
                    </p>
                  </div>
                </div>

                <div className="rounded-[28px] border border-white/10 bg-white/10 p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <p className="text-sm font-semibold text-white">Engagement timeline</p>
                    <LineChart className="h-5 w-5 text-cyan-300" />
                  </div>
                  <div className="flex h-32 items-end gap-3">
                    {[28, 42, 35, 58, 63, 74].map((height, index) => (
                      <div key={index} className="flex-1">
                        <div
                          className="rounded-t-full bg-gradient-to-t from-amber-300 via-cyan-300 to-white"
                          style={{ height: `${height}%` }}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex justify-between text-xs uppercase tracking-[0.24em] text-slate-400">
                    <span>Oct</span>
                    <span>Nov</span>
                    <span>Dec</span>
                    <span>Jan</span>
                    <span>Feb</span>
                    <span>Mar</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
          <div className="mb-10 max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
              Core workflow
            </p>
            <h2 className="mt-3 text-4xl font-semibold text-slate-950">
              Modern operations for pastors, admins, and care teams
            </h2>
            <p className="mt-4 text-lg leading-8 text-slate-600">
              Every screen is designed around the weekly questions ministry teams actually ask: who came, who gave, what is next, and who needs follow-up.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            {featureCards.map((feature) => {
              const Icon = feature.icon;

              return (
                <article
                  key={feature.title}
                  className="rounded-[30px] border border-white/70 bg-white/85 p-6 shadow-[0_24px_60px_-36px_rgba(15,23,42,0.55)] backdrop-blur transition hover:-translate-y-1 hover:shadow-[0_30px_80px_-36px_rgba(15,23,42,0.62)]"
                >
                  <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-[22px] bg-slate-950 text-amber-300">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-2xl font-semibold text-slate-950">{feature.title}</h3>
                  <p className="mt-3 text-base leading-7 text-slate-600">
                    {feature.description}
                  </p>
                </article>
              );
            })}
          </div>
        </section>

        <section id="platform" className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
          <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-[32px] border border-slate-200 bg-slate-950 p-8 text-white shadow-[0_35px_90px_-44px_rgba(15,23,42,0.95)]">
              <p className="text-xs uppercase tracking-[0.28em] text-slate-400">
                Built for growth
              </p>
              <h2 className="mt-4 text-4xl font-semibold text-white">
                One platform for church teams and system admins.
              </h2>
              <p className="mt-4 text-base leading-7 text-slate-300">
                Churches get an elegant operating workspace. Platform admins get portfolio visibility across churches, users, and reports.
              </p>
              <div className="mt-8 space-y-4">
                {[
                  "Church dashboard with live attendance and giving signals",
                  "Dedicated super-admin control center for network oversight",
                  "Persistent database-backed records instead of reset-on-refresh demo state",
                ].map((item) => (
                  <div key={item} className="flex items-start gap-3">
                    <BadgeCheck className="mt-1 h-5 w-5 text-amber-300" />
                    <p className="text-sm leading-6 text-slate-300">{item}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="rounded-[30px] border border-white/70 bg-white/90 p-6 shadow-[0_24px_60px_-36px_rgba(15,23,42,0.55)]">
                <ShieldCheck className="h-10 w-10 text-slate-950" />
                <h3 className="mt-5 text-2xl font-semibold text-slate-950">
                  Structured access
                </h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  Separate church admins from platform admins while keeping the experience polished and easy to learn.
                </p>
              </div>

              <div className="rounded-[30px] border border-white/70 bg-white/90 p-6 shadow-[0_24px_60px_-36px_rgba(15,23,42,0.55)]">
                <Building2 className="h-10 w-10 text-slate-950" />
                <h3 className="mt-5 text-2xl font-semibold text-slate-950">
                  Multi-church ready
                </h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  Manage several church workspaces while preserving a tailored view for each congregation.
                </p>
              </div>

              <div className="rounded-[30px] border border-white/70 bg-white/90 p-6 shadow-[0_24px_60px_-36px_rgba(15,23,42,0.55)]">
                <LineChart className="h-10 w-10 text-slate-950" />
                <h3 className="mt-5 text-2xl font-semibold text-slate-950">
                  Clear leadership insight
                </h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  View trendlines for giving, growth, attendance, and recent activity without leaving the dashboard.
                </p>
              </div>

              <div className="rounded-[30px] border border-white/70 bg-white/90 p-6 shadow-[0_24px_60px_-36px_rgba(15,23,42,0.55)]">
                <Calendar className="h-10 w-10 text-slate-950" />
                <h3 className="mt-5 text-2xl font-semibold text-slate-950">
                  Weekly rhythm support
                </h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  From Sunday prep to post-service follow-up, the product is organized around actual church operating cadence.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section id="trust" className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
          <div className="rounded-[36px] border border-white/70 bg-white/90 p-8 shadow-[0_30px_80px_-40px_rgba(15,23,42,0.6)] backdrop-blur sm:p-10">
            <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
                  Why teams switch
                </p>
                <h2 className="mt-3 text-4xl font-semibold text-slate-950">
                  Less admin drag. More ministry clarity.
                </h2>
                <p className="mt-4 text-lg leading-8 text-slate-600">
                  The system is now cleaner, more modern, and backed by persistent data so teams can rely on it week after week.
                </p>
              </div>

              <div className="space-y-4">
                {trustPoints.map((point) => (
                  <div
                    key={point}
                    className="flex items-start gap-4 rounded-[26px] border border-slate-200 bg-slate-50 px-5 py-4"
                  >
                    <BadgeCheck className="mt-1 h-5 w-5 text-emerald-500" />
                    <p className="text-sm leading-7 text-slate-600">{point}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <div className="rounded-[36px] border border-white/60 bg-slate-950 px-8 py-12 text-center text-white shadow-[0_35px_90px_-40px_rgba(15,23,42,0.95)]">
            <p className="text-xs uppercase tracking-[0.28em] text-slate-400">
              Ready to start
            </p>
            <h2 className="mt-4 text-4xl font-semibold text-white">
              Launch a workspace your team will actually enjoy using.
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-slate-300">
              Sign in with the seeded demo accounts or create a new church and start with a persistent setup from day one.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link to="/login">
                <Button className="h-12 rounded-2xl bg-white px-6 text-slate-950 hover:bg-slate-100">
                  Open demo access
                </Button>
              </Link>
              <Link to="/signup">
                <Button
                  variant="outline"
                  className="h-12 rounded-2xl border-white/20 bg-white/5 px-6 text-white hover:bg-white/10"
                >
                  Create your church account
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
