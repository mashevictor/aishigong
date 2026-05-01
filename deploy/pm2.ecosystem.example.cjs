/**
 * PM2 示例：复制为 ecosystem.config.cjs 放到项目根或 server 旁，按需改 cwd / env_file。
 * 启动：pm2 start ecosystem.config.cjs --env production
 */

module.exports = {
  apps: [
    {
      name: "aishigong",
      cwd: "/var/www/aishigong/server",
      script: "index.js",
      instances: 1,
      exec_mode: "fork",
      max_memory_restart: "400M",
      env_production: {
        NODE_ENV: "production",
      },
      error_file: "/var/log/pm2/aishigong-error.log",
      out_file: "/var/log/pm2/aishigong-out.log",
      merge_logs: true,
      time: true,
    },
  ],
};
