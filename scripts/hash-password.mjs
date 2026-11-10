#!/usr/bin/env node
/**
 * Generates OWNER_PASSWORD_HASH for the owner portal.
 *
 * Usage:
 *   node scripts/hash-password.mjs                # prompts (input hidden)
 *   echo -n "my password" | node scripts/hash-password.mjs --stdin
 *
 * Paste the printed value into your environment (e.g. Vercel → Settings →
 * Environment Variables) as OWNER_PASSWORD_HASH.
 */
import { randomBytes, scryptSync } from 'node:crypto';
import { createInterface } from 'node:readline';

const N = 2 ** 15;
const r = 8;
const p = 1;
const KEY_LEN = 64;
const MIN_LENGTH = 12;

async function readFromStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8').replace(/\r?\n$/, '');
}

function prompt(question) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    // Hide typed characters: only echo the question itself.
    rl._writeToOutput = (s) => {
      if (s.startsWith(question)) process.stdout.write(s);
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
  });
}

const useStdin = process.argv.includes('--stdin');
const password = useStdin ? await readFromStdin() : await prompt('Owner password: ');

if (!password || password.length < MIN_LENGTH) {
  console.error(`Password must be at least ${MIN_LENGTH} characters.`);
  process.exit(1);
}

if (!useStdin) {
  const confirm = await prompt('Confirm password: ');
  if (confirm !== password) {
    console.error('Passwords do not match.');
    process.exit(1);
  }
}

const salt = randomBytes(16);
const hash = scryptSync(password, salt, KEY_LEN, { N, r, p, maxmem: 128 * 1024 * 1024 });
console.log(
  // ':' separators (not '$'), because .env loaders expand "$..." sequences.
  `OWNER_PASSWORD_HASH=scrypt:${N}:${r}:${p}:${salt.toString('base64')}:${hash.toString('base64')}`
);
