import { Injectable, inject, NgZone } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import Lenis from 'lenis';

@Injectable({
  providedIn: 'root'
})
export class SmoothScrollService {
  private readonly ngZone = inject(NgZone);
  private readonly router = inject(Router);

  private lenis: Lenis | null = null;
  private isInitialized = false;
  private activeModalCount = 0;

  public init(): void {
    if (this.isInitialized) return;
    this.isInitialized = true;

    // Run Lenis outside Angular's zone for optimal performance (60/120fps smooth animation without change detection overhead)
    this.ngZone.runOutsideAngular(() => {
      this.lenis = new Lenis({
        duration: 1.2,
        easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        orientation: 'vertical',
        gestureOrientation: 'vertical',
        smoothWheel: true,
        wheelMultiplier: 1.0,
        touchMultiplier: 1.5,
      });

      const raf = (time: number) => {
        this.lenis?.raf(time);
        requestAnimationFrame(raf);
      };
      requestAnimationFrame(raf);
    });

    // Smooth reset scroll on page transition/route changes
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe(() => {
        this.unfreezeBackgroundScroll(true);
        setTimeout(() => {
          this.scrollTo(0, { duration: 0.8 });
          this.resize();
        }, 50);
      });
  }

  public freezeBackgroundScroll(): void {
    this.activeModalCount++;
    if (this.activeModalCount > 0) {
      this.lenis?.stop();
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      document.body.classList.add('lenis-stopped');
      document.documentElement.classList.add('lenis-stopped');
    }
  }

  public unfreezeBackgroundScroll(force = false): void {
    if (force) {
      this.activeModalCount = 0;
    } else {
      this.activeModalCount = Math.max(0, this.activeModalCount - 1);
    }

    if (this.activeModalCount === 0) {
      this.lenis?.start();
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      document.body.classList.remove('lenis-stopped');
      document.documentElement.classList.remove('lenis-stopped');
    }
  }

  public scrollTo(
    target: number | HTMLElement | string,
    options?: { offset?: number; duration?: number; immediate?: boolean }
  ): void {
    if (!this.lenis) {
      if (typeof target === 'string') {
        const el = document.querySelector(target);
        el?.scrollIntoView({ behavior: 'smooth' });
      } else if (target instanceof HTMLElement) {
        target.scrollIntoView({ behavior: 'smooth' });
      } else if (typeof target === 'number') {
        window.scrollTo({ top: target, behavior: 'smooth' });
      }
      return;
    }

    if (typeof target === 'string') {
      const el = document.querySelector(target);
      if (el) {
        this.lenis.scrollTo(el as HTMLElement, options);
      }
    } else {
      this.lenis.scrollTo(target, options);
    }
  }

  public stop(): void {
    this.lenis?.stop();
  }

  public start(): void {
    this.lenis?.start();
  }

  public resize(): void {
    this.lenis?.resize();
  }

  public get instance(): Lenis | null {
    return this.lenis;
  }
}
