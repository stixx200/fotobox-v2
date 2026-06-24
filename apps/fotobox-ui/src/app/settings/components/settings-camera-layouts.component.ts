import { Component, input, output } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-settings-camera-layouts',
  standalone: true,
  styleUrl: '../settings-panel.shared.scss',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    TranslatePipe,
  ],
  template: `
    <div class="settings-card" [formGroup]="settingsForm()">
      <div class="card-header">
        <mat-icon>camera_alt</mat-icon>
        <span>{{ 'SETTINGS.CAMERA' | translate }}</span>
        <button
          type="button"
          mat-icon-button
          class="card-header__action"
          [disabled]="refreshingTemplates()"
          (click)="refreshTemplates.emit()"
          [attr.aria-label]="'DEBUG.REFRESH' | translate"
        >
          @if (refreshingTemplates()) {
            <mat-spinner diameter="20" />
          } @else {
            <mat-icon>refresh</mat-icon>
          }
        </button>
      </div>
      <div class="card-body">
        <mat-form-field floatLabel="always">
          <mat-label>{{ 'SETTINGS.CAMERA' | translate }}</mat-label>
          <mat-select formControlName="camera">
            @for (camera of availableCameraNames(); track camera) {
              <mat-option [value]="camera">{{ camera }}</mat-option>
            }
            @if (availableCameraNames().length === 0) {
              <mat-option disabled>{{
                'SETTINGS.NO_CAMERA' | translate
              }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        <div class="layouts-select-wrap">
          <div
            class="layout-preview-pane"
            aria-live="polite"
            (click)="cycleLayoutPreview.emit()"
          >
            @if (layoutPreview(); as preview) {
              @if (preview.url) {
                <img
                  class="layout-preview-pane__image"
                  [src]="preview.url"
                  [attr.alt]="preview.layout"
                />
              } @else {
                <span
                  class="layout-preview-pane__placeholder layout-preview-pane__placeholder--loading"
                  >{{ preview.layout }}</span
                >
              }
              <span class="layout-preview-pane__label">{{
                preview.layout
              }}</span>
            } @else {
              <span class="layout-preview-pane__placeholder">{{
                'SETTINGS.LAYOUTS_PREVIEW_PLACEHOLDER' | translate
              }}</span>
            }
          </div>

          <mat-form-field floatLabel="always" class="layouts-select-field">
            <mat-label>{{ 'SETTINGS.LAYOUTS' | translate }}</mat-label>
            <mat-select
              formControlName="layouts"
              multiple
              panelClass="layout-select-panel"
              (opened)="layoutsSelectOpened.emit()"
              (closed)="layoutsSelectClosed.emit()"
            >
              @for (layout of layouts(); track layout) {
                <mat-option
                  [value]="layout"
                  [disabled]="isLayoutDisabled(layout)"
                  class="layout-select-option"
                  [class.layout-select-option--active]="
                    layoutPreview()?.layout === layout
                  "
                  (mouseenter)="layoutHover.emit(layout)"
                  (pointerdown)="layoutHover.emit(layout)"
                >
                  <span class="layout-option">
                    @if (layoutPreviewUrl(layout); as previewUrl) {
                      <img
                        class="layout-option__thumb"
                        [src]="previewUrl"
                        alt=""
                      />
                    } @else {
                      <span
                        class="layout-option__thumb layout-option__thumb--placeholder"
                        aria-hidden="true"
                      ></span>
                    }
                    <span class="layout-option__label">{{ layout }}</span>
                  </span>
                </mat-option>
              }
            </mat-select>
            <mat-hint class="layouts-select-hint">
              <span class="layouts-select-hint__hover">{{
                'SETTINGS.LAYOUTS_PREVIEW_HINT' | translate
              }}</span>
              <span class="layouts-select-hint__touch">{{
                'SETTINGS.LAYOUTS_PREVIEW_HINT_TOUCH' | translate
              }}</span>
            </mat-hint>
          </mat-form-field>
        </div>

        <mat-form-field floatLabel="always">
          <mat-label>{{ 'SETTINGS.SHUTTER_TIMEOUT' | translate }}</mat-label>
          <input
            matInput
            type="number"
            placeholder="0"
            formControlName="shutterTimeout"
          />
          <span matTextSuffix>s</span>
        </mat-form-field>
      </div>
    </div>
  `,
})
export class SettingsCameraLayoutsComponent {
  readonly settingsForm = input.required<FormGroup>();
  readonly availableCameraNames = input.required<string[]>();
  readonly layouts = input.required<string[]>();
  readonly layoutPreview = input<{ layout: string; url: string } | null>(null);
  readonly layoutPreviewUrls = input.required<Record<string, string>>();
  readonly disabledLayouts = input<Record<string, boolean>>({});
  readonly refreshingTemplates = input(false);

  readonly cycleLayoutPreview = output<void>();
  readonly layoutsSelectOpened = output<void>();
  readonly layoutsSelectClosed = output<void>();
  readonly layoutHover = output<string>();
  readonly refreshTemplates = output<void>();

  layoutPreviewUrl(layout: string): string | null {
    return this.layoutPreviewUrls()[layout] ?? null;
  }

  isLayoutDisabled(layout: string): boolean {
    return this.disabledLayouts()[layout] ?? false;
  }
}
