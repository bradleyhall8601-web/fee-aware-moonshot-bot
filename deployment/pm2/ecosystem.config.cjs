// PM2 Ecosystem Configuration
// Manages application processes for 24/7 uptime

module.exports = {
  apps: [
    {
      // Application name
      name: 'fee-aware-moonshot-bot',
      script: 'dist/index.js',
      
      // Execution
      instances: 1,
      exec_mode: 'fork',
      
      // Restart policy
      max_memory_restart: '500M',
      
      // Graceful shutdown
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 3000,
      
      // Environment
      env: {
        NODE_ENV: 'production',
        LOG_LEVEL: 'info'
      },
      
      // Error handling
      error_file: 'logs/err.log',
      out_file: 'logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      
      // Monitoring
      max_restarts: 10,
      min_uptime: '60s',
      
      // Clustering
      instance_var: 'INSTANCE_ID'
    }
  ],

  // Deployment configuration
  deploy: {
    production: {
      user: 'ubuntu',
      host: 'YOUR_VPS_IP',
      key: '~/.ssh/id_rsa',
      ref: 'origin/main',
      repo: 'git@github.com:bradleyhall8601-web/fee-aware-moonshot-bot.git',
      path: '/var/www/moonshot-bot',
      'post-deploy': 'npm install && npm run build && pm2 stop ecosystem.config.cjs && pm2 start ecosystem.config.cjs'
    }
  }
};
