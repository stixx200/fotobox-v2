import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { Subject, of, throwError } from 'rxjs';
import { PhotoActionsService } from './photo-actions.service';
import { PrintService } from './print.service';
import { ShareLink, ShareService } from './share.service';
import { NotificationService } from './notification.service';
import { ClientLogService } from './client-log.service';

describe('PhotoActionsService', () => {
  const printService = { printPhoto: vi.fn() };
  const shareService = { createShareLink: vi.fn() };
  const notification = { success: vi.fn(), error: vi.fn() };
  const clientLog = { error: vi.fn() };

  function create(): PhotoActionsService {
    TestBed.configureTestingModule({
      providers: [
        PhotoActionsService,
        { provide: PrintService, useValue: printService },
        { provide: ShareService, useValue: shareService },
        { provide: NotificationService, useValue: notification },
        { provide: ClientLogService, useValue: clientLog },
        { provide: TranslateService, useValue: { instant: (k: string) => k } },
      ],
    });
    return TestBed.inject(PhotoActionsService);
  }

  beforeEach(() => vi.clearAllMocks());

  it('confirms a successful print and clears the busy flag', async () => {
    printService.printPhoto.mockResolvedValue(true);
    const actions = create();

    const pending = actions.print('/api/photos/p.jpg');
    expect(actions.printing()).toBe(true);
    await expect(pending).resolves.toBe(true);

    expect(actions.printing()).toBe(false);
    expect(notification.success).toHaveBeenCalledWith('PRINT.STARTED');
  });

  it('ignores a second print while one is running (no double prints)', async () => {
    let resolve!: (value: boolean) => void;
    printService.printPhoto.mockReturnValue(
      new Promise<boolean>((r) => (resolve = r)),
    );
    const actions = create();

    const first = actions.print('/api/photos/p.jpg');
    await expect(actions.print('/api/photos/p.jpg')).resolves.toBe(false);
    resolve(true);
    await first;

    expect(printService.printPhoto).toHaveBeenCalledTimes(1);
  });

  it('does not confirm a failed print', async () => {
    printService.printPhoto.mockResolvedValue(false);
    const actions = create();

    await expect(actions.print('/api/photos/p.jpg')).resolves.toBe(false);
    expect(notification.success).not.toHaveBeenCalled();
  });

  it('opens the share link and tracks the busy state', () => {
    const link: ShareLink = {
      url: 'http://x/api/share/t',
      token: 't',
      expiresAt: '',
    };
    const result = new Subject<ShareLink>();
    shareService.createShareLink.mockReturnValue(result);
    const actions = create();

    actions.share('/api/photos/p.jpg');
    expect(actions.sharing()).toBe(true);
    result.next(link);
    result.complete();

    expect(actions.sharing()).toBe(false);
    expect(actions.shareLink()).toBe(link);
    actions.closeShare();
    expect(actions.shareLink()).toBeNull();
  });

  it('shows a friendly error when the share link fails', () => {
    shareService.createShareLink.mockReturnValue(
      throwError(() => new Error('useShare disabled')),
    );
    const actions = create();

    actions.share('/api/photos/p.jpg');

    expect(notification.error).toHaveBeenCalledWith('SHARE.ERROR');
    expect(clientLog.error).toHaveBeenCalled();
    expect(actions.sharing()).toBe(false);
  });

  it('does nothing without a photo', async () => {
    shareService.createShareLink.mockReturnValue(of(null));
    const actions = create();
    actions.share(null);
    await expect(actions.print(null)).resolves.toBe(false);
    expect(shareService.createShareLink).not.toHaveBeenCalled();
    expect(printService.printPhoto).not.toHaveBeenCalled();
  });
});
