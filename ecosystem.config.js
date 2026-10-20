module.exports = {
  apps: [
    {
      name: 'controle-contas-backend',
      script: 'main.py',
      interpreter: 'python',
      cwd: './app/backend',
      watch: false,
      env: {
        PYTHONUNBUFFERED: 1
      }
    }
  ]
};
