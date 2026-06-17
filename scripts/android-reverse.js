#!/usr/bin/env node

const { spawnSync } = require('node:child_process');

const DEFAULT_PORTS = ['8081', '4000'];
const ADB_COMMAND = process.env.ADB || (process.platform === 'win32' ? 'adb.exe' : 'adb');
const args = process.argv.slice(2);
const watch = args.includes('--watch');
const intervalArg = args.find(arg => arg.startsWith('--interval='));
const intervalMs = intervalArg ? Number(intervalArg.split('=')[1]) : 3000;
const ports = args
  .filter(arg => !arg.startsWith('--'))
  .flatMap(arg => arg.split(','))
  .map(port => port.replace(/^tcp:/, '').trim())
  .filter(Boolean);

const reversePorts = ports.length ? ports : DEFAULT_PORTS;
let lastDeviceKey = '';

function runAdb(argsToRun) {
  return spawnSync(ADB_COMMAND, argsToRun, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function getCommandError(result) {
  return (
    result.error?.message ||
    result.stderr?.trim?.() ||
    result.stdout?.trim?.() ||
    `Unable to run ${ADB_COMMAND}.`
  );
}

function getOnlineDevices() {
  const result = runAdb(['devices']);

  if (result.status !== 0) {
    throw new Error(getCommandError(result));
  }

  return result.stdout
    .split(/\r?\n/)
    .slice(1)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const [serial, state] = line.split(/\s+/);
      return { serial, state };
    })
    .filter(device => device.state === 'device');
}

function applyReverseForDevice(serial) {
  let ok = true;

  for (const port of reversePorts) {
    const result = runAdb(['-s', serial, 'reverse', `tcp:${port}`, `tcp:${port}`]);

    if (result.status === 0) {
      console.log(`${serial}: tcp:${port} -> tcp:${port}`);
    } else {
      ok = false;
      console.error(`${serial}: failed to reverse tcp:${port}`);
      console.error(getCommandError(result));
    }
  }

  return ok;
}

function applyReverse() {
  const devices = getOnlineDevices();
  const deviceKey = devices.map(device => device.serial).sort().join('|');

  if (!devices.length) {
    if (lastDeviceKey !== deviceKey) {
      console.log('No online Android devices found.');
      lastDeviceKey = deviceKey;
    }
    return false;
  }

  if (watch && deviceKey === lastDeviceKey) {
    return true;
  }

  lastDeviceKey = deviceKey;
  console.log(`Applying adb reverse for ${devices.length} device(s): ${reversePorts.join(', ')}`);

  return devices.map(device => applyReverseForDevice(device.serial)).every(Boolean);
}

function runOnce() {
  try {
    const ok = applyReverse();
    process.exit(ok ? 0 : 1);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

function runWatch() {
  console.log(`Watching ADB devices. Reapplying reverse ports every ${intervalMs}ms when devices change.`);

  try {
    applyReverse();
  } catch (error) {
    console.error(error.message);
  }

  setInterval(() => {
    try {
      applyReverse();
    } catch (error) {
      console.error(error.message);
    }
  }, intervalMs);
}

if (watch) {
  runWatch();
} else {
  runOnce();
}
