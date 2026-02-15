import { spawn } from 'node:child_process';
import { once } from 'node:events';
import * as inspector from 'node:inspector';
import pathToElectron from 'electron';

const processArgs = [...process.argv.slice(2)];
const inspectorUrl = inspector.url();
if (inspectorUrl) {
  inspector.close();
}

const proc = spawn(pathToElectron, processArgs, {
  stdio: 'inherit',
  env: process.env,
});
proc.on('exit', (code) => {
  process.exitCode = code;
});

await once(proc, 'close');
process.exit();
