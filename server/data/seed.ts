import type { DivineDeskDatabase, StoredUser } from "./database.js";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const shiftDays = (days: number) => new Date(Date.now() + days * ONE_DAY_MS);

const toIsoDateTime = (days: number) => shiftDays(days).toISOString();

function createUsers(): StoredUser[] {
  return [
    {
      id: "user-super-admin-001",
      name: "System Administrator",
      email: "superadmin@divinedesk.com",
      password: "admin123",
      role: "super_admin",
      churchId: null,
      status: "active",
      createdAt: toIsoDateTime(-30),
      lastLoginAt: toIsoDateTime(-1),
    },
  ];
}

export function createSeedDatabase(): DivineDeskDatabase {
  return {
    meta: {
      version: 1,
      createdAt: toIsoDateTime(-1),
      lastUpdated: toIsoDateTime(-1),
    },
    churches: [],
    branches: [],
    users: createUsers(),
    members: [],
    donations: [],
    events: [],
    attendance: [],
    subscriptionPayments: [],
  };
}
