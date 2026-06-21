import { Hono } from "hono";
import {
  loginHandler,
  logoutHandler,
  registerHandler,
} from "./auth.controller";

const authRouter = new Hono();

authRouter.post("/register", registerHandler);
authRouter.post("/login", loginHandler);
authRouter.post("/logout", logoutHandler);

export default authRouter;
