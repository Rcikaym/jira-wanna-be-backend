import "dotenv/config";
import { Hono } from "hono";
import { cors } from "hono/cors";
import authRouter from "./modules/auth/auth.route";
import clientRouter from "./modules/client/client.route";
import projectRouter from "./modules/projects/project.route";

const app = new Hono();

app.use(
  "*",
  cors({
    origin: ["http://localhost:3001"],
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  })
);

app.route("/auth", authRouter);
app.route("/client", clientRouter);
app.route("/projects", projectRouter);
const server = Bun.serve({
  port: 4321,
  fetch: app.fetch,
});

console.log(`Listening on http://localhost:${server.port}`);
