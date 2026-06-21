import { z } from "zod";

export const CreateTaskDto = z.object({
  title: z.string().min(2).max(200),
  description: z.string().max(2000).optional(),
  assigneeId: z.string().uuid().optional(),
  isClientVisible: z.boolean().default(false),
});

export const UpdateTaskFieldsDto = z.object({
  title: z.string().min(2).max(200).optional(),
  description: z.string().max(2000).optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  isClientVisible: z.boolean().optional(),
  version: z.number().int().min(1),
});

export const UpdateTaskStatusDto = z.object({
  status: z.enum(["BACKLOG", "IN_PROGRESS", "DONE", "BLOCKED"]),
  version: z.number().int().min(1),
});

export const AddDependencyDto = z.object({
  dependsOnTaskId: z.string().uuid(),
});

export const AddAttachmentDto = z.object({
  fileName: z.string().min(1),
  fileUrl: z.string().url(),
});

export const AssignTaskDto = z.object({
  assigneeId: z.string().uuid().nullable(),
});

export type CreateTaskDtoType = z.infer<typeof CreateTaskDto>;
export type UpdateTaskFieldsDtoType = z.infer<typeof UpdateTaskFieldsDto>;
export type UpdateTaskStatusDtoType = z.infer<typeof UpdateTaskStatusDto>;
export type AddDependencyDtoType = z.infer<typeof AddDependencyDto>;
export type AddAttachmentDtoType = z.infer<typeof AddAttachmentDto>;
export type AssignTaskDtoType = z.infer<typeof AssignTaskDto>;
