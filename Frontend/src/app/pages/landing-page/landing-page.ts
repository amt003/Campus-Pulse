import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  inject,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { SmoothScrollService } from '../../services/smooth-scroll.service';

@Component({
  selector: 'app-landing-page',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './landing-page.html',
  styleUrl: './landing-page.css',
})
export class LandingPage implements AfterViewInit, OnDestroy {
  private readonly elRef = inject(ElementRef);
  private readonly smoothScroll = inject(SmoothScrollService);

  protected headerScrolled = false;
  protected mobileMenuOpen = false;
  protected activeSection = '';

  private revealObserver?: IntersectionObserver;
  private spyObserver?: IntersectionObserver;

  @HostListener('window:scroll')
  onScroll(): void {
    this.headerScrolled = window.scrollY > 20;
  }

  ngAfterViewInit(): void {
    this.initReveal();
    this.initScrollSpy();
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
    if (!id) {
      this.smoothScroll.scrollTo(0, { duration: 1.2 });
      return;
    }
    const el = document.getElementById(id);
    if (el) this.smoothScroll.scrollTo(el, { offset: -64, duration: 1.4 });
  }

  ngOnDestroy(): void {
    this.revealObserver?.disconnect();
    this.spyObserver?.disconnect();
  }
}
