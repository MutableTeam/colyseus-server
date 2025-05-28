module.exports = {
  apps: [
    {
      name: "colyseus-server",
      script: "lib/index.js",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
}
