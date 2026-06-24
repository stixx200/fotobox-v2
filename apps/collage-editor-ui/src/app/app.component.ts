import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterModule],
  template: '<router-outlet />',
  styles: [
    `
      :host {
        display: block;
        min-height: 100vh;
        font-family:
          system-ui,
          -apple-system,
          sans-serif;
        color: #0f172a;
      }
    `,
  ],
})
export class AppComponent {}
