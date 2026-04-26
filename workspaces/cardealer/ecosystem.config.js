module.exports = {
  apps: [
    {
      name: "cardealer",
      script: "node_modules/.bin/next",
      args: "start",
      watch: false,
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
    },
  ],
};
