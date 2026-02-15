import { describe, it, expect } from 'vitest';
import { SettingsComponent } from './settings.component';

describe('SettingsComponent', () => {
  it('should create component instance', () => {
    const component = new SettingsComponent();
    expect(component).toBeTruthy();
  });

  it('should have default layouts', () => {
    const component = new SettingsComponent();
    expect(component.layouts).toStrictEqual(['Einzelbild', 'Collage']);
  });

  it('should have default cameras', () => {
    const component = new SettingsComponent();
    expect(component.cameras).toStrictEqual(['Sony', 'Demo']);
  });

  it('should have initialized settings form', () => {
    const component = new SettingsComponent();
    expect(component.settingsForm).toBeDefined();
    expect(component.settingsForm.get('shutterTimeout')?.value).toBe(5);
    expect(component.settingsForm.get('usePrinter')?.value).toBe(true);
    expect(component.settingsForm.get('printerName')?.value).toBe('printer1');
  });

  it('should have openPicker method', () => {
    const component = new SettingsComponent();
    expect(typeof component.openPicker).toBe('function');
  });
});
