module.exports = {
  apps: [
    {
      name: 'cargar-crm-api',
      script: 'src/server.js',
      instances: 'max', // Utiliza todos los núcleos del CPU disponibles
      exec_mode: 'cluster', // Modo cluster para escalabilidad
      watch: false,
      max_memory_restart: '1G', // Prevenir fugas de memoria
      env: {
        NODE_ENV: 'development',
      },
      env_production: {
        NODE_ENV: 'production',
      },
      log_date_format: 'YYYY-MM-DD HH:mm Z',
      error_file: 'logs/err.log',
      out_file: 'logs/out.log',
      merge_logs: true
    }
  ]
};
