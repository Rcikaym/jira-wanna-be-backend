import { Hono } from "hono";
import { authMiddleware, type AppEnv } from "../../middleware/auth.middleware";
import { requireRole } from "../../middleware/rbac.middleware";
import {
  getProjectSummaryHandler,
  getTaskHandler,
  listProjectsHandler,
  listTasksHandler,
} from "./client.controller";

const clientRouter = new Hono<AppEnv>();

// Supported query examples for CLIENT_GUEST task list:
//
// Filter by status:
// GET /client/projects/:id/tasks?filters={"status":"DONE"}
//
// Search by title:
// GET /client/projects/:id/tasks?searchFilters={"title":"presentation"}
//
// Paginate:
// GET /client/projects/:id/tasks?page=1&rows=5
//
// Sort by creation date:
// GET /client/projects/:id/tasks?orderKey=createdAt&orderRule=desc
//
// Note: filters on internal fields (assigneeId, description, isClientVisible)
// are ignored at the DB layer because those columns are not in the select
clientRouter.use("*", authMiddleware);
clientRouter.use("*", requireRole("CLIENT_GUEST"));

clientRouter.get("/projects", listProjectsHandler);
clientRouter.get("/projects/:projectId/summary", getProjectSummaryHandler);
clientRouter.get("/projects/:projectId/tasks", listTasksHandler);
clientRouter.get("/projects/:projectId/tasks/:taskId", getTaskHandler);

clientRouter.all("*", (c) => {
  return c.json(
    { error: "Forbidden", reason: "Client accounts have read-only access" },
    403,
  );
});

export default clientRouter;
