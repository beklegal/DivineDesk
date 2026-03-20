import { RequestHandler } from "express";
import type {
  AttendanceRecord,
  Church,
  ChurchBranch,
  ChurchEvent,
  CreateDonationRequest,
  CreateEventRequest,
  CreateMemberRequest,
  DashboardData,
  Donation,
  MarkAttendanceRequest,
  Member,
} from "../../shared/api";
import { createId, readDatabase, updateDatabase } from "../data/database";
import { findChurchBranch, resolvePrimaryBranchId } from "../lib/branches";

const monthFormatter = new Intl.DateTimeFormat("en-US", { month: "short" });

function getChurchId(req: any) {
  return req.churchId as string | null;
}

function getBranchId(req: any) {
  return req.branchId as string | null;
}

function requireChurchId(req: any, res: any) {
  const churchId = getChurchId(req);

  if (!churchId) {
    res.status(401).json({ success: false, error: "Unauthorized" });
    return null;
  }

  return churchId;
}

function requireChurchWorkspaceAccess(req: any, res: any) {
  const churchId = requireChurchId(req, res);

  if (!churchId) {
    return null;
  }

  if (!req.hasChurchWorkspaceAccess) {
    res.status(402).json({
      success: false,
      error:
        "This workspace is locked pending subscription payment. Complete the Paystack payment to continue.",
    });
    return null;
  }

  return churchId;
}

function filterByBranchScope<T extends { churchId: string; branchId?: string }>(
  items: T[],
  churchId: string,
  branchId?: string | null,
) {
  return items.filter(
    (item) => item.churchId === churchId && (!branchId || item.branchId === branchId),
  );
}

function calculateScopedWeeklyAttendance(
  events: ChurchEvent[],
  attendance: AttendanceRecord[],
  fallback = 0,
) {
  const rankedEvents = [...events]
    .sort((left, right) => parseDate(right.date).getTime() - parseDate(left.date).getTime())
    .slice(0, 4);

  const attendanceCounts = rankedEvents
    .map((event) => {
      const recorded = attendance.filter(
        (entry) => entry.eventId === event.id && entry.attended,
      ).length;

      return recorded || event.registeredAttendees || 0;
    })
    .filter((count) => count > 0);

  if (attendanceCounts.length === 0) {
    return fallback;
  }

  return Math.round(
    attendanceCounts.reduce((total, value) => total + value, 0) /
      attendanceCounts.length,
  );
}

function resolveTargetBranchId(options: {
  requestedBranchId?: string | null;
  scopedBranchId?: string | null;
  church: Pick<Church, "id" | "primaryBranchId">;
  branches: ChurchBranch[];
}) {
  if (options.scopedBranchId) {
    return options.scopedBranchId;
  }

  if (options.requestedBranchId) {
    return (
      findChurchBranch(options.branches, options.church.id, options.requestedBranchId)?.id ??
      null
    );
  }

  return (
    resolvePrimaryBranchId(options.church, options.branches) ??
    findChurchBranch(options.branches, options.church.id, options.church.primaryBranchId)?.id ??
    null
  );
}

function parseDate(value: string) {
  return new Date(value);
}

function createMonthSeries(length = 6) {
  const now = new Date();
  const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  return Array.from({ length }, (_, index) => {
    const month = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth() - (length - index - 1),
      1,
    );

    return {
      key: `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`,
      label: monthFormatter.format(month),
      end: new Date(month.getFullYear(), month.getMonth() + 1, 0, 23, 59, 59, 999),
    };
  });
}

function buildDonationTrend(donations: Donation[]) {
  const months = createMonthSeries();

  return months.map((month) => ({
    date: month.label,
    amount: donations
      .filter((donation) => donation.date.startsWith(month.key))
      .reduce((total, donation) => total + donation.amount, 0),
  }));
}

function buildMemberGrowth(members: Member[]) {
  const months = createMonthSeries();

  return months.map((month) => ({
    date: month.label,
    count: members.filter((member) => parseDate(member.joinDate) <= month.end).length,
  }));
}

export const handleGetMembers: RequestHandler = async (req: any, res) => {
  try {
    const churchId = requireChurchWorkspaceAccess(req, res);
    if (!churchId) {
      return;
    }
    const branchId = getBranchId(req);

    const database = await readDatabase();
    const members = filterByBranchScope(database.members, churchId, branchId)
      .sort((left, right) => right.joinDate.localeCompare(left.joinDate));

    res.json({ success: true, data: members });
  } catch {
    res.status(500).json({ success: false, error: "Failed to get members" });
  }
};

