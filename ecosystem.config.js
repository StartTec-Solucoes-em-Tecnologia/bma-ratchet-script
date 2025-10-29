module.exports = {
  apps: [
    {
      name: 'facial-worker',
      script: 'src/worker.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      error_file: './logs/worker-error.log',
      out_file: './logs/worker-out.log',
      log_file: './logs/worker-combined.log',
      time: true
    },
  ]
};
