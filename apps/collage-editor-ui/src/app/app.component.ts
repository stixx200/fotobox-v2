import {
  Component,
  ChangeDetectionStrategy,
  DOCUMENT,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterModule } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterModule],
  template: '<router-outlet />',
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [
    `
      :host {
        display: block;
        min-height: 100vh;
      }
    `,
  ],
})
export class AppComponent {
  constructor() {
    const document = inject(DOCUMENT);
    const translate = inject(TranslateService);
    const apply = (lang: string | undefined) => {
      if (lang) {
        document.documentElement.lang = lang;
      }
    };
    apply(translate.getCurrentLang?.() ?? undefined);
    translate.onLangChange
      .pipe(takeUntilDestroyed())
      .subscribe((event) => apply(event.lang));
  }
}
