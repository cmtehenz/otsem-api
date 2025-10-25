// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: "otsem-api",
      script: "dist/main.js",
      cwd: "/var/www/otsem-api",
      instances: 1,            // pode aumentar depois
      exec_mode: "fork",       // "cluster" quando estiver estável
      env: {
        NODE_ENV: "production",
        PORT: 3333
      }
    }
  ]
};
