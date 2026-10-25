export interface PrintImageOptions {
  /** OS printer name; the system default printer when omitted. */
  printerName?: string;
  landscape: boolean;
}

export interface PrintCommand {
  command: string;
  args: string[];
  /** Extra environment variables (inputs are never interpolated into scripts). */
  env: Record<string, string>;
}

/**
 * Prints one image scaled to fit the page, without a dialog. Inputs arrive via
 * FOTOBOX_PRINT_* environment variables so file and printer names can never
 * be interpreted as PowerShell code.
 */
const WINDOWS_PRINT_SCRIPT = `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$image = [System.Drawing.Image]::FromFile($env:FOTOBOX_PRINT_FILE)
try {
  $doc = New-Object System.Drawing.Printing.PrintDocument
  if ($env:FOTOBOX_PRINT_PRINTER) {
    $doc.PrinterSettings.PrinterName = $env:FOTOBOX_PRINT_PRINTER
  }
  if (-not $doc.PrinterSettings.IsValid) {
    throw "Printer not found: $($doc.PrinterSettings.PrinterName)"
  }
  $doc.DefaultPageSettings.Landscape = ($env:FOTOBOX_PRINT_LANDSCAPE -eq '1')
  $doc.DefaultPageSettings.Margins = New-Object System.Drawing.Printing.Margins(0, 0, 0, 0)
  $doc.PrintController = New-Object System.Drawing.Printing.StandardPrintController
  $doc.add_PrintPage({
    param($sender, $e)
    $bounds = $e.PageBounds
    $scale = [Math]::Min($bounds.Width / $image.Width, $bounds.Height / $image.Height)
    $width = $image.Width * $scale
    $height = $image.Height * $scale
    $e.Graphics.DrawImage($image, [single](($bounds.Width - $width) / 2), [single](($bounds.Height - $height) / 2), [single]$width, [single]$height)
    $e.HasMorePages = $false
  })
  $doc.Print()
} finally {
  $image.Dispose()
}
`;

export function buildPrintCommand(
  platform: NodeJS.Platform,
  filePath: string,
  options: PrintImageOptions,
): PrintCommand {
  const printerName = options.printerName?.trim() || undefined;

  if (platform === 'win32') {
    return {
      command: 'powershell.exe',
      args: [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-Command',
        WINDOWS_PRINT_SCRIPT,
      ],
      env: {
        FOTOBOX_PRINT_FILE: filePath,
        FOTOBOX_PRINT_PRINTER: printerName ?? '',
        FOTOBOX_PRINT_LANDSCAPE: options.landscape ? '1' : '0',
      },
    };
  }

  // CUPS (macOS / Linux)
  return {
    command: 'lp',
    args: [
      ...(printerName ? ['-d', printerName] : []),
      '-o',
      'fit-to-page',
      '-o',
      options.landscape ? 'landscape' : 'portrait',
      '--',
      filePath,
    ],
    env: {},
  };
}
