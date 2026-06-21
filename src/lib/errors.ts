type AppErrorStatusCode = 400 | 401 | 403 | 404 | 409 | 500;

export class AppError extends Error {
  constructor(
    public statusCode: AppErrorStatusCode,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}
