import { z } from "zod";

export const RegisterDto = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(["PM", "INTERNAL", "CLIENT_GUEST"]),
  department: z.enum(["UI_UX", "FRONTEND", "BACKEND"]).nullable().optional(),
});

export const LoginDto = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type RegisterDtoType = z.infer<typeof RegisterDto>;
export type LoginDtoType = z.infer<typeof LoginDto>;
