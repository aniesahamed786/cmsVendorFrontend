import { Component, inject, OnInit, signal, computed, AfterViewInit, OnDestroy, ElementRef, ViewChild, NgZone, effect } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PrimeUIModules } from '../../../../core/prime.import';
import { StoresService, StoreKPIs, TopPerformer, StoreRow } from '../../services/stores.service';
import { Button } from '../../../../shared/Components/button/button';
import { ThemeService } from '../../../../shared/services/theme.service';
import { environment } from '../../../../../environments/environment';
import { importLibrary, setOptions } from '@googlemaps/js-api-loader';

@Component({
  selector: 'app-stores-page',
  standalone: true,
  imports: [CommonModule, PrimeUIModules, FormsModule, Button],
  templateUrl: './stores-page.html',
  styleUrl: './stores-page.scss'
})
export class StoresPage implements OnInit, AfterViewInit, OnDestroy {
  private readonly storesService = inject(StoresService);
  private readonly document = inject(DOCUMENT);
  private readonly themeService = inject(ThemeService);
  private readonly zone = inject(NgZone);

  kpis = signal<StoreKPIs | null>(null);
  topPerformers = signal<TopPerformer[]>([]);
  allStores = signal<StoreRow[]>([]);

  // Table filters
  selectedStatus = signal<string | null>(null);
  selectedRegion = signal<string | null>(null);
  selectedManager = signal<string | null>(null);
  searchQuery = signal<string>('');
  
  // Sort
  sortField = signal<keyof StoreRow | null>('dateAdded');
  sortOrder = signal<1 | -1>(-1); // Newest first by default

  // Options
  statusOptions = [{ label: 'All Statuses', value: null }, { label: 'Active', value: 'Active' }, { label: 'Inactive', value: 'Inactive' }];
  regionOptions = [{ label: 'All Regions', value: null }, { label: 'East', value: 'East' }, { label: 'West', value: 'West' }, { label: 'South', value: 'South' }, { label: 'North', value: 'North' }, { label: 'Central', value: 'Central' }];
  managerOptions: { label: string; value: string | null }[] = [{ label: 'All Managers', value: null }]; // Populated dynamically

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

  @ViewChild('mapContainer')
  set mapContainerRef(ref: ElementRef<HTMLElement> | undefined) {
    this.mapContainer = ref;
    if (ref) {
      this.prepareMapContainer();
      this.ensureMapReady();
    }
  }

  readonly filteredStores = computed(() => {
    let rows = this.allStores();
    
    const status = this.selectedStatus();
    if (status) rows = rows.filter(r => r.status === status);
    
    const region = this.selectedRegion();
    if (region) rows = rows.filter(r => r.region === region);

    const manager = this.selectedManager();
    if (manager) rows = rows.filter(r => r.manager === manager);

    const search = this.searchQuery().toLowerCase().trim();
    if (search) {
      rows = rows.filter(r => 
        r.name.toLowerCase().includes(search) || 
        r.location.toLowerCase().includes(search) || 
        r.manager.toLowerCase().includes(search)
      );
    }

    const field = this.sortField();
    if (!field) return rows;
    
    const order = this.sortOrder();
    return [...rows].sort((a, b) => {
      const valA = a[field];
      const valB = b[field];
      
      if (valA === undefined || valB === undefined) return 0;
      if (typeof valA === 'number' && typeof valB === 'number') return (valA - valB) * order;
      if (valA instanceof Date && valB instanceof Date) return (valA.getTime() - valB.getTime()) * order;
      return String(valA).localeCompare(String(valB)) * order;
    });
  });

  constructor() {
    effect(() => {
      const dark = this.themeService.isDarkMode();
      if (!this.map) return;
      this.map.setOptions({ styles: this.getMapStyles(dark) });
      this.scheduleJsMapRender();
    });

    // We also want to re-render pins if filteredStores change
    effect(() => {
      this.filteredStores(); // track it
      this.scheduleJsMapRender();
    });
  }

  ngOnInit() {
    this.storesService.getKPIs().subscribe(data => this.kpis.set(data));
    this.storesService.getTopPerformers().subscribe(data => this.topPerformers.set(data));
    this.storesService.getStores().subscribe(data => {
      this.allStores.set(data);
      const managers = new Set(data.map(d => d.manager).filter(m => !!m));
      this.managerOptions = [
        { label: 'All Managers', value: null },
        ...Array.from(managers).map(m => ({ label: m, value: m }))
      ];
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

  toggleSort(field: keyof StoreRow) {
    if (this.sortField() === field) {
      this.sortOrder.set(this.sortOrder() === 1 ? -1 : 1);
    } else {
      this.sortField.set(field);
      this.sortOrder.set(1);
    }
  }

  sortIcon(field: keyof StoreRow): string {
    if (this.sortField() !== field) return 'pi-sort';
    return this.sortOrder() === 1 ? 'pi-sort-up' : 'pi-sort-down';
  }

  exportTable() {
    const rows = this.filteredStores();
    if (!rows.length) return;
    const headers = ['Branch Name', 'Total Offers', 'Location', 'Manager', 'Status'];
    const csvContent = rows.map(r => [
      `"${r.name}"`, r.totalOffers, `"${r.location}"`, `"${r.manager}"`, `"${r.status || ''}"`
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

  animatedCount(val: number | undefined): number | string {
    return val !== undefined ? val.toLocaleString() : '...';
  }

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
          this.mapError = 'Google Maps library loaded, but Maps JavaScript API is not available.';
          return;
        }

        await this.initMap();
      } catch (e) {
        this.mapError = 'Failed to load Google Maps library.';
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
      this.map = new google.maps.Map(this.mapContainer.nativeElement, {
        center,
        zoom: 5,
        styles: this.getMapStyles(),
      });
      this.zoomListener = this.map.addListener('zoom_changed', () => this.updateMarkerZoomState());
      this.debug.mapCreated = true;
      this.scheduleJsMapRender();
    } catch (e) {
      this.mapError = 'Failed to initialize Google Map.';
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

    const branches = this.filteredStores().filter(b => b.latitude && b.longitude);
    if (branches.length === 0) return;

    const bounds = new google.maps.LatLngBounds();
    for (const loc of branches) {
      const pos = { lat: loc.latitude!, lng: loc.longitude! };
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

  private createBranchMapMarker(position: { lat: number; lng: number }, loc: StoreRow): any {
    const google = (window as any).google;
    const markerTitle = loc.name;
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
        wrapper.style.color = '#ffffff';
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
}
