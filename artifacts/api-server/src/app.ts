import express, { type Express } from "express";
import cors from "cors";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { errorHandler } from "./lib/http";

const app: Express = express();

const sessionSecret = process.env["SESSION_SECRET"];
if (!sessionSecret) {
  throw new Error("SESSION_SECRET environment variable is required.");
}

const PostgresStore = connectPgSimple(session);

if (process.env["NODE_ENV"] === "production") {
  app.set("trust proxy", 1);
}

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
const configuredOrigins = (process.env["CORS_ORIGIN"] ?? process.env["APP_ORIGIN"] ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Same-origin browser requests do not include an Origin header.
    if (!origin || configuredOrigins.includes(origin) || (process.env["NODE_ENV"] !== "production" && configuredOrigins.length === 0)) {
      callback(null, true);
      return;
    }
    callback(new Error("Origin is not allowed."));
  },
  credentials: true,
}));
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Cross-Origin-Resource-Policy", "same-site");
  res.setHeader("Cache-Control", "no-store");
  if (process.env["NODE_ENV"] === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
});
app.use(express.json({ limit: "4mb", type: ["application/json", "application/*+json"] }));
app.use(express.urlencoded({ extended: false, limit: "256kb" }));
app.use((req, res, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  const origin = req.get("origin");
  if (!origin) return next();
  if (configuredOrigins.includes(origin) || (process.env["NODE_ENV"] !== "production" && configuredOrigins.length === 0)) {
    return next();
  }
  return res.status(403).json({ error: "Request origin is not allowed.", code: "ORIGIN_NOT_ALLOWED" });
});
app.use(
  session({
    store: new PostgresStore({
      conString: process.env["DATABASE_URL"],
      createTableIfMissing: true,
    }),
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    name: "mobilinq.sid",
    cookie: {
      httpOnly: true,
      secure: process.env["SESSION_COOKIE_SECURE"] === "true" || process.env["NODE_ENV"] === "production",
      sameSite: (process.env["SESSION_COOKIE_SAMESITE"] as "lax" | "strict" | "none" | undefined) ?? "lax",
      maxAge: Number(process.env["SESSION_MAX_AGE_MS"] ?? 1000 * 60 * 60 * 24 * 7),
    },
  }),
);

app.use("/api", router);
app.use(errorHandler);

export default app;
