import { TestBed } from '@angular/core/testing';
import { NavigationEnd, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { IdleService } from './idle.service';
import { LayoutNavigationService } from './layout-navigation.service';

describe('IdleService', () => {
  const events = new Subject<unknown>();
  const layoutNavigation = { navigateToEntryPoint: vi.fn() };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        IdleService,
        { provide: Router, useValue: { events } },
        { provide: LayoutNavigationService, useValue: layoutNavigation },
      ],
    });
  });

  afterEach(() => {
    TestBed.inject(IdleService).ngOnDestroy();
    vi.useRealTimers();
  });

  function navigate(url: string): void {
    events.next(new NavigationEnd(1, url, url));
  }

  it('returns an idle gallery to the start screen', () => {
    TestBed.inject(IdleService);
    navigate('/gallery');

    vi.advanceTimersByTime(60_000);

    expect(layoutNavigation.navigateToEntryPoint).toHaveBeenCalledTimes(1);
  });

  it('restarts the timer on interaction', () => {
    TestBed.inject(IdleService);
    navigate('/layouts/single');

    vi.advanceTimersByTime(50_000);
    window.dispatchEvent(new Event('click'));
    vi.advanceTimersByTime(50_000);

    expect(layoutNavigation.navigateToEntryPoint).not.toHaveBeenCalled();
  });

  it('stays inactive on the settings page', () => {
    TestBed.inject(IdleService);
    navigate('/settings');

    vi.advanceTimersByTime(120_000);

    expect(layoutNavigation.navigateToEntryPoint).not.toHaveBeenCalled();
  });
});
