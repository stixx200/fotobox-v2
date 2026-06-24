import { describe, expect, it } from 'vitest';
import { parseLpstatOutput } from './printer-lpstat.parser';

describe('parseLpstatOutput', () => {
  it('parses English lpstat -p and -d output', () => {
    const output = `
printer HP_OfficeJet is idle.  enabled since Wed May  6 08:03:04 2026
printer Canon_SELPHY_CP1200 is idle.  enabled since Mon May 15 08:03:53 2023
system default destination: Canon_SELPHY_CP1200
`;

    const printers = parseLpstatOutput(output);

    expect(printers).toHaveLength(2);
    expect(printers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'HP_OfficeJet',
          state: 'idle',
          isDefault: false,
        }),
        expect.objectContaining({
          name: 'Canon_SELPHY_CP1200',
          state: 'idle',
          isDefault: true,
        }),
      ]),
    );
  });

  it('parses German lpstat -p and -d output', () => {
    const output = `
Drucker \u201E_30_MF_000_2\u201C ist inaktiv; aktiviert seit Mon May 11 15:37:21 2026
Drucker \u201ECanon_SELPHY_CP1200\u201C ist inaktiv; aktiviert seit Mon May 15 08:03:53 2023
Drucker \u201ETA_UTAX_P_4532DN\u201C ist inaktiv; aktiviert seit Wed May 20 20:43:31 2026
System-Standardzielort: TA_UTAX_P_4532DN
`;

    const printers = parseLpstatOutput(output);

    expect(printers).toHaveLength(3);
    expect(printers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'Canon_SELPHY_CP1200',
          state: 'idle',
          isDefault: false,
        }),
        expect.objectContaining({
          name: 'TA_UTAX_P_4532DN',
          state: 'idle',
          isDefault: true,
        }),
      ]),
    );
  });

  it('parses English and German accepting-request lines', () => {
    const output = `
HP_OfficeJet accepting requests since Wed May  6 08:03:04 2026
Canon_SELPHY_CP1200 akzeptiert Anfragen seit Mon May 15 08:03:53 2023
system default destination: Canon_SELPHY_CP1200
`;

    const printers = parseLpstatOutput(output);

    expect(printers).toHaveLength(2);
    expect(printers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'HP_OfficeJet',
          state: 'idle',
          isDefault: false,
        }),
        expect.objectContaining({
          name: 'Canon_SELPHY_CP1200',
          state: 'idle',
          isDefault: true,
        }),
      ]),
    );
  });

  it('reads default printer from device-for lines', () => {
    const output = `
printer HP_OfficeJet is idle.  enabled since Wed May  6 08:03:04 2026
device for HP_OfficeJet: dnssd://OfficeJet._ipp._tcp.local/
`;

    const printers = parseLpstatOutput(output);

    expect(printers).toEqual([
      expect.objectContaining({
        name: 'HP_OfficeJet',
        state: 'idle',
        isDefault: true,
      }),
    ]);
  });

  it('returns an empty list for unrelated output', () => {
    expect(parseLpstatOutput('no system default destination')).toEqual([]);
  });
});
