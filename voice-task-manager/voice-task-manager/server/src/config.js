require('dotenv').config();

const env = process.env;

module.exports = {
  env: env.NODE_ENV || 'development',
  port: Number(env.PORT) || 5000,
  mongoUri: env.MONGODB_URI || 'mongodb://127.0.0.1:27017/voice-task-manager',
  jwtSecret: env.JWT_SECRET || (env.NODE_ENV === 'production' ? undefined : 'dev-only-secret'),
  jwtExpiresIn: '7d',
  clientOrigins: (env.CLIENT_ORIGIN || 'http://localhost:5173').split(',').map((s) => s.trim()),
  openaiKey: env.OPENAI_API_KEY,
  openaiModel: env.OPENAI_MODEL || 'gpt-4o-mini',
  deepgramKey: env.DEEPGRAM_API_KEY,
  minConfidence: Number(env.MIN_CONFIDENCE) || 0.6,
};
