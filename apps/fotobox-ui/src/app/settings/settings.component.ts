import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import {
  FormControl,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
} from '@angular/forms';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { MatButton } from '@angular/material/button';
import { CommonModule } from '@angular/common';
import { SettingsService } from '../services/settings.service';
import { AppMetadataService } from '../services/app-metadata.service';
import { CameraService } from '../services/camera.service';

/** @title Form field with label */
@Component({
  selector: 'app-settings',
  templateUrl: 'settings.component.html',
  styleUrl: 'settings.component.scss',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatCheckboxModule,
    MatRadioModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatIconModule,
    MatButton,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsComponent implements OnInit {
  private settingsService = inject(SettingsService);
  private appMetadataService = inject(AppMetadataService);
  private cameraService = inject(CameraService);

  appVersion$ = this.appMetadataService.getAppVersion();
  availableCameras$ = this.cameraService.getAvailableCameras();

  readonly settingsForm = new FormGroup(
    {
      shutterTimeout: new FormControl(5),
      usePrinter: new FormControl(true),
      printerName: new FormControl('printer1'),
      photoDirectory: new FormControl(''),
      collageDirectory: new FormControl(''),
      layouts: new FormControl([]),
      camera: new FormControl(''),
    },
    {}
  );

  layouts = ['Einzelbild', 'Collage'];
  cameras = ['Sony', 'Demo'];

  ngOnInit(): void {
    // Load settings from GraphQL
    this.settingsService.getAllSettings().subscribe({
      next: (settings) => {
        settings.forEach((setting) => {
          const control = this.settingsForm.get(setting.key);
          if (control) {
            control.setValue(JSON.parse(setting.value));
          }
        });
      },
      error: (error) => {
        console.error('Error loading settings:', error);
      },
    });
  }

  saveSettings(): void {
    const formValue = this.settingsForm.value;
    const settingsArray = Object.entries(formValue).map(([key, value]) => ({
      key,
      value: JSON.stringify(value),
    }));

    this.settingsService.updateSettings(settingsArray).subscribe({
      next: () => {
        console.log('Settings saved successfully');
      },
      error: (error) => {
        console.error('Error saving settings:', error);
      },
    });
  }

  resetSettings(): void {
    this.settingsService.resetSettings().subscribe({
      next: (result) => {
        console.log(result.message);
        // Reload settings after reset
        this.ngOnInit();
      },
      error: (error) => {
        console.error('Error resetting settings:', error);
      },
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  openPicker(target: EventTarget | null): void {
    // TODO: Implement file/folder picker dialog
    console.debug('File picker not yet implemented');
  }
}
