import Transport from 'winston-transport';
import type { Logform } from 'winston';
import { addLogRecord } from './log-buffer';

export class LogBufferTransport extends Transport {
  constructor(opts?: Transport.TransportStreamOptions) {
    super(opts);
  }

  log(info: Logform.TransformableInfo, callback: () => void): void {
    setImmediate(() => {
      this.emit('logged', info);
    });

    const { level, message, timestamp, context, splat, ...rest } = info;
    const meta =
      rest && Object.keys(rest).length > 0
        ? JSON.stringify(rest, (_, value) =>
            typeof value === 'bigint' ? value.toString() : value,
          )
        : undefined;

    addLogRecord({
      timestamp: String(timestamp ?? new Date().toISOString()),
      level: String(level),
      message:
        typeof message === 'string' ? message : JSON.stringify(message),
      context: context ? String(context) : undefined,
      metaJson: meta,
    });

    callback();
  }
}
