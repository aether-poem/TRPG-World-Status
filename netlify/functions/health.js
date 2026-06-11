export default async () => Response.json({
  status: "ok",
  deployment: "netlify",
  coref_model: {
    status: "unavailable",
    load_seconds: null,
    error: "SpanBERT is available only in the local backend. Netlify uses direct DeepSeek generation.",
  },
});

export const config = {
  path: "/api/health",
};
