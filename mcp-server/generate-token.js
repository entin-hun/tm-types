#!/usr/bin/env node

/**
 * Generate JWT tokens for authenticated MCP operations
 * Usage: node generate-token.js [userId] [role]
 */

import jwt from 'jsonwebtoken';
import readline from 'readline';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function generateToken(userId, role, expiresIn = '24h') {
  return jwt.sign(
    { userId, role },
    JWT_SECRET,
    { expiresIn }
  );
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length >= 2) {
    const [userId, role] = args;
    const token = generateToken(userId, role);
    console.log('\nGenerated JWT Token:');
    console.log(token);
    console.log('\nDecoded payload:');
    console.log(jwt.decode(token));
    process.exit(0);
  }
  
  console.log('=== JWT Token Generator ===\n');
  
  rl.question('Enter User ID: ', (userId) => {
    rl.question('Enter Role (user/admin): ', (role) => {
      rl.question('Expiration (default: 24h): ', (expiry) => {
        const expiresIn = expiry || '24h';
        const token = generateToken(userId, role, expiresIn);
        
        console.log('\n=== Generated Token ===');
        console.log(token);
        console.log('\n=== Decoded Payload ===');
        console.log(jwt.decode(token));
        console.log('\n=== Usage Example ===');
        console.log('In MCP tool call, include:');
        console.log(JSON.stringify({ authToken: token }, null, 2));
        
        rl.close();
      });
    });
  });
}

main();
