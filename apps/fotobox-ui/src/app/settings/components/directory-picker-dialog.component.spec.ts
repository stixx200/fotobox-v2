import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideTranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';
import {
  DirectoryBrowserService,
  DirectoryListing,
} from '../../services/directory-browser.service';
import { DirectoryPickerDialogComponent } from './directory-picker-dialog.component';

function listing(path: string, entries: string[] = []): DirectoryListing {
  return {
    path,
    parent: path === '/' ? null : '/',
    roots: ['/home/booth', '/'],
    entries: entries.map((name) => ({ name, path: `${path}/${name}` })),
  };
}

describe('DirectoryPickerDialogComponent', () => {
  const browse = vi.fn();
  const close = vi.fn();

  function create(initialPath?: string) {
    TestBed.configureTestingModule({
      imports: [DirectoryPickerDialogComponent],
      providers: [
        { provide: DirectoryBrowserService, useValue: { browse } },
        { provide: MatDialogRef, useValue: { close } },
        {
          provide: MAT_DIALOG_DATA,
          useValue: { title: 'Photo folder', initialPath },
        },
        provideTranslateService(),
      ],
    });
    const fixture = TestBed.createComponent(DirectoryPickerDialogComponent);
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => {
    browse.mockReset();
    close.mockReset();
  });

  it('starts in the configured folder and lists its subfolders', () => {
    browse.mockReturnValue(of(listing('/data', ['photos', 'templates'])));
    const fixture = create('/data');

    expect(browse).toHaveBeenCalledWith('/data');
    const entries = fixture.nativeElement.querySelectorAll('.picker__entry');
    expect([...entries].map((e: Element) => e.textContent?.trim())).toEqual([
      'folderphotos',
      'foldertemplates',
    ]);
  });

  it('navigates into a folder and returns the chosen path', () => {
    browse.mockImplementation((path?: string) =>
      of(listing(path ?? '/home/booth', ['photos'])),
    );
    const fixture = create();
    const component = fixture.componentInstance;

    component.open('/home/booth/photos');
    component.choose();

    expect(close).toHaveBeenCalledWith('/home/booth/photos');
  });

  it('shows an error when the folders cannot be loaded', () => {
    browse.mockReturnValue(throwError(() => new Error('network')));
    const fixture = create('/data');
    fixture.detectChanges();

    expect(fixture.componentInstance.error()).toBe(true);
    expect(
      fixture.nativeElement.querySelector('.picker__status--error'),
    ).not.toBeNull();
  });
});
