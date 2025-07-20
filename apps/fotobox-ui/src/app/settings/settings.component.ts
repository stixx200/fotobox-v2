import { ChangeDetectionStrategy, Component } from '@angular/core';
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

/** @title Form field with label */
@Component({
  selector: 'app-settings',
  templateUrl: 'settings.component.html',
  styleUrl: 'settings.component.scss',
  standalone: true,
  imports: [
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
export class SettingsComponent {
  protected readonly settingsForm = new FormGroup(
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  openPicker(target: EventTarget | null): void {
    // TODO: Implement file/folder picker dialog
    console.debug('File picker not yet implemented');
  }
}
