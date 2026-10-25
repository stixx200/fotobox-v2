import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { SettingsStore } from '../store';
import { OperatorAccessService } from './operator-access.service';
import { Setting } from './settings.service';

@Component({ template: '' })
class BlankComponent {}

describe('OperatorAccessService', () => {
  const settings = signal<Setting[]>([]);
  let service: OperatorAccessService;

  beforeEach(() => {
    settings.set([]);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'settings', component: BlankComponent },
          { path: 'debug', component: BlankComponent },
          { path: 'layouts/single', component: BlankComponent },
        ]),
        { provide: SettingsStore, useValue: { settings } },
      ],
    });
    service = TestBed.inject(OperatorAccessService);
  });

  it('is open when no operator PIN is set', () => {
    expect(service.requiresPin()).toBe(false);
    expect(service.isOpen()).toBe(true);
  });

  it('ignores a malformed stored PIN instead of locking the operator out', () => {
    settings.set([{ key: 'operatorPin', value: '"12"' }]);
    expect(service.requiresPin()).toBe(false);
    expect(service.isOpen()).toBe(true);
  });

  it('is locked until the right PIN is entered', () => {
    settings.set([{ key: 'operatorPin', value: '"4711"' }]);
    expect(service.isOpen()).toBe(false);
    expect(service.tryUnlock('1234')).toBe(false);
    expect(service.isOpen()).toBe(false);
    expect(service.tryUnlock('4711')).toBe(true);
    expect(service.isOpen()).toBe(true);
  });

  it('locks again once the guest flow is entered', async () => {
    settings.set([{ key: 'operatorPin', value: '"4711"' }]);
    const router = TestBed.inject(Router);
    service.tryUnlock('4711');

    await router.navigateByUrl('/debug');
    expect(service.isOpen()).toBe(true);

    await router.navigateByUrl('/layouts/single');
    expect(service.isOpen()).toBe(false);
  });

  it('reads the auto-start flag', () => {
    expect(service.autoStartEnabled()).toBe(false);
    settings.set([{ key: 'autoStart', value: 'true' }]);
    expect(service.autoStartEnabled()).toBe(true);
  });

  it('allows auto-start to be claimed only once per launch', () => {
    expect(service.claimAutoStart()).toBe(true);
    expect(service.claimAutoStart()).toBe(false);
  });
});
