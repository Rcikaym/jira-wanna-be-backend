import { Hono } from "hono";
import { requireTaskStatusTransitionAllowed } from "../../middleware/abac.middleware";
import type { AppEnv } from "../../middleware/auth.middleware";
import { requireRole } from "../../middleware/rbac.middleware";
import {
  addAttachmentHandler,
  addDependencyHandler,
  assignTaskHandler,
  createTaskHandler,
  deleteTaskHandler,
  getAttachmentsHandler,
  getDependenciesHandler,
  getTaskHandler,
  listTasksHandler,
  removeDependencyHandler,
  updateTaskFieldsHandler,
  updateTaskStatusHandler,
} from "./task.controller";

const taskRouter = new Hono<AppEnv>();

taskRouter.get("/", listTasksHandler);
taskRouter.post("/", requireRole("PM"), createTaskHandler);
taskRouter.get("/:taskId", getTaskHandler);
taskRouter.patch("/:taskId", requireRole("PM"), updateTaskFieldsHandler);
taskRouter.delete("/:taskId", requireRole("PM"), deleteTaskHandler);
taskRouter.patch(
  "/:taskId/status",
  requireRole("PM", "INTERNAL"),
  requireTaskStatusTransitionAllowed(),
  updateTaskStatusHandler,
);
taskRouter.post("/:taskId/assign", requireRole("PM"), assignTaskHandler);
taskRouter.get("/:taskId/dependencies", getDependenciesHandler);
taskRouter.post("/:taskId/dependencies", requireRole("PM"), addDependencyHandler);
taskRouter.delete(
  "/:taskId/dependencies/:dependsOnTaskId",
  requireRole("PM"),
  removeDependencyHandler,
);
taskRouter.get("/:taskId/attachments", getAttachmentsHandler);
taskRouter.post("/:taskId/attachments", requireRole("INTERNAL"), addAttachmentHandler);

export default taskRouter;
