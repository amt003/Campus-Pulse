import { Injectable, inject, signal, computed, effect } from '@angular/core';
import { Router, NavigationStart, NavigationEnd, NavigationCancel, NavigationError } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class LoadingService {
  private readonly router = inject(Router);

  // Loading states
  readonly isVisible = signal<boolean>(false);
  readonly isTimeout = signal<boolean>(false);
  readonly hasError = signal<boolean>(false);
  readonly errorMessage = signal<string>('');
  
  // Status message rotation
  private readonly defaultMessages = [
    'Loading your dashboard…',
    'Matching you with opportunities…',
    'Fetching drives and schedules…'
  ];
  readonly statusMessages = signal<string[]>(this.defaultMessages);
  readonly currentMessageIndex = signal<number>(0);
  readonly currentStatusMessage = computed(() => {
    const list = this.statusMessages();
    return list[this.currentMessageIndex() % list.length] || 'Loading…';
  });

  // Timing constants
  private readonly SHOW_DELAY_MS = 300;
  private readonly MIN_DISPLAY_MS = 500;
  private readonly TIMEOUT_MS = 10000;

  // Timers and tracking
  private showTimer: any = null;
  private timeoutTimer: any = null;
  private rotationInterval: any = null;
  private shownTimestamp: number = 0;
  private activeRequestCount = 0;
  private lastAttemptedUrl: string = '';

  constructor() {
    this.router.events.subscribe(event => {
      if (event instanceof NavigationStart) {
        this.lastAttemptedUrl = event.url;
        this.startLoading();
      } else if (
        event instanceof NavigationEnd ||
        event instanceof NavigationCancel
      ) {
        this.stopLoading();
      } else if (event instanceof NavigationError) {
        this.failLoading(event.error?.message || 'Failed to navigate. Please check your connection.');
      }
    });
  }

  /**
   * Programmatic start (e.g. login, role change, heavy operations)
   */
  startLoading(customMessages?: string[]): void {
    if (customMessages && customMessages.length > 0) {
      this.statusMessages.set(customMessages);
    } else {
      this.statusMessages.set(this.defaultMessages);
    }
    this.currentMessageIndex.set(0);
    this.hasError.set(false);
    this.errorMessage.set('');
    this.isTimeout.set(false);

    this.activeRequestCount++;
    if (this.activeRequestCount > 1) {
      return;
    }

    // Clear existing timers
    this.clearTimers();

    // Show delay: Only show if loading exceeds SHOW_DELAY_MS (300ms)
    this.showTimer = setTimeout(() => {
      this.showLoader();
    }, this.SHOW_DELAY_MS);
  }

  /**
   * Stop loading with minimum display time guarantee (500ms)
   */
  stopLoading(): void {
    this.activeRequestCount = Math.max(0, this.activeRequestCount - 1);
    if (this.activeRequestCount > 0) {
      return;
    }

    // If loader has not even been displayed yet, cancel the pending show timer
    if (!this.isVisible()) {
      this.clearTimers();
      return;
    }

    // Loader is currently visible: enforce MIN_DISPLAY_MS (500ms)
    const elapsed = Date.now() - this.shownTimestamp;
    const remainingTime = Math.max(0, this.MIN_DISPLAY_MS - elapsed);

    setTimeout(() => {
      this.hideLoader();
    }, remainingTime);
  }

  /**
   * Set error state
   */
  failLoading(message: string): void {
    this.hasError.set(true);
    this.errorMessage.set(message || 'An error occurred while loading.');
    this.clearTimers();
    // Keep it visible so user can retry
    if (!this.isVisible()) {
      this.showLoader();
    }
  }

  /**
   * Trigger retry
   */
  retry(): void {
    this.hasError.set(false);
    this.isTimeout.set(false);
    this.errorMessage.set('');

    if (this.lastAttemptedUrl) {
      this.router.navigateByUrl(this.lastAttemptedUrl);
    } else {
      window.location.reload();
    }
  }

  private showLoader(): void {
    this.shownTimestamp = Date.now();
    this.isVisible.set(true);

    // Setup 2-second message rotation
    this.rotationInterval = setInterval(() => {
      this.currentMessageIndex.update(idx => idx + 1);
    }, 2000);

    // Setup 10-second timeout
    this.timeoutTimer = setTimeout(() => {
      if (this.isVisible() && !this.hasError()) {
        this.isTimeout.set(true);
      }
    }, this.TIMEOUT_MS);
  }

  private hideLoader(): void {
    this.isVisible.set(false);
    this.isTimeout.set(false);
    this.hasError.set(false);
    this.clearTimers();
  }

  private clearTimers(): void {
    if (this.showTimer) {
      clearTimeout(this.showTimer);
      this.showTimer = null;
    }
    if (this.timeoutTimer) {
      clearTimeout(this.timeoutTimer);
      this.timeoutTimer = null;
    }
    if (this.rotationInterval) {
      clearInterval(this.rotationInterval);
      this.rotationInterval = null;
    }
  }
}
