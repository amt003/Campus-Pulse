import { Component, OnInit, HostListener, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-install-prompt',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './install-prompt.component.html',
  styleUrls: ['./install-prompt.component.css'],
})
export class InstallPromptComponent implements OnInit {
  protected showBanner = signal<boolean>(false);
  private deferredPrompt: any = null;

  @HostListener('window:beforeinstallprompt', ['$event'])
  onBeforeInstallPrompt(event: Event): void {
    event.preventDefault();
    this.deferredPrompt = event;
    const dismissed = localStorage.getItem('pwa-banner-dismissed');
    if (!dismissed) {
      this.showBanner.set(true);
    }
  }

  ngOnInit(): void {
    if (typeof window !== 'undefined') {
      if (window.matchMedia('(display-mode: standalone)').matches) {
        this.showBanner.set(false);
      }
    }
  }

  installApp(): void {
    if (this.deferredPrompt) {
      this.deferredPrompt.prompt();
      this.deferredPrompt.userChoice.then((choiceResult: any) => {
        if (choiceResult && choiceResult.outcome === 'accepted') {
          console.log('[PWA] User accepted the install prompt');
        } else {
          console.log('[PWA] User dismissed the install prompt');
        }
        this.deferredPrompt = null;
        this.showBanner.set(false);
      });
    }
  }

  dismissBanner(): void {
    this.showBanner.set(false);
    localStorage.setItem('pwa-banner-dismissed', 'true');
  }
}
