import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  ViewChild,
  computed,
  inject,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import {
  FabricCanvasService,
  AlignMode,
  EditorLayerInfo,
  LayerGroups,
} from '../../services/fabric-canvas.service';
import {
  CollageEditorApiService,
  isCollageTemplateAlreadyExistsError,
} from '../../services/collage-editor-api.service';
import { EditorCanvasToolsComponent } from './components/editor-canvas-tools.component';
import { EditorLayerListComponent } from './components/editor-layer-list.component';
import { EditorProjectPanelComponent } from './components/editor-project-panel.component';
import { EditorValidationPanelComponent } from './components/editor-validation-panel.component';
import {
  EditorToolbarComponent,
  MAX_IMAGE_BYTES,
  SaveState,
  ShapeKind,
} from './components/editor-toolbar.component';
import { ShortcutsDialogComponent } from './components/shortcuts-dialog.component';
import {
  PreviewDialogComponent,
  PreviewDialogData,
  PreviewState,
} from './components/preview-dialog.component';
import { DecorationPresetId } from '../../services/fabric-decorations';
import { ApiErrorDescription, describeApiError } from '../../shared/api-error';
import { NotifyService } from '../../shared/notify.service';
import { openConfirmDialog } from '../../shared/confirm-dialog.component';
import { validationIssueText } from '../../shared/validation-messages';
import {
  isValidTemplateId,
  templateIdFromName,
} from '../../shared/template-id';
import {
  Border,
  BACKGROUND_LAYER_ID,
  ProjectValidationIssue,
  projectHasValidationErrors,
} from '@fotobox/collage-editor/browser';

const DEFAULT_WIDTH = 1796;
const DEFAULT_HEIGHT = 1204;
const DRAFT_KEY = 'collage-editor.draft';

class SaveCancelledError extends Error {
  constructor() {
    super('Save cancelled');
    this.name = 'SaveCancelledError';
  }
}

/** The API rendered no preview (template invalid on the server side). */
class PreviewRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PreviewRejectedError';
  }
}

const TEXT_FONT_OPTIONS = [
  'Arial',
  'Helvetica',
  'Georgia',
  'Times New Roman',
  'Courier New',
  'Verdana',
  'Tahoma',
  'Trebuchet MS',
  'Impact',
  'Palatino Linotype',
  'Lucida Sans Unicode',
] as const;

