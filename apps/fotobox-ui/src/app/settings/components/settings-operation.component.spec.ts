import { FormControl, FormGroup } from '@angular/forms';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { KioskHostService } from '../../services/kiosk-host.service';
import { NotificationService } from '../../services/notification.service';
import { ClientLogService } from '../../services/client-log.service';
import { ExitKioskDialogComponent } from './exit-kiosk-dialog.component';
import { SettingsOperationComponent } from './settings-operation.component';

describe('SettingsOperationComponent', () => {
  const host = {
    isDesktopHost: vi.fn(() => true),
    exitToWindows: vi.fn(() => Promise.resolve(true)),
  };
  const dialog = { open: vi.fn() };
  const notification = { error: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    host.isDesktopHost.mockReturnValue(true);
    host.exitToWindows.mockResolvedValue(true);
    await TestBed.configureTestingModule({
      imports: [SettingsOperationComponent],
      providers: [
        provideTranslateService(),
        { provide: KioskHostService, useValue: host },
        { provide: NotificationService, useValue: notification },
        { provide: ClientLogService, useValue: { error: vi.fn() } },
      ],
    })
      .overrideProvider(MatDialog, { useValue: dialog })
      .compileComponents();
  });

  function create(): ComponentFixture<SettingsOperationComponent> {
    const fixture = TestBed.createComponent(SettingsOperationComponent);
    fixture.componentRef.setInput(
      'settingsForm',
      new FormGroup({
        operatorPin: new FormControl(''),
        autoStart: new FormControl(false),
      }),
    );
    fixture.detectChanges();
    return fixture;
  }

  function exitButton(
    fixture: ComponentFixture<SettingsOperationComponent>,
  ): HTMLButtonElement | null {
    return fixture.nativeElement.querySelector('.exit-kiosk-button');
  }

  function answerDialog(result: boolean | undefined): void {
    dialog.open.mockReturnValue({ afterClosed: () => of(result) });
  }

  it('shows the operator PIN and auto-start fields', () => {
    const fixture = create();
    expect(
      fixture.nativeElement.querySelector('input.operator-pin-input').type,
    ).toBe('password');
    expect(fixture.nativeElement.textContent).toContain('SETTINGS.AUTO_START');
  });

  it('shows "switch to Windows" only in the desktop app', () => {
    expect(exitButton(create())).not.toBeNull();

    host.isDesktopHost.mockReturnValue(false);
    expect(exitButton(create())).toBeNull();
  });

  it('asks for confirmation before leaving the kiosk', async () => {
    answerDialog(true);
    const fixture = create();
    await fixture.componentInstance.exitToWindows();
    expect(dialog.open).toHaveBeenCalledWith(
      ExitKioskDialogComponent,
      expect.anything(),
    );
    expect(host.exitToWindows).toHaveBeenCalled();
    expect(notification.error).not.toHaveBeenCalled();
  });

  it('stays in the kiosk when the dialog is cancelled', async () => {
    answerDialog(false);
    await create().componentInstance.exitToWindows();
    expect(host.exitToWindows).not.toHaveBeenCalled();

    answerDialog(undefined);
    await create().componentInstance.exitToWindows();
    expect(host.exitToWindows).not.toHaveBeenCalled();
  });

  it('reports a failed exit', async () => {
    answerDialog(true);
    host.exitToWindows.mockRejectedValue(new Error('boom'));
    const component = create().componentInstance;
    await component.exitToWindows();
    expect(notification.error).toHaveBeenCalledWith(
      'SETTINGS.EXIT_TO_WINDOWS_ERROR',
    );
    expect(component.exiting()).toBe(false);
  });
});

describe('ExitKioskDialogComponent', () => {
  it('explains the maintenance window and the way back to Windows', async () => {
    await TestBed.configureTestingModule({
      imports: [ExitKioskDialogComponent],
      providers: [provideTranslateService()],
    }).compileComponents();
    const fixture = TestBed.createComponent(ExitKioskDialogComponent);
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    for (const key of [
      'EXIT_KIOSK.MAINTENANCE',
      'EXIT_KIOSK.STEP_KEYS',
      'EXIT_KIOSK.STEP_SWITCH_USER',
      'EXIT_KIOSK.STEP_SIGN_IN',
      'EXIT_KIOSK.CONFIRM',
    ]) {
      expect(text).toContain(key);
    }
  });
});
