const http = require('http');
const mongoose = require('mongoose');
const config = require('./config');
const app = require('./app');
const { attachSocket } = require('./socket');

async function main() {
  if (!config.jwtSecret) throw new Error('JWT_SECRET must be set in production');
  await mongoose.connect(config.mongoUri);
  console.log('MongoDB connected');

  const server = http.createServer(app);
  attachSocket(server);
  server.listen(config.port, () => console.log(`API + WebSocket listening on :${config.port}`));

  const shutdown = () => {
    server.close(() => mongoose.disconnect().then(() => process.exit(0)));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
