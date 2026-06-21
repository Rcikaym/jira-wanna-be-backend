import type { Department, TaskStatus } from "@prisma/client";

export type InternalTaskView = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  isClientVisible: boolean;
  assignee: {
    id: string;
    name: string;
    avatarUrl: string | null;
    department: Department | null;
  } | null;
  project: { id: string; name: string };
  attachments: { id: string; fileName: string; fileUrl: string }[];
  createdAt: Date;
  updatedAt: Date;
};

export type ClientTaskView = {
  id: string;
  title: string;
  status: TaskStatus;
  project: { id: string; name: string };
  createdAt: Date;
  updatedAt: Date;
};

export function maskTaskForClient(task: InternalTaskView): ClientTaskView {
  return {
    id: task.id,
    title: task.title,
    status: task.status,
    project: task.project,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
}

export function maskTaskListForClient(
  tasks: InternalTaskView[],
): ClientTaskView[] {
  return tasks.filter((task) => task.isClientVisible).map(maskTaskForClient);
}
