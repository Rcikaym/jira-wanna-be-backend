import prisma from "./prisma";
import type { Prisma } from "@prisma/client";

type AuditParams = {
  taskId: string;
  userId: string;
  changedField: string;
  oldValue: unknown;
  newValue: unknown;
};

function serializeAuditValue(value: unknown): string | null {
  return value === undefined || value === null ? null : JSON.stringify(value);
}

export async function writeAuditLog(
  params: AuditParams,
  client: Pick<Prisma.TransactionClient, "auditLog"> = prisma,
): Promise<void> {
  const payload = {
    taskId: params.taskId,
    userId: params.userId,
    changedField: params.changedField,
    oldValue: serializeAuditValue(params.oldValue),
    newValue: serializeAuditValue(params.newValue),
  };

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      await client.auditLog.create({ data: payload });
      return;
    } catch (error) {
      if (attempt === 2) {
        console.error(
          "[AuditLog] Failed to write audit log after 2 attempts:",
          error,
          payload,
        );
      }
    }
  }
}
