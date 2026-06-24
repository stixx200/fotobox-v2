import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { CollageEditorApiService } from '../../services/collage-editor-api.service';
import type { CollageEditorProjectSummary } from '../../services/collage-editor-api.service';
import {
  getStoredCollageDirectory,
  setStoredCollageDirectory,
} from '../../api-config';

@Component({
  selector: 'app-project-list',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  templateUrl: './project-list.component.html',
  styleUrl: './project-list.component.scss',
})
export class ProjectListComponent implements OnInit {
  private api = inject(CollageEditorApiService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private translate = inject(TranslateService);

  collageDirectory = signal(getStoredCollageDirectory() ?? '');
  projects = signal<CollageEditorProjectSummary[]>([]);
  legacyTemplates = signal<string[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);

  ngOnInit(): void {
    const dir = this.route.snapshot.queryParamMap.get('dir');
    if (dir) {
      this.collageDirectory.set(dir);
      setStoredCollageDirectory(dir);
    }
    this.refresh();
  }

  refresh(): void {
    const dir = this.collageDirectory().trim() || undefined;
    if (dir) {
      setStoredCollageDirectory(dir);
    }
    this.loading.set(true);
    this.error.set(null);
    this.api.listProjects(dir).subscribe({
      next: (projects) => {
        this.projects.set(projects);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.message ?? 'Failed to load projects');
        this.loading.set(false);
      },
    });
    this.api.listLegacyTemplates(dir).subscribe({
      next: (legacy) => this.legacyTemplates.set(legacy),
      error: () => this.legacyTemplates.set([]),
    });
  }

  thumbnailUrl(project: { thumbnailBase64?: string | null }): string | null {
    return project.thumbnailBase64
      ? `data:image/jpeg;base64,${project.thumbnailBase64}`
      : null;
  }

  openProject(id: string): void {
    void this.router.navigate(['/editor', id], {
      queryParams: this.collageDirectory()
        ? { dir: this.collageDirectory() }
        : {},
    });
  }

  createNew(): void {
    void this.router.navigate(['/editor'], {
      queryParams: this.collageDirectory()
        ? { dir: this.collageDirectory() }
        : {},
    });
  }

  duplicateProject(id: string, event: Event): void {
    event.stopPropagation();
    const newId = `${id}-copy-${Date.now().toString(36)}`;
    this.api
      .duplicateProject(id, newId, this.collageDirectory().trim() || undefined)
      .subscribe({
        next: () => this.refresh(),
        error: (err) => this.error.set(err.message ?? 'Duplicate failed'),
      });
  }

  deleteProject(id: string, event: Event): void {
    event.stopPropagation();
    const message = this.translate.instant('projects.deleteConfirm', { id });
    if (!window.confirm(message)) {
      return;
    }
    this.api
      .deleteProject(id, this.collageDirectory().trim() || undefined)
      .subscribe({
        next: () => this.refresh(),
        error: (err) => this.error.set(err.message ?? 'Delete failed'),
      });
  }
}
