// ecosystem.config.js
// PM2 configuration for production deployment

module.exports = {
  apps: [
    {
      name: 'fee-aware-moonshot-bot',
      script: './dist/index.js',
      instances: 1,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        ENABLE_LIVE_TRADING: 'false'
      },
      env_production: {
        NODE_ENV: 'production'
      },
      
      // Auto-restart configuration
      watch: false,
      max_memory_restart: '500M',
      
      // Logging
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_file: './logs/pm2.log',
      time_format: 'YYYY-MM-DD HH:mm:ss Z',
      
      // Graceful shutdown
      kill_timeout: 10000,
      wait_ready: true,
      listen_timeout: 3000,
      shutdown_with_message: true,
      
      // Monitoring and auto-restart
      max_restarts: 10,
      min_uptime: '10s',
      autorestart: true,
      
      // Process limits
      max_old_space_size: 1024,
      node_args: '--max-old-space-size=1024',
    }
  ],
  
  // Cluster configuration
  deploy: {
    production: {
      user: 'ubuntu',
      host: 'your-vps-ip.com',
      ref: 'origin/main',
      repo: 'https://github.com/bradleyhall8601-web/fee-aware-moonshot-bot.git',
      path: '/home/ubuntu/fee-aware-moonshot-bot',
      'post-deploy': 'npm install && npm run build && pm2 restart ecosystem.config.js --env production',
      'pre-deploy-local': 'echo "Deploying to production"'
    }
  }
};
