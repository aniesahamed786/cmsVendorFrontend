import { Component, inject, OnInit, signal, computed, AfterViewInit, OnDestroy, ElementRef, ViewChild, NgZone, effect } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PrimeUIModules } from '../../../../core/prime.import';
import { BranchesService, BranchKPIs, TopPerformer, BranchRow } from '../../services/branches.service';
import { Button } from '../../../../shared/Components/button/button';
import { AppSearch } from '../../../../shared/Components/app-search/app-search';
import { AppBottomSheet } from '../../../../shared/Components/app-bottom-sheet/app-bottom-sheet';
import { ThemeService } from '../../../../shared/services/theme.service';
import { environment } from '../../../../../environments/environment';
import { I18nService } from '../../../../shared/i18n/i18n.service';
import { TranslatePipe } from '../../../../shared/i18n/translate.pipe';
import { createCountUp } from '../../../../shared/animation/count-up';
import { importLibrary, setOptions } from '@googlemaps/js-api-loader';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-branches-page',
  standalone: true,
  imports: [CommonModule, PrimeUIModules, FormsModule, Button, AppSearch, AppBottomSheet, TranslatePipe, RouterLink],
  templateUrl: './branches-page.html',
  styleUrl: './branches-page.scss'
})
export class BranchesPage implements OnInit, AfterViewInit, OnDestroy {
  private readonly branchesService = inject(BranchesService);
  private readonly document = inject(DOCUMENT);
  private readonly themeService = inject(ThemeService);
  private readonly zone = inject(NgZone);
  private readonly i18n = inject(I18nService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  kpis = signal<BranchKPIs | null>(null);
  topPerformers = signal<TopPerformer[]>([]);
  allBranches = signal<BranchRow[]>([]);

  // Explicit flags, not `length === 0`: an empty array is the loaded-but-empty
  // state too, and the table has its own emptymessage template for that.
  performersLoading = signal(true);
  branchesLoading = signal(true);

  // Table filters
  selectedStatus = signal<string | null>(null);
  selectedRegion = signal<string | null>(null);
  selectedManager = signal<string | null>(null);
  searchQuery = signal<string>('');
  showMobileFilters = signal(false);

  readonly activeFilterCount = computed(() => {
    let count = 0;
    if (this.selectedStatus()) count++;
    if (this.selectedRegion()) count++;
    if (this.selectedManager()) count++;
    return count;
  });

  clearFilters(): void {
    this.selectedStatus.set(null);
    this.selectedRegion.set(null);
    this.selectedManager.set(null);
  }

  // Sort
  sortField = signal<keyof BranchRow | null>('locationName');
  sortOrder = signal<1 | -1>(-1); // Newest first by default

  // Options — labels are translated, values stay the English data keys.
  readonly statusOptions = computed(() => [
    { label: this.i18n.t('branches.status.all'), value: null },
    { label: this.i18n.t('branches.status.active'), value: 'Active' },
    { label: this.i18n.t('branches.status.inactive'), value: 'Inactive' },
  ]);

  readonly regionOptions = computed(() => [
    { label: this.i18n.t('branches.region.all'), value: null },
    ...(['East', 'West', 'South', 'North', 'Central'] as const).map((r) => ({
      label: this.i18n.t(`branches.region.${r.toLowerCase()}`),
      value: r as string,
    })),
  ]);

  // Manager names come from the data, so only the "all" entry is translated.
  readonly managerOptions = computed(() => [
    { label: this.i18n.t('branches.manager.all'), value: null as string | null },
    ...Array.from(new Set(this.allBranches().map((b) => b.representativeName).filter(Boolean))).map((m) => ({
      label: m,
      value: m as string | null,
    })),
  ]);

  // Map state
  isMapLoading = false;
  mapError: string | null = null;
  private map: any | null = null;
  private markers: any[] = [];
  private resizeObserver: ResizeObserver | null = null;
  private pendingRender = false;
  private mapsInitPromise: Promise<void> | null = null;
  private zoomListener: any | null = null;
  private mapContainer?: ElementRef<HTMLElement>;

  debug = { scriptLoaded: false, mapsAvailable: false, mapCreated: false };

  readonly selectedRow = signal<{ locationId: string } | null>(null);

  readonly rowActions = computed(() => {
    this.i18n.loadSeq();
    const row = this.selectedRow();
    return [
      {
        label: this.i18n.t('branchActions.action.viewBranch'),
        icon: 'pi pi-eye',
        command: () => {
          if (row) this.router.navigate(['view', row.locationId], { relativeTo: this.route });
        },
      },
      {
        label: this.i18n.t('branchActions.action.requestChanges'),
        icon: 'pi pi-arrows-v',
        command: () => {
          if (row) this.router.navigate(['edit', row.locationId], { relativeTo: this.route });
        },
      },
    ];
  });

  @ViewChild('mapContainer')
  set mapContainerRef(ref: ElementRef<HTMLElement> | undefined) {
    this.mapContainer = ref;
    if (ref) {
      this.prepareMapContainer();
      this.ensureMapReady();
    }
  }

  readonly filteredBranches = computed(() => {
    let rows = this.allBranches();

    const status = this.selectedStatus();
    if (status) rows = rows.filter(r => r.status === status);

    const region = this.selectedRegion();
    // if (region) rows = rows.filter(r => r.region === region);

    const manager = this.selectedManager();
    if (manager) rows = rows.filter(r => r.representativeName === manager);

    const search = this.searchQuery().toLowerCase().trim();
    if (search) {
      rows = rows.filter(r => 
          r.locationName.toLowerCase().includes(search) ||
          r.city.toLowerCase().includes(search) ||
        r.representativeName.toLowerCase().includes(search)
      );
    }

    const field = this.sortField();
    if (!field) return rows;

    const order = this.sortOrder();
    return [...rows].sort((a, b) => {
      const valA: unknown = a[field];
      const valB: unknown = b[field];

      if (valA === undefined || valB === undefined) return 0;
      if (typeof valA === 'number' && typeof valB === 'number') return (valA - valB) * order;
      if (valA instanceof Date && valB instanceof Date) return (valA.getTime() - valB.getTime()) * order;
      return String(valA).localeCompare(String(valB)) * order;
    });
  });

  // While loading, feed the table 5 falsy rows. PrimeNG's TableBody renders
  // `rowData ? bodyTemplate : loadingBodyTemplate` per row, so each null draws
  // the loadingbody skeleton row while the header and table chrome stay real.
  readonly tableRows = computed(() =>
    this.branchesLoading() ? new Array(5).fill(null) : this.filteredBranches()
  );

  constructor() {
    effect(() => {
      const dark = this.themeService.isDarkMode();
      if (!this.map) return;
      this.map.setOptions({ styles: this.getMapStyles(dark) });
      this.scheduleJsMapRender();
    });

    // We also want to re-render pins if filteredBranches change
    effect(() => {
      this.filteredBranches(); // track it
      this.scheduleJsMapRender();
    });
  }

  ngOnInit() {
    this.branchesService.getKPIs().subscribe(data => {
      this.kpis.set(data);
      this.animateTo('totalBranches', data.totalLocations);
      this.animateTo('activeBranches', data.activeLocations);
      this.animateTo('totalRedemptions', data.totalRedemptions);
      this.animateTo('pendingRequests', data.pendingRequests);
    });
    this.branchesService.getBranches().subscribe(data => {
      this.allBranches.set(data);
      this.branchesLoading.set(false);

      const performers: TopPerformer[] = data.map(branch => ({
        id: branch.locationId,
        name: branch.locationName,
        redemptions: 0,
      }));
      this.topPerformers.set(performers);
      this.performersLoading.set(false);
      // keyed per performer, so re-fetching animates from each row's current value
      performers.forEach(p => this.animateTo(`perf-${p.id}`, p.redemptions));

      this.ensureMapReady();
    });
  }

  ngAfterViewInit() {
    this.ensureMapReady();
  }

  ngOnDestroy() {
    try { this.resizeObserver?.disconnect(); } catch {}
    this.resizeObserver = null;
    for (const m of this.markers) {
      try { m.setMap(null); } catch {}
    }
    this.markers = [];
    try { this.zoomListener?.remove?.(); } catch {}
    this.zoomListener = null;
    this.map = null;
  }

  toggleSort(field: keyof BranchRow) {
    if (this.sortField() === field) {
      this.sortOrder.set(this.sortOrder() === 1 ? -1 : 1);
    } else {
      this.sortField.set(field);
      this.sortOrder.set(1);
    }
  }

  sortIcon(field: keyof BranchRow): string {
    if (this.sortField() !== field) return 'pi-sort';
    return this.sortOrder() === 1 ? 'pi-sort-up' : 'pi-sort-down';
  }

  exportTable() {
    const rows = this.filteredBranches();
    if (!rows.length) return;
    const headers = [
      this.i18n.t('branches.column.name'),
      this.i18n.t('branches.column.totalOffers'),
      this.i18n.t('branches.column.location'),
      this.i18n.t('branches.column.manager'),
      this.i18n.t('branches.filter.status'),
    ];
    const csvContent = rows.map(r => [
      `"${r.locationName}"`, r.totalOffers, `"${r.city}"`, `"${r.representativeName}"`, `"${r.status || ''}"`
    ].join(','));
    const csvStr = '\ufeff' + headers.join(',') + '\n' + csvContent.join('\n');
    const blob = new Blob([csvStr], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'branches_export.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // ---- Count-up stats (shared/animation/count-up.ts) ------------------------
  // The cards skeleton while the data is absent, then count up once it lands —
  // sequential, never both at once.
  private readonly countUp = createCountUp();
  readonly animatedCount = this.countUp.animatedCount;
  private readonly animateTo = this.countUp.animateTo;

  // ==== Map logic ====

  get hasMapsKey(): boolean {
    return !!(environment as any).googleMapsApiKey;
  }

  private prepareMapContainer() {
    if (!this.mapContainer?.nativeElement) return;
    if (typeof ResizeObserver !== 'undefined' && !this.resizeObserver) {
      this.resizeObserver = new ResizeObserver(() => this.ensureMapReady());
      this.resizeObserver.observe(this.mapContainer.nativeElement);
    }
  }

  private ensureMapReady() {
    if (!this.hasMapsKey) return;
    if (!this.mapContainer?.nativeElement) return;
    void this.loadGoogleMaps().then(() => {
      this.scheduleJsMapRender();
    });
  }

  private async loadGoogleMaps() {
    if (this.mapsInitPromise) return this.mapsInitPromise;

    this.mapsInitPromise = (async () => {
      try {
        setOptions({ key: (environment as any).googleMapsApiKey, v: 'weekly' });
        await importLibrary('maps');
        this.debug.scriptLoaded = true;
        this.debug.mapsAvailable = !!(window as any).google?.maps;

        if (!this.debug.mapsAvailable) {
          this.mapError = this.i18n.t('branches.map.apiUnavailable');
          return;
        }

        await this.initMap();
      } catch (e) {
        this.mapError = this.i18n.t('branches.map.loadFailed');
        this.debug.scriptLoaded = false;
        this.debug.mapsAvailable = false;
      }
    })();

    return this.mapsInitPromise;
  }

  private async initMap() {
    if (!this.mapContainer?.nativeElement) {
      setTimeout(() => void this.initMap(), 100);
      return;
    }

    const google = (window as any).google;
    if (!google?.maps) return;
    if (this.map) {
      this.scheduleJsMapRender();
      return;
    }

    const center = { lat: 24.7136, lng: 46.6753 }; // Riyadh default
    try {
      const mapOptions: any = {
        center,
        zoom: 5,
        styles: this.getMapStyles(),
      };
      if ((environment as any).googleMapId) {
        mapOptions.mapId = (environment as any).googleMapId;
      }
      this.map = new google.maps.Map(this.mapContainer.nativeElement, mapOptions);
      this.zoomListener = this.map.addListener('zoom_changed', () => this.updateMarkerZoomState());
      this.debug.mapCreated = true;
      this.scheduleJsMapRender();
    } catch (e) {
      this.mapError = this.i18n.t('branches.map.initFailed');
    }
  }

  private scheduleJsMapRender() {
    if (!this.map) return;
    if (this.pendingRender) return;
    this.pendingRender = true;
    queueMicrotask(() => {
      this.pendingRender = false;
      this.updateMarkers();
    });
  }

  private updateMarkers() {
    if (!this.mapContainer?.nativeElement) return;
    const google = (window as any).google;
    if (!google?.maps) return;

    for (const m of this.markers) {
      try { m.setMap(null); } catch {}
    }
    this.markers = [];

    const branches = this.filteredBranches().filter(b => b.latitude && b.longitude);
    if (branches.length === 0) return;

    const bounds = new google.maps.LatLngBounds();
    for (const loc of branches) {
      const pos = {
        lat: Number(loc.latitude),
 lng: Number(loc.longitude)
      };
      bounds.extend(pos);
      const marker = this.createBranchMapMarker(pos, loc);
      this.markers.push(marker);
    }

    this.updateMarkerZoomState();

    this.zone.runOutsideAngular(() => {
      try { google.maps.event.trigger(this.map, 'resize'); } catch {}
      try { this.map.fitBounds(bounds, 40); } catch {}
    });
  }

  private updateMarkerZoomState() {
    const zoom = Number(this.map?.getZoom?.() ?? 0);
    const compact = zoom < 15;
    for (const marker of this.markers) {
      marker?.setCompact?.(compact);
    }
  }

  private createBranchMapMarker(position: { lat: number; lng: number }, loc: BranchRow): any {
    const google = (window as any).google;
    const markerTitle = loc.locationName ?? loc.locationName ?? '';
    // Fallback here is a JS-level guard on a getComputedStyle() read, not a CSS
    // var() fallback — --app-primary always resolves from :root, but kept in
    // case this runs before global styles are attached. Left as-is (styling
    // refactor scope; changing the guard is a logic decision, not a token one).
    const markerColor = this.getThemeColor('--app-primary', '#0033A0');

    class BranchMapMarker extends google.maps.OverlayView {
      private div: HTMLDivElement | null = null;
      private textDiv: HTMLDivElement | null = null;
      private compact = true;

      constructor(private markerPosition: { lat: number; lng: number }, private title: string) {
        super();
      }

      onAdd() {
        const wrapper = document.createElement('div');
        wrapper.style.position = 'absolute';
        wrapper.style.transform = 'translate(-50%, calc(-100% - 12px))';
        wrapper.style.display = 'flex';
        wrapper.style.alignItems = 'center';
        wrapper.style.justifyContent = 'center';
        wrapper.style.gap = '8px';
        wrapper.style.minWidth = '32px';
        wrapper.style.maxWidth = '420px';
        wrapper.style.height = '32px';
        wrapper.style.padding = '4px 12px';
        wrapper.style.background = markerColor;
        wrapper.style.color = '#ffffff'; // sanctioned: on-primary contrast over the brand-fill pin
        wrapper.style.borderRadius = '16px';
        wrapper.style.boxShadow = '0 4px 12px rgba(15, 23, 42, 0.22)';
        wrapper.style.cursor = 'pointer';
        wrapper.style.userSelect = 'none';
        wrapper.style.zIndex = '10';
        wrapper.style.whiteSpace = 'nowrap';
        wrapper.style.fontWeight = '600';
        wrapper.style.fontSize = '14px';

        const pointer = document.createElement('div');
        pointer.style.position = 'absolute';
        pointer.style.left = '50%';
        pointer.style.bottom = '-8px';
        pointer.style.width = '0';
        pointer.style.height = '0';
        pointer.style.transform = 'translateX(-50%)';
        pointer.style.borderLeft = '8px solid transparent';
        pointer.style.borderRight = '8px solid transparent';
        pointer.style.borderTop = `8px solid ${markerColor}`;

        const text = document.createElement('div');
        text.textContent = this.title;

        wrapper.appendChild(text);
        wrapper.appendChild(pointer);

        this.div = wrapper;
        this.textDiv = text;
        this.applyCompactState();

        (this as any).getPanes()?.overlayMouseTarget.appendChild(wrapper);
      }

      draw() {
        if (!this.div) return;
        const projection = (this as any).getProjection();
        if (!projection) return;
        const point = projection.fromLatLngToDivPixel(new google.maps.LatLng(this.markerPosition.lat, this.markerPosition.lng));
        if (!point) return;
        this.div.style.left = `${point.x}px`;
        this.div.style.top = `${point.y}px`;
      }

      onRemove() {
        this.div?.remove();
        this.div = null;
      }

      setCompact(compact: boolean) {
        this.compact = compact;
        this.applyCompactState();
      }

      private applyCompactState() {
        if (!this.div || !this.textDiv) return;
        if (this.compact) {
          this.textDiv.style.display = 'none';
          this.div.style.padding = '0';
          this.div.style.width = '16px';
          this.div.style.minWidth = '16px';
          this.div.style.height = '16px';
          this.div.style.borderRadius = '50%';
        } else {
          this.textDiv.style.display = 'block';
          this.div.style.width = 'auto';
          this.div.style.minWidth = '32px';
          this.div.style.height = '32px';
          this.div.style.padding = '4px 12px';
          this.div.style.borderRadius = '16px';
        }
      }
    }

    const marker = new BranchMapMarker(position, markerTitle);
    marker['setMap'](this.map);
    return marker;
  }

  private getThemeColor(variableName: string, fallback: string): string {
    const value = getComputedStyle(this.document.documentElement).getPropertyValue(variableName).trim();
    return value || fallback;
  }

  private getMapStyles(dark = this.themeService.isDarkMode()): any[] {
    const base = [{ featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] }];
    if (!dark) return base;
    // Google Maps JS API style array — plain data consumed by the Maps
    // renderer, not CSS. It cannot take `var(--app-*)` custom properties, so
    // these hexes are a deliberate one-off dark palette, left untouched.
    return [
      ...base,
      { elementType: 'geometry', stylers: [{ color: '#0f1b3d' }] },
      { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
      { elementType: 'labels.text.fill', stylers: [{ color: '#8295c4' }] },
      { elementType: 'labels.text.stroke', stylers: [{ color: '#0f1b3d' }] },
      { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#2a3a66' }] },
      { featureType: 'road', elementType: 'geometry.fill', stylers: [{ color: '#1c2c54' }] },
      { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#070f29' }] },
    ];
  }

  navigateBranchDetail(id:any){
    this.router.navigate(['/branches/view/', id]);
  }
}
