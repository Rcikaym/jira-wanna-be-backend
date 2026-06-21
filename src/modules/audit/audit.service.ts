import type { Department, Role } from "@prisma/client";
import { AppError } from "../../lib/errors";
import type { EzFilterParams } from "../../lib/ezfilter";
import prisma from "../../lib/prisma";
import { auditRepository } from "./audit.repository";

type UserContext = {
  id: string;
  role: Role;
  department: Department | null;
};

export async function getAuditLog(
  projectId: string,
  params: EzFilterParams,
  user: UserContext,
) {
  if (user.role !== "PM") throw new AppError(403, "Forbidden");

  const project = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    select: { id: true },
  });
  if (!project) throw new AppError(404, "Project not found");

  return auditRepository.findByProject(projectId, params);
}
