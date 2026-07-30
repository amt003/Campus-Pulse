import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  inject,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import Lenis from 'lenis';

@Component({
  selector: 'app-landing-page',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './landing-page.html',
  styleUrl: './landing-page.css',
})
export class LandingPage implements AfterViewInit, OnDestroy {
  private readonly elRef = inject(ElementRef);

  protected headerScrolled = false;
  protected mobileMenuOpen = false;
  protected activeSection = '';

  private lenis?: Lenis;
  private revealObserver?: IntersectionObserver;
  private spyObserver?: IntersectionObserver;
  private rafId?: number;

  @HostListener('window:scroll')
  onScroll(): void {
    this.headerScrolled = window.scrollY > 20;
  }

  ngAfterViewInit(): void {
    this.initLenis();
    this.initReveal();
    this.initScrollSpy();
  }

  private initLenis(): void {
    this.lenis = new Lenis({
      duration: 1.2,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      smoothWheel: true,
    });

    const raf = (time: number) => {
      this.lenis?.raf(time);
      this.rafId = requestAnimationFrame(raf);
    };
    this.rafId = requestAnimationFrame(raf);
  }

  private initReveal(): void {
    this.revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add('is-visible');
        });
      },
      { threshold: 0.1 },
    );
    this.elRef.nativeElement
      .querySelectorAll('.reveal')
      .forEach((el: Element) => this.revealObserver?.observe(el));
  }

  private initScrollSpy(): void {
    this.spyObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            this.activeSection = e.target.id || '';
          }
        });
      },
      { rootMargin: '-40% 0px -55% 0px' },
    );

    ['features', 'how-it-works', 'roles'].forEach((id) => {
      const el = this.elRef.nativeElement.querySelector(`#${id}`);
      if (el) this.spyObserver?.observe(el);
    });
  }

  protected toggleMobileMenu(): void {
    this.mobileMenuOpen = !this.mobileMenuOpen;
  }

  protected closeMobileMenu(): void {
    this.mobileMenuOpen = false;
  }

  protected scrollToSection(id: string): void {
    this.closeMobileMenu();
    const el = document.getElementById(id);
    if (el) this.lenis?.scrollTo(el, { offset: -64, duration: 1.4 });
  }

  ngOnDestroy(): void {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.lenis?.destroy();
    this.revealObserver?.disconnect();
    this.spyObserver?.disconnect();
  }
}
