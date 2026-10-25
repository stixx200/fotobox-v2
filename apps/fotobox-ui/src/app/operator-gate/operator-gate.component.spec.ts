import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { SettingsStore } from '../store';
import { SettingsComponent } from '../settings/settings.component';
import { FotoboxStartService } from '../services/fotobox-start.service';
import { OperatorAccessService } from '../services/operator-access.service';
import { Setting } from '../services/settings.service';
import { OperatorGateComponent } from './operator-gate.component';

@Component({ selector: 'app-settings', template: 'settings-stub' })
class SettingsStubComponent {}

const COMPLETE = [
  { key: 'camera', value: '"demo"' },
  { key: 'layouts', value: '["Einzelbild"]' },
];

describe('OperatorGateComponent', () => {
  const settings = signal<Setting[]>([]);
  const isLoading = signal(false);
  const loadSettings = vi.fn();
  const start = vi.fn<() => Promise<boolean>>();
  const startError = signal<string | null>(null);
  let routeData: Record<string, unknown>;

  beforeEach(async () => {
    vi.clearAllMocks();
    settings.set([]);
    isLoading.set(false);
    startError.set(null);
    start.mockResolvedValue(true);
    routeData = {};

    TestBed.configureTestingModule({
      imports: [OperatorGateComponent],
      providers: [
        provideRouter([]),
        provideTranslateService(),
        {
          provide: SettingsStore,
          useValue: { settings, isLoading, loadSettings },
        },
        {
          provide: FotoboxStartService,
          useValue: { start, error: startError, starting: signal(false) },
        },
        {
          provide: ActivatedRoute,
          useValue: {
            get snapshot() {
              return { data: routeData };
            },
          },
        },
      ],
    });
    TestBed.overrideComponent(OperatorGateComponent, {
      remove: { imports: [SettingsComponent] },
      add: { imports: [SettingsStubComponent] },
    });
    await TestBed.compileComponents();
  });

  async function createGate(
    data: Record<string, unknown> = {},
  ): Promise<ComponentFixture<OperatorGateComponent>> {
    routeData = data;
    const fixture = TestBed.createComponent(OperatorGateComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  function text(fixture: ComponentFixture<unknown>): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  function enterPin(
    fixture: ComponentFixture<OperatorGateComponent>,
    pin: string,
  ): void {
    for (const digit of pin) {
      (
        fixture.nativeElement.querySelector(
          `[data-key="${digit}"]`,
        ) as HTMLButtonElement
      ).click();
    }
    fixture.detectChanges();
  }

  describe('operator PIN', () => {
    it('shows the settings when no PIN is set (first run)', async () => {
      const fixture = await createGate();
      expect(fixture.componentInstance.state()).toBe('open');
      expect(text(fixture)).toContain('settings-stub');
      expect(loadSettings).toHaveBeenCalled();
    });

    it('waits for the settings before deciding', async () => {
      isLoading.set(true);
      settings.set([]);
      routeData = {};
      const fixture = TestBed.createComponent(OperatorGateComponent);
      fixture.detectChanges();
      expect(fixture.componentInstance.state()).toBe('checking');
      expect(loadSettings).not.toHaveBeenCalled();

      settings.set([...COMPLETE, { key: 'operatorPin', value: '"4711"' }]);
      isLoading.set(false);
      TestBed.tick();
      await fixture.whenStable();
      expect(fixture.componentInstance.state()).toBe('locked');
    });

    it('asks for the PIN, rejects a wrong one and unlocks with the right one', async () => {
      settings.set([...COMPLETE, { key: 'operatorPin', value: '"4711"' }]);
      const fixture = await createGate();
      expect(fixture.componentInstance.state()).toBe('locked');
      expect(text(fixture)).toContain('OPERATOR.ENTER_PIN');
      expect(text(fixture)).not.toContain('settings-stub');

      enterPin(fixture, '1234');
      expect(fixture.componentInstance.pinError()).toBe(true);
      expect(text(fixture)).toContain('OPERATOR.WRONG_PIN');
      expect(text(fixture)).not.toContain('settings-stub');

      enterPin(fixture, '4711');
      expect(fixture.componentInstance.state()).toBe('open');
      expect(text(fixture)).toContain('settings-stub');
      expect(TestBed.inject(OperatorAccessService).unlocked()).toBe(true);
    });

    it('stays unlocked for the rest of the visit', async () => {
      settings.set([...COMPLETE, { key: 'operatorPin', value: '"4711"' }]);
      TestBed.inject(OperatorAccessService).tryUnlock('4711');
      const fixture = await createGate();
      expect(fixture.componentInstance.state()).toBe('open');
    });

    it('cancel returns to the guest flow when settings are complete', async () => {
      settings.set([...COMPLETE, { key: 'operatorPin', value: '"4711"' }]);
      const fixture = await createGate();
      const cancel = fixture.nativeElement.querySelector(
        '[data-key="cancel"]',
      ) as HTMLButtonElement;
      expect(cancel).not.toBeNull();

      cancel.click();
      await fixture.whenStable();
      expect(start).toHaveBeenCalledWith({
        camera: 'demo',
        layouts: ['Einzelbild'],
      });
      expect(TestBed.inject(OperatorAccessService).unlocked()).toBe(false);
    });

    it('stays on the PIN pad and shows why when returning fails', async () => {
      settings.set([...COMPLETE, { key: 'operatorPin', value: '"4711"' }]);
      start.mockImplementation(async () => {
        startError.set('camera missing');
        return false;
      });
      const fixture = await createGate();
      await fixture.componentInstance.returnToFotobox();
      fixture.detectChanges();
      expect(fixture.componentInstance.state()).toBe('locked');
      expect(text(fixture)).toContain('SETTINGS.START_FAILED');
    });

    it('offers no cancel when the saved settings would not start', async () => {
      settings.set([
        { key: 'operatorPin', value: '"4711"' },
        { key: 'galleryPassword', value: '"12"' },
      ]);
      const fixture = await createGate();
      expect(fixture.componentInstance.state()).toBe('locked');
      expect(
        fixture.nativeElement.querySelector('[data-key="cancel"]'),
      ).toBeNull();
    });
  });

  describe('auto-start', () => {
    it('starts the guest flow from the start route when enabled and complete', async () => {
      settings.set([
        ...COMPLETE,
        { key: 'autoStart', value: 'true' },
        { key: 'operatorPin', value: '"4711"' },
      ]);
      const fixture = await createGate({ autoStart: true });
      expect(start).toHaveBeenCalledWith({
        camera: 'demo',
        layouts: ['Einzelbild'],
      });
      expect(fixture.componentInstance.state()).toBe('starting');
      expect(text(fixture)).not.toContain('settings-stub');
    });

    it('shows the settings when auto-start is off', async () => {
      settings.set([...COMPLETE, { key: 'autoStart', value: 'false' }]);
      const fixture = await createGate({ autoStart: true });
      expect(start).not.toHaveBeenCalled();
      expect(fixture.componentInstance.state()).toBe('open');
    });

    it('shows the settings when the saved settings are incomplete', async () => {
      settings.set([
        { key: 'autoStart', value: 'true' },
        { key: 'galleryPassword', value: '"12"' },
      ]);
      const fixture = await createGate({ autoStart: true });
      expect(start).not.toHaveBeenCalled();
      expect(fixture.componentInstance.state()).toBe('open');
    });

    it('never auto-starts on an explicit /settings visit', async () => {
      settings.set([...COMPLETE, { key: 'autoStart', value: 'true' }]);
      const fixture = await createGate();
      expect(start).not.toHaveBeenCalled();
      expect(fixture.componentInstance.state()).toBe('open');
    });

    it('auto-starts only once per launch', async () => {
      settings.set([...COMPLETE, { key: 'autoStart', value: 'true' }]);
      await createGate({ autoStart: true });
      const second = await createGate({ autoStart: true });
      expect(start).toHaveBeenCalledTimes(1);
      expect(second.componentInstance.state()).toBe('open');
    });

    it('falls back to the PIN-protected settings when the start fails', async () => {
      settings.set([
        ...COMPLETE,
        { key: 'autoStart', value: 'true' },
        { key: 'operatorPin', value: '"4711"' },
      ]);
      start.mockResolvedValue(false);
      const fixture = await createGate({ autoStart: true });
      expect(start).toHaveBeenCalled();
      expect(fixture.componentInstance.state()).toBe('locked');
    });
  });
});