export const handleCreateMember: RequestHandler = async (req: any, res) => {
  try {
    const churchId = requireChurchWorkspaceAccess(req, res);
    if (!churchId) {
      return;
    }
    const scopedBranchId = getBranchId(req);

    const memberData = req.body as CreateMemberRequest;

    if (!memberData.name || !memberData.email) {
      res.status(400).json({ success: false, error: "Name and email are required" });
      return;
    }

    const result = await updateDatabase((database) => {
      const church = database.churches.find((candidate) => candidate.id === churchId);
      if (!church) {
        return { error: "Church not found" as const, statusCode: 404 };
      }

      const branchId = resolveTargetBranchId({
        requestedBranchId: memberData.branchId,
        scopedBranchId,
        church,
        branches: database.branches,
      });

      if (!branchId) {
        return { error: "Select a valid branch for this member" as const, statusCode: 400 };
      }

      const duplicate = database.members.find(
        (member) =>
          member.churchId === churchId &&
          member.email.toLowerCase() === memberData.email.trim().toLowerCase(),
      );

      if (duplicate) {
        return { error: "A member with that email already exists" as const };
      }

      const newMember: Member = {
        id: createId("member"),
        churchId,
        branchId,
        name: memberData.name.trim(),
        email: memberData.email.trim().toLowerCase(),
        phone: memberData.phone?.trim() ?? "",
        address: memberData.address?.trim() ?? "",
        ministryGroup: memberData.ministryGroup?.trim() || "General",
        joinDate: new Date().toISOString().split("T")[0],
        status: memberData.status ?? "active",
        notes: memberData.notes?.trim() ?? "",
      };

      database.members.push(newMember);
      return { data: newMember };
    });

    if ("error" in result) {
      res.status(result.statusCode ?? 409).json({ success: false, error: result.error });
      return;
    }

    res.status(201).json({ success: true, data: result.data });
  } catch {
    res.status(500).json({ success: false, error: "Failed to create member" });
  }
};

export const handleGetDonations: RequestHandler = async (req: any, res) => {
  try {
    const churchId = requireChurchWorkspaceAccess(req, res);
    if (!churchId) {
      return;
    }
    const branchId = getBranchId(req);

    const database = await readDatabase();
    const donations = filterByBranchScope(database.donations, churchId, branchId)
      .sort((left, right) => right.date.localeCompare(left.date));

    res.json({ success: true, data: donations });
  } catch {
    res.status(500).json({ success: false, error: "Failed to get donations" });
  }
};

export const handleCreateDonation: RequestHandler = async (req: any, res) => {
  try {
    const churchId = requireChurchWorkspaceAccess(req, res);
    if (!churchId) {
      return;
    }
    const scopedBranchId = getBranchId(req);

    const donationData = req.body as CreateDonationRequest;

    if (!donationData.memberId || !donationData.amount) {
      res.status(400).json({ success: false, error: "Member and amount are required" });
      return;
    }

    const result = await updateDatabase((database) => {
      const member = database.members.find(
        (candidate) =>
          candidate.churchId === churchId &&
          candidate.id === donationData.memberId &&
          (!scopedBranchId || candidate.branchId === scopedBranchId),
      );

      if (!member) {
        return { error: "Member not found" as const };
      }

      const donation: Donation = {
        id: createId("donation"),
        churchId,
        branchId: member.branchId,
        memberId: donationData.memberId,
        memberName: member.name,
        amount: Number(donationData.amount),
        type: donationData.type,
        date: new Date().toISOString().split("T")[0],
        notes: donationData.notes?.trim() ?? "",
      };

      database.donations.push(donation);
      return { data: donation };
    });

    if ("error" in result) {
      res.status(404).json({ success: false, error: result.error });
      return;
    }

    res.status(201).json({ success: true, data: result.data });
  } catch {
    res.status(500).json({ success: false, error: "Failed to create donation" });
  }
};

export const handleGetEvents: RequestHandler = async (req: any, res) => {
  try {
    const churchId = requireChurchWorkspaceAccess(req, res);
    if (!churchId) {
      return;
    }
    const branchId = getBranchId(req);

    const database = await readDatabase();
    const events = filterByBranchScope(database.events, churchId, branchId)
      .sort((left, right) => left.date.localeCompare(right.date));

    res.json({ success: true, data: events });
  } catch {
    res.status(500).json({ success: false, error: "Failed to get events" });
  }
};

