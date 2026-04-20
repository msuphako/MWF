import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

const removeHeaders = (proxyReq) => {
  proxyReq.removeHeader("origin");
  proxyReq.removeHeader("referer");
};

app.use(
  "/api/anthropic",
  createProxyMiddleware({
    target: "https://api.anthropic.com",
    changeOrigin: true,
    pathRewrite: { "^/api/anthropic": "" },
    on: { proxyReq: removeHeaders },
  })
);

app.use(
  "/api/openai",
  createProxyMiddleware({
    target: "https://api.openai.com",
    changeOrigin: true,
    pathRewrite: { "^/api/openai": "" },
    on: { proxyReq: removeHeaders },
  })
);

app.use(express.static(join(__dirname, "dist")));

app.get("*", (_req, res) => {
  res.sendFile(join(__dirname, "dist", "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Running at http://0.0.0.0:${PORT}`);
});
