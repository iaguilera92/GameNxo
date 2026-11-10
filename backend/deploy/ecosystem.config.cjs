// pm2 (alternativa a systemd):  npm run build && pm2 start deploy/ecosystem.config.cjs && pm2 save
// IMPORTANTE: instances 1 y modo fork. Las salas están en memoria; en modo cluster dos jugadores caerían en
// procesos distintos y nunca se emparejarían.
module.exports = {
  apps: [
    {
      name: 'nxogames',
      script: 'dist/server.js',
      cwd: __dirname + '/..',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      kill_timeout: 140000, // ms: deja terminar los partidos tras SIGTERM
      env: { NODE_ENV: 'production', PORT: 3001, TRUST_PROXY: '1' },
    },
  ],
};
