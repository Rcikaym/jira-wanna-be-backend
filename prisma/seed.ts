import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

const password = "Password123!";

async function main() {
  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.auditLog.deleteMany();
  await prisma.taskDependency.deleteMany();
  await prisma.attachment.deleteMany();
  await prisma.task.deleteMany();
  await prisma.project.deleteMany();
  await prisma.user.deleteMany();

  const pmUser = await prisma.user.create({
    data: {
      name: "Andi Pratama",
      email: "pm@nodewave.dev",
      password: passwordHash,
      role: "PM",
      department: null,
    },
  });

  const uiUxUser = await prisma.user.create({
    data: {
      name: "Sari Dewi",
      email: "uiux@nodewave.dev",
      password: passwordHash,
      role: "INTERNAL",
      department: "UI_UX",
    },
  });

  const frontendUser = await prisma.user.create({
    data: {
      name: "Budi Santoso",
      email: "frontend@nodewave.dev",
      password: passwordHash,
      role: "INTERNAL",
      department: "FRONTEND",
    },
  });

  const backendUser = await prisma.user.create({
    data: {
      name: "Reza Firmansyah",
      email: "backend@nodewave.dev",
      password: passwordHash,
      role: "INTERNAL",
      department: "BACKEND",
    },
  });

  const clientUser = await prisma.user.create({
    data: {
      name: "PT Maju Bersama",
      email: "client@nodewave.dev",
      password: passwordHash,
      role: "CLIENT_GUEST",
      department: null,
    },
  });

  const project = await prisma.project.create({
    data: {
      name: "Redesign E-Commerce Platform",
      clientId: clientUser.id,
    },
  });

  const uiDesignTask = await prisma.task.create({
    data: {
      projectId: project.id,
      title: "UI Design",
      status: "DONE",
      assigneeId: uiUxUser.id,
      isClientVisible: false,
    },
  });

  const backendApiTask = await prisma.task.create({
    data: {
      projectId: project.id,
      title: "Backend API",
      status: "DONE",
      assigneeId: backendUser.id,
      isClientVisible: false,
    },
  });

  const frontendSlicingTask = await prisma.task.create({
    data: {
      projectId: project.id,
      title: "Frontend Slicing",
      status: "BLOCKED",
      assigneeId: frontendUser.id,
      isClientVisible: false,
    },
  });

  const qaTestingTask = await prisma.task.create({
    data: {
      projectId: project.id,
      title: "QA Testing",
      status: "BACKLOG",
      assigneeId: frontendUser.id,
      isClientVisible: true,
    },
  });

  await prisma.task.create({
    data: {
      projectId: project.id,
      title: "Client Presentation Prep",
      status: "BACKLOG",
      assigneeId: pmUser.id,
      isClientVisible: true,
    },
  });

  await prisma.taskDependency.createMany({
    data: [
      {
        taskId: frontendSlicingTask.id,
        dependsOnTaskId: uiDesignTask.id,
      },
      {
        taskId: frontendSlicingTask.id,
        dependsOnTaskId: backendApiTask.id,
      },
      {
        taskId: qaTestingTask.id,
        dependsOnTaskId: frontendSlicingTask.id,
      },
    ],
  });

  await prisma.auditLog.createMany({
    data: [
      {
        taskId: frontendSlicingTask.id,
        userId: pmUser.id,
        changedField: "status",
        oldValue: null,
        newValue: JSON.stringify("BACKLOG"),
      },
      {
        taskId: frontendSlicingTask.id,
        userId: pmUser.id,
        changedField: "assigneeId",
        oldValue: null,
        newValue: JSON.stringify(frontendUser.id),
      },
      {
        taskId: frontendSlicingTask.id,
        userId: pmUser.id,
        changedField: "status",
        oldValue: JSON.stringify("BACKLOG"),
        newValue: JSON.stringify("BLOCKED"),
      },
    ],
  });

  console.log("Seed data inserted.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
