import { createMiddleware } from "hono/factory";
import { getAuth } from "@hono/clerk-auth";

export const requireAuth = createMiddleware<{
  Variables: { userId: string };
}>(async (c, next) => {
  const auth = getAuth(c);
  if (!auth?.userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  c.set("userId", auth.userId);
  await next();
});
