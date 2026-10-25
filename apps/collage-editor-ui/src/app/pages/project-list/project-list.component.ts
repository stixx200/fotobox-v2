import {
  Component,
  OnInit,
  inject,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { forkJoin } from 'rxjs';
import { CollageEditorApiService } from '../../services/collage-editor-api.service';
import type { CollageEditorProjectSummary } from '../../services/collage-editor-api.service';
import {
  getHostCollageDirectory,
  getStoredCollageDirectory,
  setStoredCollageDirectory,
} from '../../api-config';
import { ApiErrorDescription, describeApiError } from '../../shared/api-error';
import { NotifyService } from '../../shared/notify.service';
import { openConfirmDialog } from '../../shared/confirm-dialog.component';
import { uniqueCopyId } from './unique-copy-id';

@Component({
  selector: 'app-project-list',
  standalone: true,
  imports: [
    DatePipe,
    FormsModule,
    TranslatePipe,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatMenuModule,
    MatProgressBarModule,
    MatToolbarModule,
    MatTooltipModule,
  ],
  templateUrl: './project-list.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './project-list.component.scss',
})
export class ProjectListComponent implements OnInit {
  private api = inject(CollageEditorApiService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private translate = inject(TranslateService);
  private dialog = inject(MatDialog);
  private notify = inject(NotifyService);

  collageDirectory = signal(getStoredCollageDirectory() ?? '');
  projects = signal<CollageEditorProjectSummary[]>([]);
  legacyTemplates = signal<string[]>([]);
  loading = signal(true);
  error = signal<ApiErrorDescription | null>(null);
  /** Project id with a running duplicate/delete request. */
  busyId = signal<string | null>(null);

  ngOnInit(): void {
    const dir =
      this.route.snapshot.queryParamMap.get('dir') ?? getHostCollageDirectory();
    if (dir) {
      this.collageDirectory.set(dir);
      setStoredCollageDirectory(dir);
    }
    this.refresh();
  }

  locale(): string {
    return this.translate.getCurrentLang() || 'de';
  }

  private directory(): string | undefined {
    return this.collageDirectory().trim() || undefined;
  }

  refresh(): void {
    const dir = this.directory();
    if (dir) {
      setStoredCollageDirectory(dir);
    }
    this.loading.set(true);
    this.error.set(null);
    forkJoin({
      projects: this.api.listProjects(dir),
      legacy: this.api.listLegacyTemplates(dir),
    }).subscribe({
      next: ({ projects, legacy }) => {
        this.projects.set(projects);
        this.legacyTemplates.set(legacy);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('[collage-editor] list failed', err);
        this.projects.set([]);
        this.legacyTemplates.set([]);
        this.error.set(describeApiError(err, 'errors.loadListFailed'));
        this.loading.set(false);
      },
    });
  }

  thumbnailUrl(project: { thumbnailBase64?: string | null }): string | null {
    return project.thumbnailBase64
      ? `data:image/jpeg;base64,${project.thumbnailBase64}`
      : null;
  }

  private dirQueryParams(): Record<string, string> {
    const dir = this.directory();
    return dir ? { dir } : {};
  }

  openProject(id: string): void {
    void this.router.navigate(['/editor', id], {
      queryParams: this.dirQueryParams(),
    });
  }

  createNew(): void {
    void this.router.navigate(['/editor'], {
      queryParams: this.dirQueryParams(),
    });
  }

  duplicateProject(project: CollageEditorProjectSummary): void {
    const newId = uniqueCopyId(project.id, [
      ...this.projects().map((p) => p.id),
      ...this.legacyTemplates(),
    ]);
    this.busyId.set(project.id);
    this.api.duplicateProject(project.id, newId, this.directory()).subscribe({
      next: () => {
        this.busyId.set(null);
        this.notify.info('projects.duplicated', {
          name: project.name || project.id,
        });
        this.refresh();
      },
      error: (err) => {
        this.busyId.set(null);
        this.notify.apiError(err, 'errors.duplicateFailed', () =>
          this.duplicateProject(project),
        );
      },
    });
  }

  deleteProject(project: CollageEditorProjectSummary): void {
    const name = project.name || project.id;
    openConfirmDialog(this.dialog, {
      title: 'projects.deleteTitle',
      message: 'projects.deleteConfirm',
      confirm: 'projects.delete',
      params: { name },
      destructive: true,
      icon: 'delete',
    }).subscribe((confirmed) => {
      if (!confirmed) return;
      this.busyId.set(project.id);
      this.api.deleteProject(project.id, this.directory()).subscribe({
        next: () => {
          this.busyId.set(null);
          this.notify.info('projects.deleted', { name });
          this.refresh();
        },
        error: (err) => {
          this.busyId.set(null);
          this.notify.apiError(err, 'errors.deleteFailed');
        },
      });
    });
  }
}
