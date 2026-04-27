#!/usr/bin/env node
// test-all.js - Smoke test for MoonShotForge

import { execSync } from 'child_process';
import http from 'http';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';
let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (err) {
    console.error(`❌ ${name}: ${err.message}`);
    failed++;
  }
}

async function testEndpoint(path, expectedStatus = 200) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    http.get(url.toString(), (res) => {
      if (res.statusCode === expectedStatus) {
        resolve(res.statusCode);
      } else {
        reject(new Error(`Expected ${expectedStatus}, got ${res.statusCode}`));
      }
    }).on('error', reject);
  });
}

console.log('🚀 MoonShotForge Smoke Tests\n');

// Check files exist
test('package.json exists', () => {
  const fs = await import('fs');
  if (!fs.existsSync('./package.json')) throw new Error('Missing package.json');
});

test('tsconfig.json exists', () => {
  const fs = await import('fs');
  if (!fs.existsSync('./tsconfig.json')) throw new Error('Missing tsconfig.json');
});

test('src/index.ts exists', () => {
  const fs = await import('fs');
  if (!fs.existsSync('./src/index.ts')) throw new Error('Missing src/index.ts');
});

test('src/database.ts exists', () => {
  const fs = await import('fs');
  if (!fs.existsSync('./src/database.ts')) throw new Error('Missing src/database.ts');
});

test('.env.example exists', () => {
  const fs = await import('fs');
  if (!fs.existsSync('./.env.example')) throw new Error('Missing .env.example');
});

test('public/index.html exists', () => {
  const fs = await import('fs');
  if (!fs.existsSync('./public/index.html')) throw new Error('Missing public/index.html');
});

// Check environment
test('Node.js version >= 18', () => {
  const version = parseInt(process.version.slice(1).split('.')[0]);
  if (version < 18) throw new Error(`Node ${process.version} < 18`);
});

console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
