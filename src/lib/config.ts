export const config = {
  env: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
};
