import { Hono } from "hono";
import { authMiddleware, type AppEnv } from "../../middleware/auth.middleware";
import { requireRole } from "../../middleware/rbac.middleware";
import { getAuditLogHandler } from "./audit.controller";

const auditRouter = new Hono<AppEnv>();

// Audit log is append-only and immutable.
// No write endpoints are exposed — writes happen only via writeAuditLog() in src/lib/audit.ts
//
// Supported query examples:
//
// Filter by who made the change:
// GET /projects/:id/audit-log?filters={"userId":"<uuid>"}
//
// Filter by which field changed:
// GET /projects/:id/audit-log?filters={"changedField":"status"}
//
// Filter by a specific task:
// GET /projects/:id/audit-log?filters={"taskId":"<uuid>"}
//
// Search across changedField values:
// GET /projects/:id/audit-log?searchFilters={"changedField":"status"}
//
// Date range (entries from a specific day):
// GET /projects/:id/audit-log?rangedFilters=[{"key":"createdAt","start":"2024-01-01T00:00:00Z","end":"2024-01-01T23:59:59Z"}]
//
// Paginate and sort newest first:
// GET /projects/:id/audit-log?page=1&rows=20&orderKey=createdAt&orderRule=desc
auditRouter.use("*", authMiddleware);
auditRouter.get("/", requireRole("PM"), getAuditLogHandler);

export default auditRouter;
