import { Component, input, output } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-settings-share-gallery',
  standalone: true,
  styleUrl: '../settings-panel.shared.scss',
  imports: [
    ReactiveFormsModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    TranslatePipe,
  ],
  template: `
  <div class="settings-share-gallery-stack" [formGroup]="settingsForm()">
  <div
    class="settings-card settings-card--expandable settings-card--accent"
    [class.is-expanded]="shareExpanded()"
  >
    <button
      type="button"
      class="card-header card-header--toggle"
      (click)="shareToggle.emit()"
      [attr.aria-expanded]="shareExpanded()"
      [attr.aria-label]="
        (shareExpanded()
          ? 'SETTINGS.COLLAPSE_SECTION'
          : 'SETTINGS.EXPAND_SECTION'
        ) | translate
      "
    >
      <mat-icon>qr_code_2</mat-icon>
      <span class="card-header-title">{{
        'SETTINGS.SHARE_TITLE' | translate
      }}</span>
      <span class="card-header-badge">{{ shareStatusLabel() }}</span>
      <mat-icon class="card-header-chevron">expand_more</mat-icon>
    </button>

    @if (shareExpanded()) {
      <div class="card-body share-settings-body">
        <mat-checkbox class="share-enable-checkbox" formControlName="useShare">{{
          'SETTINGS.USE_SHARE' | translate
        }}</mat-checkbox>

        @if (settingsForm().controls['useShare'].value) {
          <div class="share-settings-details">
            <div>
              <p class="settings-hint">
                {{ 'SETTINGS.SHARE_DETECTED_URL' | translate }}
              </p>
              <p class="settings-detected-url">{{ detectedShareBaseUrl() }}</p>
            </div>

            <div class="share-field-group">
              <mat-form-field floatLabel="always" subscriptSizing="dynamic">
                <mat-label>{{ 'SETTINGS.SHARE_BASE_URL' | translate }}</mat-label>
                <input
                  matInput
                  formControlName="shareBaseUrl"
                  [placeholder]="
                    'SETTINGS.SHARE_BASE_URL_PLACEHOLDER' | translate
                  "
                />
              </mat-form-field>
              <p class="settings-field-hint">
                {{ 'SETTINGS.SHARE_BASE_URL_HINT' | translate }}
              </p>
            </div>

            <div class="share-field-group share-field-group--compact">
              <mat-form-field floatLabel="always" subscriptSizing="dynamic">
                <mat-label>{{
                  'SETTINGS.SHARE_TOKEN_EXPIRY' | translate
                }}</mat-label>
                <input
                  matInput
                  type="number"
                  min="1"
                  formControlName="shareTokenExpiryHours"
                />
                <span matTextSuffix>{{
                  'SETTINGS.SHARE_TOKEN_EXPIRY_SUFFIX' | translate
                }}</span>
              </mat-form-field>
              <p class="settings-field-hint">
                {{ 'SETTINGS.SHARE_TOKEN_EXPIRY_HINT' | translate }}
              </p>
            </div>
          </div>
        }
      </div>
    }
  </div>

  <div
    class="settings-card settings-card--expandable settings-card--accent"
    [class.is-expanded]="galleryExpanded()"
  >
    <button
      type="button"
      class="card-header card-header--toggle"
      (click)="galleryToggle.emit()"
      [attr.aria-expanded]="galleryExpanded()"
      [attr.aria-label]="
        (galleryExpanded()
          ? 'SETTINGS.COLLAPSE_SECTION'
          : 'SETTINGS.EXPAND_SECTION'
        ) | translate
      "
    >
      <mat-icon>photo_library</mat-icon>
      <span class="card-header-title">{{
        'SETTINGS.GALLERY' | translate
      }}</span>
      <span class="card-header-badge">{{ galleryStatusLabel() }}</span>
      <mat-icon class="card-header-chevron">expand_more</mat-icon>
    </button>

    @if (galleryExpanded()) {
      <div class="card-body">
        <mat-checkbox formControlName="showGalleryButton">{{
          'SETTINGS.SHOW_GALLERY_BUTTON' | translate
        }}</mat-checkbox>
        <p class="settings-field-hint settings-field-hint--inline">
          {{ 'SETTINGS.SHOW_GALLERY_BUTTON_HINT' | translate }}
        </p>

        <mat-form-field floatLabel="always">
          <mat-label>{{ 'SETTINGS.GALLERY' | translate }}</mat-label>
          <input
            matInput
            type="password"
            formControlName="galleryPassword"
            [attr.maxlength]="galleryPinLength()"
            inputmode="numeric"
            pattern="[0-9]*"
            autocomplete="off"
            class="gallery-pin-input"
            (input)="galleryPinInput.emit($event)"
          />
          <mat-hint>{{ 'SETTINGS.GALLERY_PIN_HINT' | translate }}</mat-hint>
          @if (
            settingsForm().controls['galleryPassword'].touched &&
            settingsForm().controls['galleryPassword'].hasError('galleryPin')
          ) {
            <mat-error>{{
              'SETTINGS.GALLERY_PIN_INVALID' | translate
            }}</mat-error>
          }
        </mat-form-field>
      </div>
    }
  </div>
  </div>
  `,
})
export class SettingsShareGalleryComponent {
  readonly settingsForm = input.required<FormGroup>();
  readonly shareExpanded = input.required<boolean>();
  readonly galleryExpanded = input.required<boolean>();
  readonly shareStatusLabel = input.required<string>();
  readonly galleryStatusLabel = input.required<string>();
  readonly detectedShareBaseUrl = input.required<string>();
  readonly galleryPinLength = input.required<number>();

  readonly shareToggle = output<void>();
  readonly galleryToggle = output<void>();
  readonly galleryPinInput = output<Event>();
}
