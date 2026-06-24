# Project Management API

> Backend service for a collaborative project & task management system built as a Fullstack Engineer technical assessment for NodeWave.

[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Bun](https://img.shields.io/badge/Runtime-Bun-fbf0df?logo=bun)](https://bun.sh/)
[![Hono](https://img.shields.io/badge/Framework-Hono-E36002)](https://hono.dev/)
[![Prisma](https://img.shields.io/badge/ORM-Prisma-2D3748?logo=prisma)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL-4169E1?logo=postgresql)](https://www.postgresql.org/)

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Database Setup](#database-setup)
- [API Reference](#api-reference)
- [Seeded Accounts](#seeded-accounts)
- [Deployment](#deployment)

---

## Overview

This API is the operational backbone for managing deliverables of high-value projects. It supports the collaborative workflow of a medium-to-large team spanning multiple disciplines (Product Management, UI/UX, Frontend, and Backend), while also serving controlled data visibility to the Client side.

The core challenges addressed in this system:

- **State-Based Permissions (ABAC)** - permissions that change dynamically based on task status
- **Inter-Task Dependencies** - a task cannot be started unless all prerequisite tasks are `Done`
- **Concurrency Conflict Prevention** - Optimistic Locking with `409 Conflict` responses to prevent race conditions
- **Immutable Audit Trail** - every field-level change is recorded permanently

---

## Tech Stack

| Layer | Technology |
|---|---|
| Language | TypeScript (strict) |
| Runtime | Bun |
| HTTP Framework | Hono |
| ORM | Prisma |
| Database | PostgreSQL |
| Auth | JWT (`jsonwebtoken`) |
| Filtering & Pagination | `@nodewave/prisma-ezfilter` |
| Validation | Zod + entity DTOs |

---

## Architecture

### RBAC + ABAC (Role & Attribute-Based Access Control)

Access is determined by three axes simultaneously:

| Factor | Description |
|---|---|
| **Role** | Who the user is (PM, Internal Team, Client Guest) |
| **Department** | Which team they belong to (UI/UX, Frontend, Backend) |
| **Task State** | What the current status of the task is |

**Role 1 - Product Manager (PM)**
- Full read/write access to all projects and tasks
- Can define task dependencies
- *Cannot* move a task from `In Progress` → `Done` (only the assigned engineer can)

**Role 2 - Internal Team (UI/UX, Frontend, Backend)**
- Can only view tasks on projects assigned to their department
- Can only move a task to `In Progress` if all its dependencies are `Done` - validated at the **API level**, not just the UI
- Cannot modify task descriptions; can only upload attachments and change task status

**Role 3 - Client Guest (Multi-Tenant Isolation)**
- Absolute data isolation: can only see their own project's aggregate metrics
- Can only see tasks explicitly flagged `client_visible = true` by the PM
- **Data Masking enforced at the API layer**: all internal identities (engineer names, avatars, departments) and internal comments are stripped from the response - not hidden via CSS

---

### Dependency-Aware Task State Machine

Tasks follow a strict state machine enforced on the backend:

```
Blocked ──(deps resolved)──► To Do ──(assigned)──► In Progress ──(engineer only)──► Done
   ▲                                                      │
   └──────────────(dependency becomes un-done)────────────┘
```

When all prerequisite tasks reach `Done`, the system automatically unblocks dependent tasks. Conversely, if a prerequisite is reverted, downstream tasks are re-blocked.

---

### Concurrency & Optimistic Locking

Every `Task` record carries a `version` field (integer). On any update:

1. The client sends the current `version` it knows about
2. The backend checks `WHERE id = ? AND version = ?`
3. If another actor already incremented `version`, the update fails with `409 Conflict`
4. The client must re-fetch and retry with the latest data

This prevents silent data overwrites when a PM edits a description at the same moment an engineer changes the task status.

---

### Immutable Audit Trail

Every field-level change to any `Task` is recorded in a separate `TaskLog` table. Logs are **never deleted**.

```
TaskLog {
  id          UUID
  taskId      UUID
  userId      UUID
  timestamp   DateTime
  column      String     // e.g. "status", "description", "assigneeId"
  oldValue    String
  newValue    String
}
```

Soft deletes are mandatory across all entities - no record is ever permanently removed from the database.

---

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) `>= 1.0`
- PostgreSQL `>= 15`

### Installation

```bash
# Clone the repository
git clone https://github.com/Rcikaym/jira-wanna-be-backend
cd jira-wanna-be-backend

# Install dependencies
bun install
```

---

## Environment Variables

Create a `.env` file in the root directory:

```env
# Database
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public"

# JWT
JWT_SECRET="your-super-secret-key"
JWT_EXPIRES_IN="7d"

# App
PORT=3001
NODE_ENV=development
```

---

## Database Setup

```bash
# Run migrations
bunx prisma migrate dev

# Seed the database with initial roles, departments, and accounts
bunx prisma db seed

# (Optional) Open Prisma Studio
bunx prisma studio
```

---

## API Reference

### Authentication

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `POST` | `/api/auth/register` | Register a new user | ❌ |
| `POST` | `/api/auth/login` | Login and receive JWT | ❌ |
| `POST` | `/api/auth/logout` | Invalidate session | ✅ |

### Projects

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `GET` | `/api/projects` | List all projects (filtered by role) | ✅ |
| `POST` | `/api/projects` | Create a new project | ✅ PM only |
| `GET` | `/api/projects/:id` | Get project details | ✅ |
| `PATCH` | `/api/projects/:id` | Update project | ✅ PM only |
| `DELETE` | `/api/projects/:id` | Soft delete project | ✅ PM only |

### Tasks

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `GET` | `/api/projects/:id/tasks` | List tasks (role-filtered) | ✅ |
| `POST` | `/api/projects/:id/tasks` | Create a task | ✅ PM only |
| `GET` | `/api/tasks/:id` | Get task detail | ✅ |
| `PATCH` | `/api/tasks/:id` | Update task (state-aware) | ✅ |
| `PATCH` | `/api/tasks/:id/status` | Change task status (ABAC enforced) | ✅ |
| `DELETE` | `/api/tasks/:id` | Soft delete task | ✅ PM only |

### Dependencies

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `POST` | `/api/tasks/:id/dependencies` | Add a task dependency | ✅ PM only |
| `DELETE` | `/api/tasks/:id/dependencies/:depId` | Remove a dependency | ✅ PM only |

### Audit Trail

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `GET` | `/api/tasks/:id/logs` | Get audit log for a task | ✅ PM only |
| `GET` | `/api/projects/:id/standup` | Daily standup summary (bonus) | ✅ PM only |

> All list endpoints support filtering, pagination, and searching via `@nodewave/prisma-ezfilter`. Refer to the [NodeWave Filtering Standard]

---

## Seeded Accounts

After running `bunx prisma db seed`, the following accounts are available:

| Role | Email | Password | Department |
|---|---|---|---|
| Product Manager | `pm@nodewave.id` | `password123` | - |
| Internal - UI/UX | `uiux@nodewave.id` | `password123` | UI/UX |
| Internal - Frontend | `frontend@nodewave.id` | `password123` | Frontend |
| Internal - Backend | `backend@nodewave.id` | `password123` | Backend |
| Client Guest | `client@nodewave.id` | `password123` | - |

---

## Deployment

Deployed on [Railway](https://railway.app/) with a managed PostgreSQL instance. Prisma migrations and seeds are applied on each deploy via the start command:

```bash
bunx prisma migrate deploy && bunx prisma db seed && bun run start
```

---

## Commit Convention

This project follows [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add task dependency resolution logic
fix: prevent PM from completing task directly
chore: update prisma schema for soft deletes
refactor: extract ABAC middleware to separate layer
```

Enforced via **Commitlint** + **Husky** pre-commit hooks.
