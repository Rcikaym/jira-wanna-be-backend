import { Hono } from "hono";
import {
  requireClientOwnsProject,
  requireProjectMembership,
} from "../../middleware/abac.middleware";
import { authMiddleware, type AppEnv } from "../../middleware/auth.middleware";
import { requireRole } from "../../middleware/rbac.middleware";
import auditRouter from "../audit/audit.route";
import taskRouter from "../tasks/task.route";
import {
  createProjectHandler,
  deleteProjectHandler,
  getProjectHandler,
  getProjectSummaryHandler,
  listProjectsHandler,
  updateProjectHandler,
} from "./project.controller";

const projectRouter = new Hono<AppEnv>();

projectRouter.use("*", authMiddleware);

// CLIENT_GUEST must use /client routes, never /projects.
projectRouter.use("*", async (c, next) => {
  const user = c.get("user");
  if (user?.role === "CLIENT_GUEST") {
    return c.json(
      { error: "Forbidden", reason: "Client accounts must use the /client API" },
      403,
    );
  }
  await next();
});

projectRouter.get("/", listProjectsHandler);
projectRouter.post("/", requireRole("PM"), createProjectHandler);
projectRouter.route("/:projectId/audit-log", auditRouter);
projectRouter.get(
  "/:projectId",
  requireProjectMembership(),
  requireClientOwnsProject(),
  getProjectHandler,
);
projectRouter.patch("/:projectId", requireRole("PM"), updateProjectHandler);
projectRouter.delete("/:projectId", requireRole("PM"), deleteProjectHandler);
projectRouter.get(
  "/:projectId/summary",
  requireProjectMembership(),
  requireClientOwnsProject(),
  getProjectSummaryHandler,
);
projectRouter.use(
  "/:projectId/tasks/*",
  requireClientOwnsProject(),
  requireProjectMembership(),
);
projectRouter.use(
  "/:projectId/tasks",
  requireClientOwnsProject(),
  requireProjectMembership(),
);
projectRouter.route("/:projectId/tasks", taskRouter);

export default projectRouter;
