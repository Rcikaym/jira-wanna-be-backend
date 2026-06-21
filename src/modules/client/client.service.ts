import type { Department, Role } from "@prisma/client";
import { AppError } from "../../lib/errors";
import type { EzFilterParams } from "../../lib/ezfilter";
import { maskTaskListForClient } from "../../lib/mask";
import {
  clientRepository,
  type ClientTask,
} from "./client.repository";

type UserContext = {
  id: string;
  role: Role;
  department: Department | null;
};

function assertClientGuest(user: UserContext): void {
  if (user.role !== "CLIENT_GUEST") throw new AppError(403, "Forbidden");
}

function maskClientTasks(tasks: ClientTask[]): ClientTask[] {
  return maskTaskListForClient(
    tasks.map(toMaskableClientTask),
  );
}

function toMaskableClientTask(task: ClientTask) {
  return {
    ...task,
    description: null,
    isClientVisible: true,
    assignee: null,
    attachments: [],
  };
}

// ISOLATION CONTRACT
//
// 1. CLIENT_GUEST A cannot see CLIENT_GUEST B's projects
//    GET /client/projects returns only projects where clientId === authenticated user id
//
// 2. CLIENT_GUEST A cannot access CLIENT_GUEST B's project by guessing the projectId
//    GET /client/projects/:projectId/summary returns 404 if clientId does not match
//    The 404 does not reveal whether the project exists — same response for "not found" and "wrong client"
//
// 3. CLIENT_GUEST cannot see internal-only tasks
//    GET /client/projects/:projectId/tasks returns only tasks where isClientVisible === true
//    Tasks with isClientVisible === false are absent from the response — not masked, not nulled, absent
//
// 4. CLIENT_GUEST cannot see engineer names, avatars, or departments
//    These fields are never selected from the DB — they cannot leak via serialization bugs
//
// 5. CLIENT_GUEST cannot see task descriptions or attachments
//    Same as above — never fetched, structurally absent
//
// 6. A valid JWT with role CLIENT_GUEST hitting any /projects/* route returns 403
//    The guard in project.route.ts prevents any fallthrough
//
// 7. percentComplete rounds to nearest integer — 1 out of 3 tasks done = 33, not 33.333...
export const clientService = {
  async listProjects(user: UserContext) {
    assertClientGuest(user);
    return clientRepository.findProjects(user.id);
  },

  async getProjectSummary(projectId: string, user: UserContext) {
    assertClientGuest(user);
    return clientRepository.getProjectSummary(projectId, user.id);
  },

  async listTasks(projectId: string, params: EzFilterParams, user: UserContext) {
    assertClientGuest(user);
    const result = await clientRepository.findClientVisibleTasks(
      projectId,
      user.id,
      params,
    );

    return {
      ...result,
      data: maskClientTasks(result.data),
    };
  },

  async getTask(projectId: string, taskId: string, user: UserContext) {
    assertClientGuest(user);
    const task = await clientRepository.findClientVisibleTaskById(
      taskId,
      projectId,
      user.id,
    );

    if (!task) throw new AppError(404, "Task not found");
    return task;
  },
};
