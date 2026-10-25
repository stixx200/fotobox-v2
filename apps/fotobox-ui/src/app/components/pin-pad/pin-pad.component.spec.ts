import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { PIN_ERROR_MS, PinPadComponent } from './pin-pad.component';

describe('PinPadComponent', () => {
  let fixture: ComponentFixture<PinPadComponent>;
  let pad: PinPadComponent;
  let entered: string[];
  let cancelled: number;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PinPadComponent],
      providers: [provideTranslateService()],
    }).compileComponents();
    fixture = TestBed.createComponent(PinPadComponent);
    fixture.componentRef.setInput('title', 'Enter PIN');
    fixture.componentRef.setInput('errorMessage', 'Wrong PIN');
    fixture.componentRef.setInput('cancelLabel', 'Back');
    pad = fixture.componentInstance;
    entered = [];
    cancelled = 0;
    pad.pinEntered.subscribe((pin) => entered.push(pin));
    pad.cancelled.subscribe(() => cancelled++);
    fixture.detectChanges();
  });

  afterEach(() => vi.useRealTimers());

  function key(name: string): HTMLButtonElement {
    return fixture.nativeElement.querySelector(`[data-key="${name}"]`);
  }

  function filledDots(): number {
    return fixture.nativeElement.querySelectorAll('.pin-dot--filled').length;
  }

  it('renders the title, four dots and twelve keypad cells', () => {
    expect(fixture.nativeElement.querySelector('h2').textContent).toContain(
      'Enter PIN',
    );
    expect(fixture.nativeElement.querySelectorAll('.pin-dot').length).toBe(4);
    expect(fixture.nativeElement.querySelectorAll('.keypad-key').length).toBe(
      12,
    );
  });

  it('auto-submits once all digits are entered and clears itself', () => {
    for (const digit of '123') {
      key(digit).click();
    }
    fixture.detectChanges();
    expect(filledDots()).toBe(3);
    expect(entered).toEqual([]);

    key('4').click();
    fixture.detectChanges();
    expect(entered).toEqual(['1234']);
    expect(filledDots()).toBe(0);
  });

  it('respects a custom length', () => {
    fixture.componentRef.setInput('length', 6);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.pin-dot').length).toBe(6);
    for (const digit of '12345') {
      pad.pressDigit(digit);
    }
    expect(entered).toEqual([]);
    pad.pressDigit('6');
    expect(entered).toEqual(['123456']);
  });

  it('deletes the last digit', () => {
    expect(key('delete').disabled).toBe(true);
    pad.pressDigit('1');
    pad.pressDigit('2');
    fixture.detectChanges();
    key('delete').click();
    fixture.detectChanges();
    expect(pad.pin()).toBe('1');
    expect(filledDots()).toBe(1);
  });

  it('shows the error state and clears it on the next digit', () => {
    fixture.componentRef.setInput('error', true);
    fixture.detectChanges();
    const card = fixture.nativeElement.querySelector('.pin-card');
    expect(card.classList).toContain('pin-card--shake');
    expect(
      fixture.nativeElement.querySelector('.pin-error').textContent,
    ).toContain('Wrong PIN');

    key('5').click();
    fixture.detectChanges();
    expect(pad.error()).toBe(false);
    expect(card.classList).not.toContain('pin-card--shake');
  });

  it('clears the error state after a while', () => {
    vi.useFakeTimers();
    pad.error.set(true);
    TestBed.tick();
    vi.advanceTimersByTime(PIN_ERROR_MS);
    expect(pad.error()).toBe(false);
  });

  it('supports a hardware keyboard', () => {
    const press = (k: string) =>
      document.dispatchEvent(new KeyboardEvent('keydown', { key: k }));
    press('9');
    press('8');
    press('Backspace');
    press('7');
    press('6');
    press('5');
    expect(entered).toEqual(['9765']);
    press('Escape');
    expect(cancelled).toBe(1);
  });

  it('offers cancel only when cancelable', () => {
    key('cancel').click();
    expect(cancelled).toBe(1);
    expect(key('cancel').getAttribute('aria-label')).toBe('Back');

    fixture.componentRef.setInput('cancelable', false);
    fixture.detectChanges();
    expect(key('cancel')).toBeNull();
    pad.onKeydown(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(cancelled).toBe(1);
  });

  it('labels the keypad by its title and announces progress', () => {
    const group = fixture.nativeElement.querySelector('[role="group"]');
    const title = fixture.nativeElement.querySelector('h2');
    expect(group.getAttribute('aria-labelledby')).toBe(title.id);
    expect(
      fixture.nativeElement
        .querySelector('[role="status"]')
        .getAttribute('aria-label'),
    ).toBe('PIN_PAD.PROGRESS');
  });
});
