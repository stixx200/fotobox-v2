import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-splash-screen',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="splash-screen">
      <div class="splash-content">
        <div class="loader"></div>
        <h1>Fotobox</h1>
        <p>{{ message }}</p>
      </div>
    </div>
  `,
  styles: [`
    .splash-screen {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      z-index: 9999;
    }

    .splash-content {
      text-align: center;
      color: white;
    }

    h1 {
      font-size: 2.5rem;
      margin: 20px 0 10px 0;
      font-weight: 300;
      letter-spacing: 2px;
    }

    p {
      font-size: 1rem;
      margin: 0;
      opacity: 0.9;
    }

    .loader {
      border: 4px solid rgba(255, 255, 255, 0.3);
      border-top: 4px solid white;
      border-radius: 50%;
      width: 50px;
      height: 50px;
      animation: spin 1s linear infinite;
      margin: 0 auto;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `],
})
export class SplashScreenComponent {
  message = 'Connecting to backend...';
}
