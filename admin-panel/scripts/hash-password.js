#!/usr/bin/env node
/**
 * Generate bcrypt hash untuk WSO2_ADMIN_PASSWORD_HASH.
 * Pakai: node scripts/hash-password.js '<password>'
 * Lalu salin output ke .env sebagai WSO2_ADMIN_PASSWORD_HASH.
 */
const bcrypt = require('bcryptjs');

const pw = process.argv[2];
if (!pw) {
  console.error('Usage: node scripts/hash-password.js <password>');
  process.exit(1);
}

const hash = bcrypt.hashSync(pw, 12);
console.log(hash);
