/**
 * Script para gerar um JWT secret seguro
 * Execute com: node scripts/gerar-jwt-secret.js
 */

const crypto = require('crypto');

const secret = crypto.randomBytes(64).toString('hex');

console.log('\n🔑 JWT Secret gerado com sucesso!\n');
console.log('Adicione esta linha no seu arquivo .env:\n');
console.log(`AUTH_JWT_SECRET="${secret}"\n`);
console.log('⚠️  Nunca compartilhe este secret ou commite ele no git!\n');
