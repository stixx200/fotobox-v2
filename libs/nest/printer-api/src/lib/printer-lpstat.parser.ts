import { PrinterInfo } from './models/printer.model';

const DEFAULT_LINE_PATTERNS: RegExp[] = [
  /system default destination:\s*(.+)$/i,
  /System-Standardzielort:\s*(.+)$/i,
  /device for (.+?):/i,
];

const LPSTAT_QUOTE_CHARS = '\u201E\u201C\u201D"';

const PRINTER_STATUS_LINE_PATTERNS: Array<{
  pattern: RegExp;
  stateGroup: number;
}> = [
  { pattern: /^printer (.+?) is (.+?)(?:\.|;|$)/i, stateGroup: 2 },
  {
    pattern: new RegExp(
      `^Drucker [${LPSTAT_QUOTE_CHARS}](.+?)[${LPSTAT_QUOTE_CHARS}] ist (.+?)(?:;|$)`,
      'i',
    ),
    stateGroup: 2,
  },
];

const PRINTER_ACCEPTING_LINE_PATTERNS: RegExp[] = [
  /^(.+?) accepting requests/i,
  /^(.+?) akzeptiert Anfragen/i,
];

function parseDefaultPrinter(line: string): string | null {
  for (const pattern of DEFAULT_LINE_PATTERNS) {
    const match = line.match(pattern);
    if (match?.[1]) {
      return match[1].trim();
    }
  }
  return null;
}

function mapLpstatState(stateFragment: string): string {
  const lower = stateFragment.toLowerCase();
  if (
    lower.includes('idle') ||
    lower.includes('inaktiv') ||
    lower.includes('bereit')
  ) {
    return 'idle';
  }
  return 'error';
}

function parsePrinterStatusLine(
  line: string,
): Pick<PrinterInfo, 'name' | 'state'> | null {
  for (const { pattern, stateGroup } of PRINTER_STATUS_LINE_PATTERNS) {
    const match = line.match(pattern);
    if (match?.[1]) {
      return {
        name: match[1].trim(),
        state: mapLpstatState(match[stateGroup] ?? ''),
      };
    }
  }
  return null;
}

function parsePrinterAcceptingLine(
  line: string,
): Pick<PrinterInfo, 'name' | 'state'> | null {
  for (const pattern of PRINTER_ACCEPTING_LINE_PATTERNS) {
    const match = line.match(pattern);
    if (match?.[1]) {
      return {
        name: match[1].trim(),
        state: 'idle',
      };
    }
  }
  return null;
}

/** Parse `lpstat -p`, `lpstat -d`, and/or `lpstat -a` output (English or German). */
export function parseLpstatOutput(output: string): PrinterInfo[] {
  const lines = output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  let defaultPrinter: string | null = null;
  for (const line of lines) {
    defaultPrinter = parseDefaultPrinter(line) ?? defaultPrinter;
  }

  const printersByName = new Map<string, PrinterInfo>();
  for (const line of lines) {
    const fromStatus = parsePrinterStatusLine(line);
    const parsed = fromStatus ?? parsePrinterAcceptingLine(line);
    if (!parsed) {
      continue;
    }

    printersByName.set(parsed.name, {
      name: parsed.name,
      state: parsed.state,
      isDefault: parsed.name === defaultPrinter,
    });
  }

  return Array.from(printersByName.values());
}
