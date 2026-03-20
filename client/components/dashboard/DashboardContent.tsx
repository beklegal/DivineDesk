import { Link } from "react-router-dom";
import {
  ArrowRight,
  CalendarDays,
  DollarSign,
  Loader2,
  TrendingUp,
  UserPlus,
  Users,
} from "lucide-react";
import { useDashboardData } from "@/hooks/useDashboardData";
import { Badge } from "@/components/ui/badge";
import { formatChurchCurrency } from "@/lib/currency";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function TrendBars({
  items,
  colorClassName,
  formatter,
}: {
  items: Array<{ date: string; value: number }>;
  colorClassName: string;
  formatter: (value: number) => string;
}) {
  const peak = Math.max(...items.map((item) => item.value), 1);

  return (
    <div className="space-y-4">
      {items.map((item) => (
        <div key={item.date} className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-slate-600">{item.date}</span>
            <span className="text-slate-900">{formatter(item.value)}</span>
          </div>
          <div className="h-2 rounded-full bg-slate-100">
            <div
              className={`h-2 rounded-full ${colorClassName}`}
              style={{ width: `${Math.max((item.value / peak) * 100, item.value > 0 ? 8 : 0)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function DashboardContent() {
  const { data, isLoading, error } = useDashboardData({ refetchInterval: 15000 });

  if (isLoading && !data) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-[32px] border border-slate-200 bg-white shadow-sm">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-slate-400" />
          <p className="mt-3 text-sm text-slate-500">Loading church dashboard...</p>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="rounded-[32px] border border-red-200 bg-red-50 px-6 py-5 text-sm text-red-700 shadow-sm">
        {error}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-[32px] border border-slate-200 bg-white px-6 py-5 text-sm text-slate-500 shadow-sm">
        No dashboard data is available yet.
      </div>
    );
  }

  const latestGiving = data.recentDonations.reduce(
    (sum, donation) => sum + donation.amount,
    0,
  );
  const newMembersThisView = data.recentMembers.length;
  const scheduledEvents = data.upcomingEvents.filter(
    (event) => event.status === "scheduled",
  ).length;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="rounded-[28px] border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardDescription className="text-slate-500">Weekly attendance</CardDescription>
            <CardTitle className="flex items-center justify-between text-3xl text-slate-950">
              {data.weeklyAttendance.toLocaleString()}
              <Users className="h-5 w-5 text-emerald-500" />
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-500">
            Average recent turnout across services.
          </CardContent>
        </Card>

        <Card className="rounded-[28px] border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardDescription className="text-slate-500">Recent giving</CardDescription>
            <CardTitle className="flex items-center justify-between text-3xl text-slate-950">
              {formatChurchCurrency(latestGiving, { compact: true })}
              <DollarSign className="h-5 w-5 text-amber-500" />
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-500">
            Combined from the latest {data.recentDonations.length} donations.
          </CardContent>
        </Card>

        <Card className="rounded-[28px] border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardDescription className="text-slate-500">Upcoming events</CardDescription>
            <CardTitle className="flex items-center justify-between text-3xl text-slate-950">
              {data.upcomingEvents.length.toLocaleString()}
              <CalendarDays className="h-5 w-5 text-sky-500" />
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-500">
            {scheduledEvents} currently scheduled on the calendar.
          </CardContent>
        </Card>

        <Card className="rounded-[28px] border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardDescription className="text-slate-500">New members in view</CardDescription>
            <CardTitle className="flex items-center justify-between text-3xl text-slate-950">
              {newMembersThisView.toLocaleString()}
              <UserPlus className="h-5 w-5 text-violet-500" />
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-500">
            Most recent additions to your people pipeline.
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="rounded-[32px] border-slate-200 shadow-sm">
          <CardHeader>
            <CardDescription className="text-slate-500">Giving trend</CardDescription>
            <CardTitle className="flex items-center gap-3 text-slate-950">
              <TrendingUp className="h-5 w-5 text-emerald-500" />
              Monthly donations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <TrendBars
              items={data.donationTrend.map((item) => ({
                date: item.date,
                value: item.amount,
              }))}
              colorClassName="bg-emerald-500"
              formatter={(value) => formatChurchCurrency(value, { compact: true })}
            />
          </CardContent>
        </Card>

        <Card className="rounded-[32px] border-slate-200 shadow-sm">
          <CardHeader>
            <CardDescription className="text-slate-500">People trend</CardDescription>
            <CardTitle className="flex items-center gap-3 text-slate-950">
              <Users className="h-5 w-5 text-sky-500" />
              Member growth
            </CardTitle>
          </CardHeader>
          <CardContent>
            <TrendBars
              items={data.memberGrowth.map((item) => ({
                date: item.date,
                value: item.count,
              }))}
              colorClassName="bg-sky-500"
              formatter={(value) => `${value} members`}
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="rounded-[32px] border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardDescription className="text-slate-500">People</CardDescription>
              <CardTitle className="text-slate-950">Recent members</CardTitle>
            </div>
            <Link
              to="/members"
              className="inline-flex items-center text-sm font-medium text-slate-600 transition hover:text-slate-950"
            >
              View all
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.recentMembers.length === 0 ? (
              <p className="text-sm text-slate-500">No members added yet.</p>
            ) : (
              data.recentMembers.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between gap-4 rounded-3xl border border-slate-100 bg-slate-50 px-4 py-4"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-950">{member.name}</p>
                    <p className="truncate text-sm text-slate-500">{member.email}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge variant="outline" className="border-slate-200 bg-white text-slate-600">
                      {member.ministryGroup}
                    </Badge>
                    <span className="text-xs text-slate-400">{formatDate(member.joinDate)}</span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="rounded-[32px] border-slate-200 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardDescription className="text-slate-500">Calendar</CardDescription>
                <CardTitle className="text-slate-950">Upcoming events</CardTitle>
              </div>
              <Link
                to="/events"
                className="inline-flex items-center text-sm font-medium text-slate-600 transition hover:text-slate-950"
              >
                Open events
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </CardHeader>
            <CardContent className="space-y-4">
              {data.upcomingEvents.length === 0 ? (
                <p className="text-sm text-slate-500">No upcoming events on the calendar.</p>
              ) : (
                data.upcomingEvents.map((event) => (
                  <div
                    key={event.id}
                    className="rounded-3xl border border-slate-100 bg-slate-50 px-4 py-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-slate-950">{event.name}</p>
                        <p className="text-sm text-slate-500">
                          {formatDate(event.date)} - {event.time}
                        </p>
                      </div>
                      <Badge variant="outline" className="border-slate-200 bg-white capitalize text-slate-600">
                        {event.type}
                      </Badge>
                    </div>
                    <p className="mt-3 text-sm text-slate-500">{event.location}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="rounded-[32px] border-slate-200 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardDescription className="text-slate-500">Stewardship</CardDescription>
                <CardTitle className="text-slate-950">Recent donations</CardTitle>
              </div>
              <Link
                to="/donations"
                className="inline-flex items-center text-sm font-medium text-slate-600 transition hover:text-slate-950"
              >
                Open giving
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </CardHeader>
            <CardContent className="space-y-4">
              {data.recentDonations.length === 0 ? (
                <p className="text-sm text-slate-500">No donations recorded yet.</p>
              ) : (
                data.recentDonations.map((donation) => (
                  <div
                    key={donation.id}
                    className="flex items-center justify-between gap-4 rounded-3xl border border-slate-100 bg-slate-50 px-4 py-4"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-950">{donation.memberName}</p>
                      <p className="text-sm capitalize text-slate-500">
                        {donation.type.replace(/_/g, " ")}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-slate-950">
                        {formatChurchCurrency(donation.amount)}
                      </p>
                      <p className="text-xs text-slate-400">{formatDate(donation.date)}</p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
