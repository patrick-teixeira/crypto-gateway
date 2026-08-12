import "dotenv/config";
import express from "express";
import { authRouter } from "./api/routes/auth.js";
import { paymentRouter } from "./api/routes/payment.js";

const app = express();

app.use(express.json());
app.get("/health", (_req, res) => res.status(200).json({ status: "ok" }));

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type,Authorization");
  res.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  return next();
});

app.use(authRouter);
app.use(paymentRouter);

const PORT = Number(process.env.PORT ?? 8021);
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Node API running on http://0.0.0.0:${PORT}`);
});
