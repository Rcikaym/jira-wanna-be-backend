import { z } from "zod";

export const CreateProjectDto = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
  clientId: z.string().uuid(),
});

export const UpdateProjectDto = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().max(500).optional(),
});

export type CreateProjectDtoType = z.infer<typeof CreateProjectDto>;
export type UpdateProjectDtoType = z.infer<typeof UpdateProjectDto>;
