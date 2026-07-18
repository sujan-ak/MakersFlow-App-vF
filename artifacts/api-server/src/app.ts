import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { rateLimit } from "./middlewares/rateLimit";
import { logger } from "./lib/logger";

const app: Express = express();

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
app.use(cors());
// Keep the raw body so the Razorpay webhook can verify its HMAC signature
app.use(
  express.json({
    verify: (req, _res, buf) => {
      (req as any).rawBody = buf;
    },
  }),
);
app.use(express.urlencoded({ extended: true }));
const rateLimitWindowMs = Number(process.env.RATE_LIMIT_WINDOW_MS) || 60_000;
const rateLimitMax = Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 120;
app.use(rateLimit({ windowMs: rateLimitWindowMs, max: rateLimitMax }));

app.use("/api", router);

export default app;
