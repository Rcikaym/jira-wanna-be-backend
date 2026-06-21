import type { Department, Role } from "@prisma/client";
import { AppError } from "../../lib/errors";
import type { EzFilterParams } from "../../lib/ezfilter";
import { projectRepository } from "./project.repository";
import type { CreateProjectDtoType, UpdateProjectDtoType } from "./project.dto";

type UserContext = {
  id: string;
  role: Role;
  department: Department | null;
};

export async function createProject(dto: CreateProjectDtoType, userId: string) {
  void userId;
  const client = await projectRepository.findClientUser(dto.clientId);
  if (!client) {
    throw new AppError(400, "clientId must refer to a CLIENT_GUEST user");
  }

  return projectRepository.create(dto);
}

export function listProjects(params: EzFilterParams, user: UserContext) {
  if (user.role === "PM") {
    return projectRepository.findAll(params, { deletedAt: null });
  }

  if (user.role === "INTERNAL") {
    return projectRepository.findAll(params, {
      deletedAt: null,
      tasks: { some: { assigneeId: user.id, deletedAt: null } },
    });
  }

  return projectRepository.findAll(params, { deletedAt: null, clientId: user.id });
}

export async function getProject(projectId: string, user: UserContext) {
  const project = await projectRepository.findById(projectId);
  if (!project) throw new AppError(404, "Project not found");
  if (user.role === "CLIENT_GUEST" && project.clientId !== user.id) {
    throw new AppError(403, "Access denied");
  }

  return project;
}

export async function updateProject(
  projectId: string,
  dto: UpdateProjectDtoType,
  userId: string,
) {
  void userId;
  const project = await projectRepository.findById(projectId);
  if (!project) throw new AppError(404, "Project not found");
  return projectRepository.update(projectId, dto);
}

export async function deleteProject(projectId: string) {
  const project = await projectRepository.findById(projectId);
  if (!project) throw new AppError(404, "Project not found");
  return projectRepository.softDelete(projectId);
}

export async function getProjectSummary(projectId: string) {
  const project = await projectRepository.findById(projectId);
  if (!project) throw new AppError(404, "Project not found");

  const summary = await projectRepository.getSummary(projectId);
  const percentComplete = summary.total
    ? Math.round((summary.done / summary.total) * 100)
    : 0;

  return {
    total: summary.total,
    percentComplete,
    byStatus: {
      DONE: summary.done,
      IN_PROGRESS: summary.inProgress,
      BLOCKED: summary.blocked,
      BACKLOG: summary.backlog,
    },
  };
}
