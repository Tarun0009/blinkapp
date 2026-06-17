#!/usr/bin/env node

const { spawn } = require('node:child_process');
const readline = require('node:readline');

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const nodeCommand = process.execPath;
const processes = [
  {
    name: 'backend',
    command: npmCommand,
    args: ['--prefix', 'backend', 'run', 'dev'],
  },
  {
    name: 'metro',
    command: npmCommand,
    args: ['start'],
  },
  {
    name: 'adb',
    command: nodeCommand,
    args: ['scripts/android-reverse.js', '--watch'],
  },
];
const children = [];

function prefixStream(stream, name, isError = false) {
  const reader = readline.createInterface({ input: stream });
  reader.on('line', line => {
    const output = `[${name}] ${line}`;
    if (isError) {
      console.error(output);
    } else {
      console.log(output);
    }
  });
}

function stopChildren() {
  for (const child of children) {
    if (!child.killed) {
      child.kill();
    }
  }
}

for (const processConfig of processes) {
  const child = spawn(processConfig.command, processConfig.args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: ['inherit', 'pipe', 'pipe'],
  });

  children.push(child);
  prefixStream(child.stdout, processConfig.name);
  prefixStream(child.stderr, processConfig.name, true);

  child.on('error', error => {
    console.error(`[${processConfig.name}] ${error.message}`);
  });

  child.on('exit', code => {
    if (code !== 0 && code !== null) {
      console.error(`[${processConfig.name}] exited with code ${code}`);
    }
  });
}

process.on('SIGINT', () => {
  stopChildren();
  process.exit(0);
});

process.on('SIGTERM', () => {
  stopChildren();
  process.exit(0);
});
