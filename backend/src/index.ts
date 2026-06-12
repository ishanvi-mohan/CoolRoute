import dotenv from 'dotenv';
import { resolve } from 'path';
import { cwd } from 'process';
import app from './server.js';

// Load .env from backend directory
// tsx runs from backend/ directory
const backendEnvPath = resolve(cwd(), '.env');
const rootEnvPath = resolve(cwd(), '..', '.env');

console.log('🔍 Environment check:');
console.log(`   Working directory: ${cwd()}`);
console.log(`   Backend .env path: ${backendEnvPath}`);
console.log(`   Root .env path: ${rootEnvPath}`);

// Load backend .env
const backendResult = dotenv.config({ path: backendEnvPath });
if (backendResult.error) {
  console.log(`   ⚠️  Backend .env error: ${backendResult.error.message}`);
}

// Also try root .env as fallback
const rootResult = dotenv.config({ path: rootEnvPath });
if (rootResult.error) {
  console.log(`   ⚠️  Root .env error: ${rootResult.error.message}`);
}

console.log(`   MAPBOX_ACCESS_TOKEN: ${process.env.MAPBOX_ACCESS_TOKEN ? '✓ Set' : '✗ Not set'}`);
console.log(`   OPENWEATHER_API_KEY: ${process.env.OPENWEATHER_API_KEY ? '✓ Set' : '✗ Not set'}`);

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/api/health`);
});
