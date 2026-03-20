CREATE TYPE "UserRole" AS ENUM ('super_admin', 'admin', 'branch_admin', 'staff', 'member');

CREATE TYPE "UserStatus" AS ENUM ('active', 'inactive', 'suspended');

CREATE TABLE "users" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "password" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "role" "UserRole" NOT NULL DEFAULT 'admin',
  "churchId" TEXT,
  "branchId" TEXT,
  "status" "UserStatus" NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastLoginAt" TIMESTAMP(3),

  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
