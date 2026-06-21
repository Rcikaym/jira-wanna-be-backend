import type { Context } from "hono";
import { LoginDto, RegisterDto } from "./auth.dto";
import {
  AppError,
  login,
  logout,
  register,
} from "./auth.service";

function handleError(error: unknown, c: Context): Response {
  if (error instanceof AppError) {
    return c.json({ error: error.message }, error.statusCode);
  }

  console.error(error);
  return c.json({ error: "Internal server error" }, 500);
}

export async function registerHandler(c: Context): Promise<Response> {
  try {
    const body: unknown = await c.req.json();
    const parsed = RegisterDto.safeParse(body);

    if (!parsed.success) {
      return c.json(
        {
          error: "Validation error",
          details: parsed.error.flatten(),
        },
        400,
      );
    }

    const user = await register(parsed.data);

    return c.json(
      {
        message: "Account created successfully",
        data: user,
      },
      201,
    );
  } catch (error) {
    return handleError(error, c);
  }
}

export async function loginHandler(c: Context): Promise<Response> {
  try {
    const body: unknown = await c.req.json();
    const parsed = LoginDto.safeParse(body);

    if (!parsed.success) {
      return c.json(
        {
          error: "Validation error",
          details: parsed.error.flatten(),
        },
        400,
      );
    }

    const data = await login(parsed.data);

    return c.json({
      message: "Login successful",
      data,
    });
  } catch (error) {
    return handleError(error, c);
  }
}

export function logoutHandler(c: Context): Response {
  return c.json(logout());
}