@Component({
  selector: 'app-editor',
  standalone: true,
  imports: [
    FormsModule,
    TranslatePipe,
    MatButtonModule,
    MatButtonToggleModule,
    MatCheckboxModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTabsModule,
    MatTooltipModule,
    EditorCanvasToolsComponent,
    EditorLayerListComponent,
    EditorProjectPanelComponent,
    EditorToolbarComponent,
    EditorValidationPanelComponent,
  ],
  providers: [FabricCanvasService],
  templateUrl: './editor.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './editor.component.scss',
})
export class EditorComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvasHost') canvasHost!: ElementRef<HTMLCanvasElement>;
  @ViewChild('canvasWrap') canvasWrap!: ElementRef<HTMLElement>;
  @ViewChild('layersSidebar') layersSidebar!: ElementRef<HTMLElement>;
  @ViewChild('layersToggle', { read: ElementRef })
  layersToggle?: ElementRef<HTMLElement>;
  @ViewChild('validationPanel', { read: ElementRef })
  validationPanel?: ElementRef<HTMLElement>;

  private fabric = inject(FabricCanvasService);
  private api = inject(CollageEditorApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private translateService = inject(TranslateService);
  private dialog = inject(MatDialog);
  private notify = inject(NotifyService);

  templateId = signal('');
  templateName = signal('');
  canvasWidth = signal(DEFAULT_WIDTH);
  canvasHeight = signal(DEFAULT_HEIGHT);
  collageDirectory = signal('');
  layerGroups = signal<LayerGroups>({
    background: {
      id: BACKGROUND_LAYER_ID,
      type: 'background',
      label: 'Background',
      name: 'Background',
      locked: false,
      visible: true,
      fixed: true,
      group: 'background',
    },
    decorations: [],
    photos: [],
  });
  activeLayerId = signal<string | null>(null);
  activeLayerType = signal<string | null>(null);
  selectionCount = signal(0);
  layerX = signal(0);
  layerY = signal(0);
  layerWidth = signal(0);
  layerHeight = signal(0);
  editingLayerName = signal('');
  layersSidebarPinned = signal(true);
  layersSidebarOpen = signal(true);
  sidebarTab = signal<'layers' | 'project'>('layers');
  photoBorderTop = signal(4);
  photoBorderBottom = signal(4);
  photoBorderLeft = signal(4);
  photoBorderRight = signal(4);
  photoRotation = signal(0);
  shapeFillColor = signal('#ef4444');
  shapeStrokeColor = signal('#374151');
  shapeStrokeWidth = signal(2);
  shapeRotation = signal(0);
  shapeOpacity = signal(100);
  shapeSupportsFill = signal(true);
  textContent = signal('Text');
  textFontFamily = signal('Arial');
  textFontSize = signal(48);
  textFontWeight = signal('normal');
  textAlign = signal('left');
  textColor = signal('#111827');
  textRotation = signal(0);
  textCharSpacing = signal(0);
  textLineHeight = signal(1.16);
  imageFilename = signal('');
  imageOpacity = signal(100);
  imageFlipX = signal(false);
  imageFlipY = signal(false);
  backgroundColor = signal('#ffffff');
  templateBorderWidth = signal(0);
  templateBorderEnabled = signal(false);
  snapEnabled = signal(true);
  magneticGuidesEnabled = signal(false);
  showGrid = signal(false);
  showGuides = signal(true);
  showSafeArea = signal(false);
  zoomPercent = signal(100);
  loading = signal(false);
  loadError = signal<ApiErrorDescription | null>(null);
  livePreviewError = signal(false);
  /** Canvas or project settings differ from the last save/load. */
  dirty = signal(false);
  validationIssues = signal<ProjectValidationIssue[]>([]);
  previewUrl = signal<string | null>(null);
  previewPinned = signal(false);
  previewUpdating = signal(false);
  saving = signal(false);
  canUndo = signal(false);
  canRedo = signal(false);
  savedOnce = signal(false);

  readonly saveState = computed<SaveState>(() => {
    if (this.saving()) return 'saving';
    if (this.dirty()) return 'dirty';
    return this.savedOnce() ? 'saved' : 'new';
  });

  /** Project fields (id, name, size, folder) changed since the last save. */
  private metaDirty = false;
  /** The operator edited the id by hand – stop deriving it from the name. */
  private idTouched = false;
  private skipUnloadWarning = false;
  private dirtySyncTimer?: ReturnType<typeof setTimeout>;
  private previewState = signal<PreviewState>({ status: 'loading' });
  private templateIdParam: string | null = null;
  private resizeObserver?: ResizeObserver;
  private previewDebounceTimer?: ReturnType<typeof setTimeout>;
  private autoSaveTimer?: ReturnType<typeof setTimeout>;

  ngAfterViewInit(): void {
    const dir = this.route.snapshot.queryParamMap.get('dir');
    if (dir) {
      this.collageDirectory.set(dir);
    }
    this.templateIdParam = this.route.snapshot.paramMap.get('templateId');
    if (this.templateIdParam) {
      this.templateId.set(this.templateIdParam);
      this.templateName.set(this.templateIdParam);
    } else {
      // `get` waits for the translation file when the editor is opened directly.
      this.translateService
        .get('editor.defaultName')
        .subscribe((name: string) => {
          if (this.idTouched || this.savedOnce()) return;
          this.templateName.set(name);
          this.templateId.set(
            `${templateIdFromName(name)}-${Date.now().toString(36)}`,
          );
        });
    }

    this.fabric.setLayerNamer((type, index, fallback, preset) =>
      preset
        ? this.translate(`editor.presetName.${preset}`)
        : (fallback ??
          `${this.translate(`editor.layerType.${type}`)} ${index}`),
    );
    this.fabric.initCanvas(
      this.canvasHost.nativeElement,
      this.canvasWidth(),
      this.canvasHeight(),
    );
    this.fabric.setViewportContainer(this.canvasWrap.nativeElement);
    this.snapEnabled.set(this.fabric.isSnapEnabled());
    this.magneticGuidesEnabled.set(this.fabric.isMagneticGuidesEnabled());
    this.showGrid.set(this.fabric.isShowGrid());
    this.showGuides.set(this.fabric.isShowGuides());
    this.showSafeArea.set(this.fabric.isShowSafeArea());

    const canvas = this.fabric.getCanvas();
    canvas?.on('selection:created', () => this.syncSelection());
    canvas?.on('selection:updated', () => this.syncSelection());
    canvas?.on('selection:cleared', () => {
      if (this.activeLayerId() !== BACKGROUND_LAYER_ID) {
        this.activeLayerType.set(null);
        this.activeLayerId.set(null);
      }
      this.selectionCount.set(0);
    });
    canvas?.on('object:added', () => {
      this.refreshLayers();
      this.onCanvasContentChanged();
    });
    canvas?.on('object:removed', () => {
      this.refreshLayers();
      this.onCanvasContentChanged();
    });
    canvas?.on('object:modified', () => {
      this.syncLayerDetails();
      this.syncStylePanels();
      this.onCanvasContentChanged();
      this.syncHistoryState();
    });
    canvas?.on('object:moving', () => this.syncLayerDetails());
    canvas?.on('object:scaling', () => this.syncLayerDetails());
    canvas?.on('object:rotating', () => {
      this.syncLayerDetails();
      this.syncStylePanels();
    });
    canvas?.on('mouse:dblclick', (opt) => {
      const target = opt.target;
      if (target?.get('fotoboxLayerType') === 'text') {
        this.fabric.enterTextEditMode();
      }
    });
    canvas?.on('mouse:down', () => this.onCanvasInteraction());

    this.fabric.initHistory();
    this.syncHistoryState();
    this.setupViewportFit();

    if (this.templateIdParam) {
      this.loadExisting(this.templateIdParam);
    } else {
      this.loadDraftOrFresh();
      this.refreshLayers();
      this.fitCanvasToViewport();
    }
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    clearTimeout(this.previewDebounceTimer);
    clearTimeout(this.autoSaveTimer);
    clearTimeout(this.dirtySyncTimer);
    this.fabric.dispose();
  }

  /** Browser tab / desktop window closed with unsaved changes. */
  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (!this.skipUnloadWarning && this.hasUnsavedChanges()) {
      event.preventDefault();
      event.returnValue = '';
    }
  }

  translate(key: string, params?: Record<string, unknown>): string {
    return this.translateService.instant(key, params);
  }

  hasUnsavedChanges(): boolean {
    return this.dirty() || this.metaDirty || this.fabric.isDirty();
  }

  private syncDirty(): void {
    this.dirty.set(this.metaDirty || this.fabric.isDirty());
  }

  /** Mark dirty now; re-check once the debounced history snapshot exists. */
  private markDirty(): void {
    this.dirty.set(true);
    clearTimeout(this.dirtySyncTimer);
    this.dirtySyncTimer = setTimeout(() => this.syncDirty(), 600);
  }

  hasSingleLayerSelection(): boolean {
    return (
      !!this.activeLayerId() &&
      this.selectionCount() === 1 &&
      this.activeLayerType() !== 'background'
    );
  }

  showEmptyHint(): boolean {
    const groups = this.layerGroups();
    return (
      !this.loading() &&
      !this.loadError() &&
      groups.photos.length === 0 &&
      groups.decorations.length === 0
    );
  }

  private setupViewportFit(): void {
    const element = this.canvasWrap.nativeElement;
    this.resizeObserver = new ResizeObserver(() => {
      if (this.fabric.getZoomMode() === 'fit') {
        this.fitCanvasToViewport();
      }
    });
    this.resizeObserver.observe(element);
  }

  private fitCanvasToViewport(): void {
    const element = this.canvasWrap?.nativeElement;
    if (!element) return;
    this.fabric.fitToViewport(element);
    this.zoomPercent.set(Math.round(this.fabric.getZoomLevel() * 100));
  }

  private loadDraftOrFresh(): void {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const draft = JSON.parse(raw);
        if (draft?.fabricJson) {
          void this.fabric.loadProject(draft).then(() => {
            this.templateId.set(draft.id ?? this.templateId());
            this.templateName.set(draft.name ?? this.templateName());
            this.idTouched = true;
            this.canvasWidth.set(draft.width ?? DEFAULT_WIDTH);
            this.canvasHeight.set(draft.height ?? DEFAULT_HEIGHT);
            if (draft.border) {
              this.templateBorderEnabled.set(true);
              this.templateBorderWidth.set(draft.border.top ?? 0);
              this.fabric.setProjectBorder(draft.border);
            }
            this.refreshLayers();
            this.fitCanvasToViewport();
            this.notify.info('editor.draftRestored', undefined, {
              label: 'editor.startFresh',
              run: () => this.discardDraft(),
            });
          });
          return;
        }
      }
    } catch {
      /* ignore */
    }
    this.refreshLayers();
  }

  /** Throw away the restored local draft and start with an empty canvas. */
  private discardDraft(): void {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* ignore */
    }
    this.skipUnloadWarning = true;
    window.location.reload();
  }

  private scheduleAutoSave(): void {
    clearTimeout(this.autoSaveTimer);
    this.autoSaveTimer = setTimeout(() => {
      try {
        const project = this.fabric.buildProject(
          this.templateId(),
          this.templateName(),
          this.canvasWidth(),
          this.canvasHeight(),
        );
        localStorage.setItem(DRAFT_KEY, JSON.stringify(project));
      } catch {
        /* ignore */
      }
    }, 2000);
  }

  retryLoad(): void {
    if (this.templateIdParam) {
      this.loadExisting(this.templateIdParam);
    }
  }

  private loadExisting(id: string): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.api.loadProject(id, this.collageDirectory() || undefined).subscribe({
      next: (project) => {
        this.templateId.set(project.id);
        this.templateName.set(project.name ?? project.id);
        this.canvasWidth.set(project.width);
        this.canvasHeight.set(project.height);
        if (project.border) {
          this.templateBorderEnabled.set(true);
          this.templateBorderWidth.set(project.border.top ?? 0);
        }
        this.fabric.loadProject(project).then(
          () => {
            this.refreshLayers();
            this.syncHistoryState();
            this.savedOnce.set(true);
            this.idTouched = true;
            this.fabric.markSaved();
            this.metaDirty = false;
            this.syncDirty();
            this.loading.set(false);
            this.fitCanvasToViewport();
          },
          (err: unknown) => {
            console.error('[collage-editor] invalid project', err);
            this.loading.set(false);
            this.loadError.set({
              key: 'errors.corruptProject',
              retryable: false,
            });
          },
        );
      },
      error: (err) => {
        console.error('[collage-editor] load failed', err);
        this.loading.set(false);
        this.loadError.set(describeApiError(err, 'errors.loadFailed'));
      },
    });
  }

  refreshLayers(): void {
    this.layerGroups.set(this.fabric.getLayerGroups());
    this.backgroundColor.set(this.fabric.getBackgroundColor());
    this.syncSelection();
    this.syncHistoryState();
    this.runValidation();
  }

  runValidation(): void {
    this.validationIssues.set(
      this.fabric.validateProject(
        this.canvasWidth(),
        this.canvasHeight(),
        this.templateId(),
        this.templateName(),
      ),
    );
  }

  syncSelection(): void {
    const objects =
      this.fabric
        .getCanvas()
        ?.getActiveObjects()
        .filter((o) => !o.get('fotoboxEditorOnly')) ?? [];
    if (objects.length === 1) {
      this.activeLayerId.set(this.fabric.getActiveLayerId());
      this.activeLayerType.set(this.fabric.getActiveLayerType());
      const layer = [
        ...this.layerGroups().decorations,
        ...this.layerGroups().photos,
      ].find((l) => l.id === this.activeLayerId());
      this.editingLayerName.set(layer?.name ?? '');
    } else if (this.activeLayerId() !== BACKGROUND_LAYER_ID) {
      this.activeLayerId.set(null);
      this.activeLayerType.set(null);
    }
    this.selectionCount.set(this.fabric.getActiveSelectionCount());
    if (this.activeLayerType() === 'background') {
      this.backgroundColor.set(this.fabric.getBackgroundColor());
      return;
    }
    this.syncLayerDetails();
    this.syncStylePanels();
  }

  syncStylePanels(): void {
    const photo = this.fabric.getActivePhotoStyle();
    if (photo) {
      this.photoBorderTop.set(photo.border.top);
      this.photoBorderBottom.set(photo.border.bottom);
      this.photoBorderLeft.set(photo.border.left);
      this.photoBorderRight.set(photo.border.right);
      this.photoRotation.set(photo.rotation);
    }
    const shape = this.fabric.getActiveShapeStyle();
    if (shape) {
      this.shapeFillColor.set(shape.fillColor);
      this.shapeStrokeColor.set(shape.strokeColor);
      this.shapeStrokeWidth.set(shape.strokeWidth);
      this.shapeRotation.set(shape.rotation);
      this.shapeOpacity.set(shape.opacity);
      this.shapeSupportsFill.set(shape.supportsFill);
    }
    const text = this.fabric.getActiveTextStyle();
    if (text) {
      this.textContent.set(text.content);
      this.textFontFamily.set(text.fontFamily);
      this.textFontSize.set(text.fontSize);
      this.textFontWeight.set(text.fontWeight);
      this.textAlign.set(text.textAlign);
      this.textColor.set(text.fillColor);
      this.textRotation.set(text.rotation);
      this.textCharSpacing.set(text.charSpacing);
      this.textLineHeight.set(text.lineHeight);
    }
    const image = this.fabric.getActiveImageStyle();
    if (image) {
      this.imageFilename.set(image.filename);
      this.imageOpacity.set(image.opacity);
      this.imageFlipX.set(image.flipX);
      this.imageFlipY.set(image.flipY);
    }
  }

  updateBackgroundColor(value: string): void {
    this.backgroundColor.set(value);
    this.fabric.setBackgroundColor(value);
    this.onCanvasContentChanged();
  }

  updateShapeFillColor(value: string): void {
    this.shapeFillColor.set(value);
    this.fabric.updateActiveShapeStyle({ fillColor: value });
    this.onCanvasContentChanged();
  }

  updateShapeStrokeColor(value: string): void {
    this.shapeStrokeColor.set(value);
    this.fabric.updateActiveShapeStyle({ strokeColor: value });
    this.onCanvasContentChanged();
  }

  updateShapeStrokeWidth(value: number): void {
    this.shapeStrokeWidth.set(value);
    this.fabric.updateActiveShapeStyle({ strokeWidth: value });
    this.onCanvasContentChanged();
  }

  updateShapeRotation(value: number): void {
    this.shapeRotation.set(value);
    this.fabric.updateActiveShapeStyle({ rotation: value });
    this.onCanvasContentChanged();
  }

  updateShapeOpacity(value: number): void {
    this.shapeOpacity.set(value);
    this.fabric.updateActiveShapeStyle({ opacity: value });
    this.onCanvasContentChanged();
  }

  updateTextContent(value: string): void {
    this.textContent.set(value);
    this.fabric.updateActiveTextStyle({ content: value });
    this.onCanvasContentChanged();
  }

  updateTextFontFamily(value: string): void {
    this.textFontFamily.set(value);
    this.fabric.updateActiveTextStyle({ fontFamily: value });
    this.onCanvasContentChanged();
  }

  textFontOptionsForSelect(): string[] {
    const current = this.textFontFamily();
    const options: string[] = [...TEXT_FONT_OPTIONS];
    if (current && !options.includes(current)) {
      return [current, ...options];
    }
    return options;
  }

  updateTextFontSize(value: number): void {
    this.textFontSize.set(value);
    this.fabric.updateActiveTextStyle({ fontSize: value });
    this.onCanvasContentChanged();
  }

  updateTextFontWeight(value: string): void {
    this.textFontWeight.set(value);
    this.fabric.updateActiveTextStyle({ fontWeight: value });
    this.onCanvasContentChanged();
  }

  updateTextAlign(value: string): void {
    this.textAlign.set(value);
    this.fabric.updateActiveTextStyle({ textAlign: value });
    this.onCanvasContentChanged();
  }

  updateTextColor(value: string): void {
    this.textColor.set(value);
    this.fabric.updateActiveTextStyle({ fillColor: value });
    this.onCanvasContentChanged();
  }

  updateTextRotation(value: number): void {
    this.textRotation.set(value);
    this.fabric.updateActiveTextStyle({ rotation: value });
    this.onCanvasContentChanged();
  }

  updateTextCharSpacing(value: number): void {
    this.textCharSpacing.set(value);
    this.fabric.updateActiveTextStyle({ charSpacing: value });
    this.onCanvasContentChanged();
  }

  updateTextLineHeight(value: number): void {
    this.textLineHeight.set(value);
    this.fabric.updateActiveTextStyle({ lineHeight: value });
    this.onCanvasContentChanged();
  }

  updateImageOpacity(value: number): void {
    this.imageOpacity.set(value);
    this.fabric.updateActiveImageStyle({ opacity: value });
    this.onCanvasContentChanged();
  }

  updateImageFlipX(value: boolean): void {
    this.imageFlipX.set(value);
    this.fabric.updateActiveImageStyle({ flipX: value });
    this.onCanvasContentChanged();
  }

  updateImageFlipY(value: boolean): void {
    this.imageFlipY.set(value);
    this.fabric.updateActiveImageStyle({ flipY: value });
    this.onCanvasContentChanged();
  }

  onReplaceImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || !this.checkImageFile(file)) return;
    this.fabric
      .replaceActiveImage(file)
      .then(() => {
        this.refreshLayers();
        this.syncStylePanels();
        this.onCanvasContentChanged();
      })
      .catch((err) => this.imageLoadFailed(err, file));
  }

  /** Reject files the browser can't decode or that would bloat the save. */
  private checkImageFile(file: File): boolean {
    if (!file.type.startsWith('image/')) {
      this.notify.error('editor.imageWrongType', { name: file.name });
      return false;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      this.notify.error('editor.imageTooLarge', {
        name: file.name,
        size: Math.round(file.size / 1024 / 1024),
        max: Math.round(MAX_IMAGE_BYTES / 1024 / 1024),
      });
      return false;
    }
    return true;
  }

  private imageLoadFailed(err: unknown, file: File): void {
    console.error('[collage-editor] image load failed', err);
    this.notify.error('editor.imageLoadFailed', { name: file.name });
  }

  syncLayerDetails(): void {
    this.selectionCount.set(this.fabric.getActiveSelectionCount());
    const details = this.fabric.getActiveLayerBounds();
    if (!details) return;
    this.layerX.set(details.x);
    this.layerY.set(details.y);
    this.layerWidth.set(details.width);
    this.layerHeight.set(details.height);
  }

  updateLayerX(value: number): void {
    this.layerX.set(value);
    const id = this.activeLayerId();
    if (id) this.fabric.updateLayerBounds(id, { x: value });
    this.onCanvasContentChanged();
  }

  updateLayerY(value: number): void {
    this.layerY.set(value);
    const id = this.activeLayerId();
    if (id) this.fabric.updateLayerBounds(id, { y: value });
    this.onCanvasContentChanged();
  }

  updateLayerWidth(value: number): void {
    this.layerWidth.set(value);
    const id = this.activeLayerId();
    if (id) this.fabric.updateLayerBounds(id, { width: value });
    this.onCanvasContentChanged();
  }

  updateLayerHeight(value: number): void {
    this.layerHeight.set(value);
    const id = this.activeLayerId();
    if (id) this.fabric.updateLayerBounds(id, { height: value });
    this.onCanvasContentChanged();
  }

  updateLayerName(value: string): void {
    this.editingLayerName.set(value);
    const id = this.activeLayerId();
    if (id) {
      this.fabric.setLayerName(id, value);
      this.refreshLayers();
      this.onCanvasContentChanged();
    }
  }

  toggleLayerLocked(layer: EditorLayerInfo): void {
    this.fabric.setLayerLocked(layer.id, !layer.locked);
    this.refreshLayers();
    this.onCanvasContentChanged();
  }

  toggleLayerVisible(layer: EditorLayerInfo): void {
    this.fabric.setLayerVisible(layer.id, !layer.visible);
    this.refreshLayers();
    this.onCanvasContentChanged();
  }

  duplicateLayer(layer: EditorLayerInfo): void {
    this.fabric.duplicateLayerById(layer.id);
    this.refreshLayers();
    this.onCanvasContentChanged();
  }

  onDecorationDrop(event: CdkDragDrop<EditorLayerInfo[]>): void {
    const decorations = [...this.layerGroups().decorations];
    moveItemInArray(decorations, event.previousIndex, event.currentIndex);
    this.fabric.reorderDecorationsTopFirst(decorations.map((d) => d.id));
    this.refreshLayers();
    this.onCanvasContentChanged();
  }

  alignSelection(mode: AlignMode): void {
    this.fabric.alignActiveObjects(mode);
    this.syncLayerDetails();
    this.onCanvasContentChanged();
  }

  distributeHorizontal(): void {
    this.fabric.distributeActiveObjects('horizontal');
    this.syncLayerDetails();
    this.onCanvasContentChanged();
  }

  distributeVertical(): void {
    this.fabric.distributeActiveObjects('vertical');
    this.syncLayerDetails();
    this.onCanvasContentChanged();
  }

  layerReorderForward(layerId: string): void {
    this.fabric.bringDecorationForward(layerId);
    this.refreshLayers();
    this.onCanvasContentChanged();
  }

  layerReorderBackward(layerId: string): void {
    this.fabric.sendDecorationBackward(layerId);
    this.refreshLayers();
    this.onCanvasContentChanged();
  }

  deleteLayer(layerId: string): void {
    this.fabric.deleteLayerById(layerId);
    this.refreshLayers();
    this.onCanvasContentChanged();
  }

  layersSidebarVisible(): boolean {
    return this.layersSidebarPinned() || this.layersSidebarOpen();
  }

  toggleLayersSidebar(event: Event): void {
    event.stopPropagation();
    this.layersSidebarOpen.set(true);
  }

  toggleLayersPinned(): void {
    const pinned = !this.layersSidebarPinned();
    this.layersSidebarPinned.set(pinned);
    if (pinned) {
      this.layersSidebarOpen.set(true);
    }
  }

  closeLayersSidebar(): void {
    if (!this.layersSidebarPinned()) {
      this.layersSidebarOpen.set(false);
    }
  }

  undo(): void {
    void this.fabric.undo().then(() => {
      this.refreshLayers();
      this.onCanvasContentChanged();
      this.syncDirty();
    });
  }

  redo(): void {
    void this.fabric.redo().then(() => {
      this.refreshLayers();
      this.onCanvasContentChanged();
      this.syncDirty();
    });
  }

  zoomFit(): void {
    this.fitCanvasToViewport();
  }

  zoom100(): void {
    this.fabric.zoomTo100();
    this.zoomPercent.set(100);
  }

  zoomIn(): void {
    this.fabric.zoomIn();
    this.zoomPercent.set(Math.round(this.fabric.getZoomLevel() * 100));
  }

  zoomOut(): void {
    this.fabric.zoomOut();
    this.zoomPercent.set(Math.round(this.fabric.getZoomLevel() * 100));
  }

  setSnapEnabled(value: boolean): void {
    this.snapEnabled.set(value);
    this.fabric.setSnapEnabled(value);
  }

  setMagneticGuidesEnabled(value: boolean): void {
    this.magneticGuidesEnabled.set(value);
    this.fabric.setMagneticGuidesEnabled(value);
  }

  setShowGrid(value: boolean): void {
    this.showGrid.set(value);
    this.fabric.setShowGrid(value);
  }

  setShowGuides(value: boolean): void {
    this.showGuides.set(value);
    this.fabric.setShowGuides(value);
  }

  setShowSafeArea(value: boolean): void {
    this.showSafeArea.set(value);
    this.fabric.setShowSafeArea(value);
  }

  applyPhotoBorder(): void {
    const border: Border = {
      background: { r: 255, g: 255, b: 255 },
      top: this.photoBorderTop(),
      bottom: this.photoBorderBottom(),
      left: this.photoBorderLeft(),
      right: this.photoBorderRight(),
    };
    this.fabric.updateActivePhotoStyle({ border });
    this.onCanvasContentChanged();
  }

  updatePhotoRotation(value: number): void {
    this.photoRotation.set(value);
    this.fabric.updateActivePhotoStyle({ rotation: value });
    this.onCanvasContentChanged();
  }

  applyTemplateBorder(): void {
    if (!this.templateBorderEnabled()) {
      this.fabric.setProjectBorder(undefined);
      this.onCanvasContentChanged();
      return;
    }
    const w = this.templateBorderWidth();
    const border: Border = {
      background: { r: 255, g: 255, b: 255 },
      top: w,
      bottom: w,
      left: w,
      right: w,
    };
    this.fabric.setProjectBorder(border);
    this.onCanvasContentChanged();
  }

  onTemplateBorderEnabledChange(enabled: boolean): void {
    this.templateBorderEnabled.set(enabled);
    this.applyTemplateBorder();
  }

  @HostListener('document:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    // Dialogs (confirmations, preview, shortcuts) own the keyboard.
    if (
      this.isEditableTarget(event.target) ||
      this.dialog.openDialogs.length > 0
    ) {
      return;
    }
    const mod = event.metaKey || event.ctrlKey;

    if (!mod && event.key === '?') {
      event.preventDefault();
      this.openShortcuts();
      return;
    }
    if (!mod && event.key === 'Escape') {
      this.clearCanvasSelection();
      return;
    }
    if (mod && event.key === 's') {
      event.preventDefault();
      void this.save(false);
      return;
    }
    if (mod && event.key === 'd') {
      event.preventDefault();
      this.fabric.duplicateActive();
      this.refreshLayers();
      this.onCanvasContentChanged();
      return;
    }
    if (!mod && (event.key === 'Delete' || event.key === 'Backspace')) {
      event.preventDefault();
      this.fabric.deleteActive();
      this.refreshLayers();
      this.onCanvasContentChanged();
      return;
    }
    if (!mod && event.key.startsWith('Arrow')) {
      event.preventDefault();
      const step = event.shiftKey ? 10 : 1;
      const dx =
        event.key === 'ArrowLeft'
          ? -step
          : event.key === 'ArrowRight'
            ? step
            : 0;
      const dy =
        event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0;
      this.fabric.nudgeActive(dx, dy);
      this.syncLayerDetails();
      this.onCanvasContentChanged();
      return;
    }
    if (!mod) return;
    if (event.key === 'z' && !event.shiftKey) {
      event.preventDefault();
      this.undo();
      return;
    }
    if (event.key === 'y' || (event.key === 'z' && event.shiftKey)) {
      event.preventDefault();
      this.redo();
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    // Clicks inside the layers sidebar are ignored entirely. The composed path
    // is captured at dispatch time, so it still matches when the click removed
    // its target from the DOM (e.g. deleting a layer row).
    if (this.isEventWithin(event, this.layersSidebar?.nativeElement)) {
      return;
    }

    if (
      !this.layersSidebarPinned() &&
      this.layersSidebarOpen() &&
      !this.isEventWithin(event, this.layersToggle?.nativeElement)
    ) {
      this.layersSidebarOpen.set(false);
    }

    this.clearSelectionIfOutsideCanvas(event.target as Node);
  }

  private isEventWithin(
    event: Event,
    element: HTMLElement | undefined,
  ): boolean {
    return !!element && event.composedPath().includes(element);
  }

  private clearSelectionIfOutsideCanvas(target: Node): void {
    const canvasContainer =
      this.canvasWrap?.nativeElement.querySelector('.canvas-container');
    if (canvasContainer?.contains(target)) {
      return;
    }
    if (this.isEditableTarget(target)) {
      return;
    }
    this.clearCanvasSelection();
  }

  private clearCanvasSelection(): void {
    if (!this.fabric.getActiveSelectionCount() && !this.activeLayerId()) {
      return;
    }
    this.fabric.discardSelection();
    this.activeLayerId.set(null);
    this.activeLayerType.set(null);
    this.selectionCount.set(0);
  }

  private onCanvasInteraction(): void {
    if (!this.layersSidebarPinned() && this.layersSidebarOpen()) {
      this.layersSidebarOpen.set(false);
    }
  }

  private syncHistoryState(): void {
    this.canUndo.set(this.fabric.canUndo());
    this.canRedo.set(this.fabric.canRedo());
  }

  private isEditableTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) {
      return false;
    }
    const tag = target.tagName;
    return (
      tag === 'INPUT' ||
      tag === 'TEXTAREA' ||
      tag === 'SELECT' ||
      target.isContentEditable
    );
  }

  addPhotoPane(): void {
    this.fabric.addPhotoPane();
    this.refreshLayers();
    this.onCanvasContentChanged();
  }

  addText(): void {
    this.fabric.addText(this.translate('editor.defaultText'));
    this.refreshLayers();
    this.onCanvasContentChanged();
  }

  addShapeKind(kind: ShapeKind): void {
    switch (kind) {
      case 'ellipse':
        this.addEllipse();
        break;
      case 'circle':
        this.addCircle();
        break;
      case 'roundedRect':
        this.addRoundedRect();
        break;
      case 'line':
        this.addLine();
        break;
      default:
        this.addShape();
    }
    this.onCanvasContentChanged();
  }

  addImage(file: File): void {
    if (!this.checkImageFile(file)) return;
    this.fabric
      .addImageFromFile(file)
      .then(() => {
        this.refreshLayers();
        this.onCanvasContentChanged();
      })
      .catch((err) => this.imageLoadFailed(err, file));
  }

  addShape(): void {
    this.fabric.addShape();
    this.refreshLayers();
  }

  addEllipse(): void {
    this.fabric.addEllipse();
    this.refreshLayers();
  }

  addCircle(): void {
    this.fabric.addCircle();
    this.refreshLayers();
  }

  addRoundedRect(): void {
    this.fabric.addRoundedRect();
    this.refreshLayers();
  }

  addLine(): void {
    this.fabric.addLine();
    this.refreshLayers();
  }

  addDecoration(preset: DecorationPresetId): void {
    this.fabric.addDecorationPreset(preset);
    this.refreshLayers();
    this.onCanvasContentChanged();
  }

  selectLayer(layerId: string, event?: Event): void {
    event?.stopPropagation();
    if (layerId === BACKGROUND_LAYER_ID) {
      this.fabric.selectLayerById(layerId);
      this.activeLayerId.set(BACKGROUND_LAYER_ID);
      this.activeLayerType.set('background');
      this.selectionCount.set(0);
      this.backgroundColor.set(this.fabric.getBackgroundColor());
      return;
    }
    this.fabric.selectLayerById(layerId);
    this.syncSelection();
  }

  resizeCanvas(): void {
    const canvas = this.fabric.getCanvas();
    canvas?.setDimensions({
      width: this.canvasWidth(),
      height: this.canvasHeight(),
    });
    canvas?.requestRenderAll();
    this.fabric.setShowGrid(this.showGrid());
    this.fitCanvasToViewport();
    // The canvas size is not part of the undo history.
    this.metaDirty = true;
    this.onCanvasContentChanged();
  }

  // ---------------------------------------------------------------------------
  // Navigation & project settings

  goBack(): void {
    void this.router.navigate(['/'], {
      queryParams: this.collageDirectory()
        ? { dir: this.collageDirectory() }
        : {},
    });
  }

  showProjectTab(): void {
    this.sidebarTab.set('project');
    this.layersSidebarOpen.set(true);
  }

  onTemplateNameChange(name: string): void {
    this.templateName.set(name);
    // New templates: keep the folder id in sync with the name until the
    // operator edits the id or the template was saved once.
    if (!this.idTouched && !this.savedOnce()) {
      const derived = templateIdFromName(name);
      if (derived) {
        this.templateId.set(derived);
      }
    }
    this.onMetaChanged();
  }

  onTemplateIdChange(id: string): void {
    this.idTouched = true;
    this.templateId.set(id);
    this.onMetaChanged();
  }

  onCollageDirectoryChange(dir: string): void {
    this.collageDirectory.set(dir);
    this.onMetaChanged();
  }

  private onMetaChanged(): void {
    this.metaDirty = true;
    this.dirty.set(true);
    this.runValidation();
    this.scheduleAutoSave();
  }

  // ---------------------------------------------------------------------------
  // Dialogs

  openShortcuts(): void {
    if (this.dialog.openDialogs.length) return;
    this.dialog.open(ShortcutsDialogComponent, {
      autoFocus: 'dialog',
      restoreFocus: true,
    });
  }

  /** Bring the validation list into view (e.g. after a blocked save). */
  showIssues(): void {
    this.sidebarTab.set('layers');
    this.layersSidebarOpen.set(true);
    setTimeout(() =>
      this.validationPanel?.nativeElement.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      }),
    );
  }

  setPreviewPinned(pinned: boolean): void {
    this.previewPinned.set(pinned);
    if (pinned) {
      void this.refreshLivePreview();
    }
  }

  /** Explicit preview: render on the server and show it in a dialog. */
  openPreview(): void {
    const data: PreviewDialogData = {
      state: this.previewState.asReadonly(),
      retry: () => void this.renderPreviewIntoDialog(ref.close.bind(ref)),
    };
    const ref = this.dialog.open(PreviewDialogComponent, {
      data,
      autoFocus: 'dialog',
      restoreFocus: true,
      maxWidth: '90vw',
    });
    void this.renderPreviewIntoDialog(() => ref.close());
  }

  private async renderPreviewIntoDialog(close: () => void): Promise<void> {
    this.previewState.set({ status: 'loading' });
    try {
      const url = await this.renderPreview();
      this.previewUrl.set(url);
      this.previewState.set({ status: 'ready', url });
    } catch (err) {
      if (err instanceof SaveCancelledError) {
        close();
        return;
      }
      console.error('[collage-editor] preview failed', err);
      const described =
        err instanceof PreviewRejectedError
          ? { key: 'editor.previewInvalid', params: { message: err.message } }
          : describeApiError(err, 'errors.previewFailed');
      this.previewState.set({
        status: 'error',
        key: described.key,
        params: described.params,
      });
    }
  }

  private async refreshLivePreview(): Promise<void> {
    this.previewUpdating.set(true);
    try {
      this.previewUrl.set(await this.renderPreview());
      this.livePreviewError.set(false);
    } catch (err) {
      if (!(err instanceof SaveCancelledError)) {
        console.error('[collage-editor] live preview failed', err);
        this.livePreviewError.set(true);
      }
    } finally {
      this.previewUpdating.set(false);
    }
  }

  private onCanvasContentChanged(): void {
    this.syncHistoryState();
    this.runValidation();
    this.scheduleAutoSave();
    this.markDirty();
    if (!this.previewPinned()) return;
    clearTimeout(this.previewDebounceTimer);
    this.previewDebounceTimer = setTimeout(
      () => void this.refreshLivePreview(),
      600,
    );
  }

  /**
   * The API renders previews from the saved template, so a preview writes the
   * template first. A new template never silently overwrites an existing
   * folder – the overwrite confirmation is shown like for a normal save.
   */
  private async renderPreview(): Promise<string> {
    const project = this.fabric.buildProject(
      this.templateId(),
      this.templateName(),
      this.canvasWidth(),
      this.canvasHeight(),
    );
    const background = await this.fabric.exportBackgroundJpeg();
    await this.saveInternal(project, background, this.savedOnce());
    // The preview wrote the current state to disk – reflect that.
    this.fabric.markSaved();
    this.metaDirty = false;
    this.savedOnce.set(true);
    this.idTouched = true;
    this.syncDirty();
    const result = await firstValueFrom(
      this.api.validateTemplate(
        this.templateId(),
        this.collageDirectory() || undefined,
      ),
    );
    if (!result.valid || !result.previewBase64) {
      throw new PreviewRejectedError(result.message ?? '');
    }
    return `data:image/jpeg;base64,${result.previewBase64}`;
  }

  // ---------------------------------------------------------------------------
  // Save

  async save(navigateAway = true): Promise<void> {
    if (this.saving()) return;
    if (!isValidTemplateId(this.templateId())) {
      this.notify.error('editor.projectIdInvalid', undefined, {
        label: 'editor.editProject',
        run: () => this.showProjectTab(),
      });
      this.showProjectTab();
      return;
    }
    const issues = this.fabric.validateProject(
      this.canvasWidth(),
      this.canvasHeight(),
      this.templateId(),
      this.templateName(),
    );
    this.validationIssues.set(issues);
    if (projectHasValidationErrors(issues)) {
      const first = issues.find((i) => i.severity === 'error');
      const text = first ? validationIssueText(first) : null;
      this.notify.error(
        'editor.saveBlocked',
        { reason: text ? this.translate(text.key, text.params) : '' },
        { label: 'editor.showIssues', run: () => this.showIssues() },
      );
      this.showIssues();
      return;
    }

    this.saving.set(true);
    try {
      const project = this.fabric.buildProject(
        this.templateId(),
        this.templateName(),
        this.canvasWidth(),
        this.canvasHeight(),
      );
      const background = await this.fabric.exportBackgroundJpeg();
      await this.saveInternal(project, background, this.savedOnce());
      this.fabric.markSaved();
      this.metaDirty = false;
      this.savedOnce.set(true);
      this.idTouched = true;
      this.syncDirty();
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {
        /* ignore */
      }
      this.notify.info('editor.savedNamed', { name: this.templateName() });
      if (navigateAway) {
        this.goBack();
      }
    } catch (err) {
      if (err instanceof SaveCancelledError) {
        return;
      }
      this.notify.apiError(
        err,
        'errors.saveFailed',
        () => void this.save(navigateAway),
      );
    } finally {
      this.saving.set(false);
    }
  }

  private saveInternal(
    project: ReturnType<FabricCanvasService['buildProject']>,
    background: string,
    overwrite: boolean,
  ): Promise<void> {
    return this.attemptSave(project, background, overwrite).catch(
      async (err) => {
        if (overwrite || !isCollageTemplateAlreadyExistsError(err)) {
          throw err;
        }
        const confirmed = await firstValueFrom(
          openConfirmDialog(this.dialog, {
            title: 'editor.overwriteTitle',
            message: 'editor.overwriteConfirm',
            confirm: 'editor.overwrite',
            params: { id: project.id },
            destructive: true,
            icon: 'warning',
          }),
        );
        if (!confirmed) {
          throw new SaveCancelledError();
        }
        return this.attemptSave(project, background, true);
      },
    );
  }

  private attemptSave(
    project: ReturnType<FabricCanvasService['buildProject']>,
    background: string,
    overwrite: boolean,
  ): Promise<void> {
    const assets = this.fabric.collectImageAssets();
    return firstValueFrom(
      this.api.saveProject({
        project,
        backgroundBase64: background,
        assets,
        collageDirectory: this.collageDirectory() || undefined,
        overwrite,
      }),
    ).then(() => undefined);
  }
}
