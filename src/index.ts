import "dotenv/config";
import { Hono } from "hono";
import { cors } from "hono/cors";
import authRouter from "./modules/auth/auth.route";
import clientRouter from "./modules/client/client.route";
import projectRouter from "./modules/projects/project.route";
import userRouter from "./routes/user";

const app = new Hono();

app.use(
  "*",
  cors({
    origin: (origin) => origin,
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  })
);

app.route("/auth", authRouter);
app.route("/client", clientRouter);
app.route("/projects", projectRouter);
app.route("/users", userRouter);

const port = Number(process.env.PORT) || 4321; 

const server = Bun.serve({
  port,
  fetch: app.fetch,
});

console.log(`Listening on http://localhost:${server.port}`);
