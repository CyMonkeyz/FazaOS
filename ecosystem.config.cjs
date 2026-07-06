module.exports = {
  apps: [
    {
      name: "faza-os",
      script: ".output/server/index.mjs",
      interpreter: "node",
      env: {
        NODE_ENV: "production",
        HOST: "127.0.0.1",
        PORT: "3000",
      },
      max_memory_restart: "512M",
      exp_backoff_restart_delay: 1000,
    },
  ],
};