export const handleCreateEvent: RequestHandler = async (req: any, res) => {
  try {
    const churchId = requireChurchWorkspaceAccess(req, res);
    if (!churchId) {
      return;
    }
    const scopedBranchId = getBranchId(req);

    const eventData = req.body as CreateEventRequest;

    if (!eventData.name || !eventData.date || !eventData.time || !eventData.location) {
      res.status(400).json({ success: false, error: "Missing required event details" });
      return;
    }

    const result = await updateDatabase((database) => {
      const church = database.churches.find((candidate) => candidate.id === churchId);
      if (!church) {
        return { error: "Church not found" as const, statusCode: 404 };
      }

      const branchId = resolveTargetBranchId({
        requestedBranchId: eventData.branchId,
        scopedBranchId,
        church,
        branches: database.branches,
      });

      if (!branchId) {
        return { error: "Select a valid branch for this event" as const, statusCode: 400 };
      }

      const event: ChurchEvent = {
        id: createId("event"),
        churchId,
        branchId,
        name: eventData.name.trim(),
        date: eventData.date,
        time: eventData.time,
        location: eventData.location.trim(),
        description: eventData.description?.trim() ?? "",
        type: eventData.type,
        maxAttendees: eventData.maxAttendees,
        status: "scheduled",
        registeredAttendees: 0,
      };

      database.events.push(event);
      return { data: event };
    });

    if ("error" in result) {
      res.status(result.statusCode).json({ success: false, error: result.error });
      return;
    }

    res.status(201).json({ success: true, data: result.data });
  } catch {
    res.status(500).json({ success: false, error: "Failed to create event" });
  }
};

export const handleMarkAttendance: RequestHandler = async (req: any, res) => {
  try {
    const churchId = requireChurchWorkspaceAccess(req, res);
    if (!churchId) {
      return;
    }
    const branchId = getBranchId(req);

    const { eventId, memberId, attended } = req.body as MarkAttendanceRequest;

    if (!eventId || !memberId) {
      res.status(400).json({ success: false, error: "Event and member are required" });
      return;
    }

    const result = await updateDatabase((database) => {
      const event = database.events.find(
        (candidate) =>
          candidate.churchId === churchId &&
          candidate.id === eventId &&
          (!branchId || candidate.branchId === branchId),
      );
      const member = database.members.find(
        (candidate) =>
          candidate.churchId === churchId &&
          candidate.id === memberId &&
          (!branchId || candidate.branchId === branchId),
      );

      if (!event || !member) {
        return { error: "Event or member not found" as const };
      }

      if (event.branchId && member.branchId && event.branchId !== member.branchId) {
        return { error: "Attendance must be recorded within the same branch" as const };
      }

      const existingRecord = database.attendance.find(
        (entry) => entry.eventId === eventId && entry.memberId === memberId,
      );

      const attendanceRecord: AttendanceRecord = existingRecord ?? {
        id: createId("attendance"),
        churchId,
        branchId: event.branchId ?? member.branchId,
        eventId,
        memberId,
        memberName: member.name,
        attended,
      };

      attendanceRecord.attended = attended;
      attendanceRecord.checkinTime = attended ? new Date().toISOString() : undefined;

      if (!existingRecord) {
        database.attendance.push(attendanceRecord);
      }

      event.registeredAttendees = database.attendance.filter(
        (entry) => entry.eventId === eventId && entry.attended,
      ).length;

      return { data: attendanceRecord };
    });

    if ("error" in result) {
      res.status(404).json({ success: false, error: result.error });
      return;
    }

    res.status(201).json({ success: true, data: result.data });
  } catch {
    res.status(500).json({ success: false, error: "Failed to mark attendance" });
  }
};

export const handleGetDashboardData: RequestHandler = async (req: any, res) => {
  try {
    const churchId = requireChurchWorkspaceAccess(req, res);
    if (!churchId) {
      return;
    }
    const branchId = getBranchId(req);

    const database = await readDatabase();
    const church = database.churches.find((candidate) => candidate.id === churchId);

    if (!church) {
      res.status(404).json({ success: false, error: "Church not found" });
      return;
    }

    const members = filterByBranchScope(database.members, churchId, branchId)
      .sort((left, right) => right.joinDate.localeCompare(left.joinDate));
    const donations = filterByBranchScope(database.donations, churchId, branchId)
      .sort((left, right) => right.date.localeCompare(left.date));
    const events = filterByBranchScope(database.events, churchId, branchId)
      .sort((left, right) => left.date.localeCompare(right.date));
    const attendance = filterByBranchScope(database.attendance, churchId, branchId);

    const today = new Date().toISOString().split("T")[0];
    const dashboardData: DashboardData = {
      church,
      recentMembers: members.slice(0, 4),
      recentDonations: donations.slice(0, 5),
      upcomingEvents: events.filter((event) => event.date >= today).slice(0, 5),
      weeklyAttendance: branchId
        ? calculateScopedWeeklyAttendance(events, attendance, church.weeklyAttendance)
        : church.weeklyAttendance,
      donationTrend: buildDonationTrend(donations),
      memberGrowth: buildMemberGrowth(members),
    };

    res.json({ success: true, data: dashboardData });
  } catch {
    res.status(500).json({ success: false, error: "Failed to get dashboard data" });
  }
};
