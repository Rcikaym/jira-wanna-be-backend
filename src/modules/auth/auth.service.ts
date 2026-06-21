import { Prisma } from "@prisma/client";
import prisma from "../../lib/prisma";
import { comparePassword, hashPassword } from "../../lib/hash";
import { signToken } from "../../lib/jwt";
import type { LoginDtoType, RegisterDtoType } from "./auth.dto";

type AppErrorStatusCode = 400 | 401 | 409 | 500;

const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  department: true,
} satisfies Prisma.UserSelect;

export class AppError extends Error {
  constructor(
    public statusCode: AppErrorStatusCode,
    message: string,
  ) {
    super(message);
  }
}

export async function register(dto: RegisterDtoType) {
  const existingUser = await prisma.user.findFirst({
    where: {
      email: dto.email,
      deletedAt: null,
    },
    select: {
      id: true,
    },
  });

  if (existingUser) {
    throw new AppError(409, "Email already in use");
  }

  if ((dto.role === "PM" || dto.role === "CLIENT_GUEST") && dto.department) {
    throw new AppError(400, "Department must be null for this role");
  }

  if (dto.role === "INTERNAL" && !dto.department) {
    throw new AppError(400, "Department is required for INTERNAL users");
  }

  const password = await hashPassword(dto.password);

  try {
    return await prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        password,
        role: dto.role,
        department: dto.role === "INTERNAL" ? dto.department : null,
      },
      select: publicUserSelect,
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new AppError(409, "Email already in use");
    }

    throw error;
  }
}

export async function login(dto: LoginDtoType) {
  const user = await prisma.user.findFirst({
    where: {
      email: dto.email,
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
      email: true,
      password: true,
      role: true,
      department: true,
    },
  });

  if (!user) {
    throw new AppError(401, "Invalid credentials");
  }

  const passwordMatches = await comparePassword(dto.password, user.password);

  if (!passwordMatches) {
    throw new AppError(401, "Invalid credentials");
  }

  const token = signToken({
    sub: user.id,
    email: user.email,
    role: user.role,
    department: user.department,
  });

  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
    },
  };
}

export function logout() {
  return {
    message: "Logged out successfully",
  };
}
