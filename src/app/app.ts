import { AfterViewInit, Component, DestroyRef, ElementRef, ViewChild, signal, inject } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AnimationBuilder, AnimationPlayer, animate, style } from '@angular/animations';
import { filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ThemeToggleComponent } from './shared/components/ui/theme-toggle.component';
import { ToastHostComponent } from './shared/components/ui/toast-host.component';
import { ConnectionIndicatorComponent } from './shared/components/ui/connection-indicator.component';
import { ThemeService } from './core/services/theme.service';
import { ApiService } from './core/services/api.service';
import { FdmsContextService } from './core/services/fdms-context.service';
import { PingService } from './core/services/ping.service';
import { DeviceOperatingMode } from './core/models/api.models';
import { StorageService } from './core/services/storage.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ThemeToggleComponent, ToastHostComponent, ConnectionIndicatorComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements AfterViewInit {
  protected readonly title = signal('zimra-fdms');
  readonly sidebarOpen = signal(false);
  readonly sidebarNav = [
    { path: '/dashboard', label: 'Dashboard' },
    { path: '/fiscal-day', label: 'Fiscal Day' },
    { path: '/receipts', label: 'Receipts' },
    { path: '/offline', label: 'Offline' },
    { path: '/users', label: 'Users' },
    { path: '/stock', label: 'Stock' },
    { path: '/reports', label: 'Reports' },
    { path: '/certificates', label: 'Certificates' },
    { path: '/settings', label: 'Settings' },
  ];
  readonly mobileTabs = [
    { path: '/dashboard', label: 'Home' },
    { path: '/fiscal-day', label: 'Day' },
    { path: '/receipts', label: 'Receipts' },
    { path: '/reports', label: 'Reports' },
    { path: '/settings', label: 'Settings' },
  ];
  readonly operatingMode = signal<'online' | 'offline' | 'unknown'>('unknown');
  readonly deviceRegistered = signal<boolean>(false);
  readonly offlineBanner = signal<string | null>(null);

  @ViewChild('pageHost', { read: ElementRef, static: true })
  private readonly pageHost?: ElementRef<HTMLElement>;

  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly animationBuilder = inject(AnimationBuilder);
  private animationPlayer?: AnimationPlayer;

  constructor(
    private readonly theme: ThemeService,
    private readonly api: ApiService,
    private readonly fdmsContext: FdmsContextService,
    private readonly pingService: PingService,
    private readonly storage: StorageService
  ) {
    this.theme.init();
    this.fdmsContext.initFromStorage();
    this.api.setBaseUrl(this.fdmsContext.getBaseUrl());

    // Global connectivity monitoring: start ping loop on app init.
    // Device ID is loaded from storage during `initFromStorage()`.
    const deviceID = this.fdmsContext.getDeviceID();
    if (deviceID != null) {
      try {
        this.pingService.start({ deviceID });
      } catch {
        // best-effort; ignore until the user reaches a screen that can configure device context.
      }
    }
    void this.refreshOperatingMode();
    void this.refreshDeviceRegistered();
  }

  ngAfterViewInit(): void {
    this.router.events
      .pipe(
        filter((evt): evt is NavigationEnd => evt instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        this.sidebarOpen.set(false);
        void this.refreshOperatingMode();
        void this.refreshDeviceRegistered();
        this.updateOfflineBannerFromUrl();
        // Ensure the routed component has been attached before starting animation.
        requestAnimationFrame(() => this.playRouteTransition());
      });
  }

  toggleSidebar(): void {
    this.sidebarOpen.set(!this.sidebarOpen());
  }

  closeSidebar(): void {
    this.sidebarOpen.set(false);
  }

  dismissOfflineBanner(): void {
    this.offlineBanner.set(null);
  }

  isOnlineOnly(path: string): boolean {
    return path.startsWith('/dashboard') || path.startsWith('/fiscal-day') || path.startsWith('/receipts');
  }

  navDisabled(path: string): boolean {
    if (!this.deviceRegistered() && path !== '/setup') return true;
    return this.operatingMode() === 'offline' && this.isOnlineOnly(path);
  }

  navDisabledReason(path: string): string {
    if (!this.navDisabled(path)) return '';
    if (!this.deviceRegistered() && path !== '/setup') {
      return 'Complete Setup first (register device certificate and config) to access this screen.';
    }
    return 'Requires Online mode (getStatus/openDay/submitReceipt/closeDay/ping are unavailable in Offline mode).';
  }

  private async refreshOperatingMode(): Promise<void> {
    const cfg = await this.storage.getAnyDeviceConfig();
    const mode = cfg?.deviceOperatingMode;
    if (mode === DeviceOperatingMode.Offline) {
      this.operatingMode.set('offline');
    } else if (mode === DeviceOperatingMode.Online) {
      this.operatingMode.set('online');
    } else {
      this.operatingMode.set('unknown');
    }
  }

  private async refreshDeviceRegistered(): Promise<void> {
    const cert = await this.storage.getAnyDeviceCertificate();
    const cfg = await this.storage.getAnyDeviceConfig();
    this.deviceRegistered.set(!!(cert && cfg));
  }

  private updateOfflineBannerFromUrl(): void {
    const tree = this.router.parseUrl(this.router.url);
    if (tree.queryParams['offlineModeInfo'] === '1') {
      this.offlineBanner.set(
        'Device is configured in Offline mode. Online-only screens are unavailable. Use Offline > File Builder/File Status.'
      );
      return;
    }
    this.offlineBanner.set(null);
  }

  private playRouteTransition(): void {
    const host = this.pageHost?.nativeElement;
    if (!host) return;

    // Stop any previous animation instance.
    this.animationPlayer?.destroy();

    const factory = this.animationBuilder.build([
      style({ opacity: 0, transform: 'translateY(8px)', animation: 'none' }),
      animate('1ms', style({ animation: 'fadeSlideIn 350ms cubic-bezier(0.4, 0, 0.2, 1) both', opacity: 1, transform: 'translateY(0)' })),
    ]);

    this.animationPlayer = factory.create(host);
    this.animationPlayer.play();
  }
}
