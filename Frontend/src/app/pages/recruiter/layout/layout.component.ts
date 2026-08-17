import { Component, OnInit, OnDestroy, inject, signal, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { RecruiterService } from '../../../services/recruiter.service';
import { NotificationService } from '../../../services/notification.service';

@Component({
  selector: 'app-recruiter-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.css'
})
export class RecruiterLayoutComponent implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly recruiterService = inject(RecruiterService);
  private readonly notificationService = inject(NotificationService);

  protected companyName = signal<string>('Recruiter');
  protected companyLogo = signal<string | null>(null);
  protected isApproved = signal<boolean>(false);
  protected isNotificationsOpen = signal<boolean>(false);
  protected isSidebarCollapsed = signal<boolean>(false);

  protected toggleSidebar(): void {
    this.isSidebarCollapsed.update(val => !val);
  }

  // Expose notification signals
  protected readonly unreadCount = this.notificationService.unreadCount;
  protected readonly notifications = this.notificationService.notifications;
  protected readonly activeToasts = this.notificationService.activeToasts;

  protected dismissToast(id: string): void {
    this.notificationService.dismissToast(id);
  }

  ngOnInit(): void {
    this.loadProfile();
    this.recruiterService.profile$.subscribe((profile) => {
      if (profile) {
        this.companyName.set(profile.companyName);
        this.companyLogo.set(profile.companyLogo || null);
        this.isApproved.set(profile.isApproved);
      }
    });

    // Initialize Socket connection using local storage credentials
    const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');
    if (userStr) {
      try {
        const u = JSON.parse(userStr);
        const userId = u._id || u.id;
        if (userId) {
          this.notificationService.initSocket(userId);
        }
      } catch (e) {}
    }
  }

  ngOnDestroy(): void {
    this.notificationService.disconnectSocket();
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.notification-container')) {
      this.isNotificationsOpen.set(false);
    }
  }

  protected toggleNotifications(event: MouseEvent): void {
    event.stopPropagation();
    this.isNotificationsOpen.set(!this.isNotificationsOpen());
  }

  protected markRead(id: string): void {
    this.notificationService.readLocal(id);
  }

  protected markAllRead(): void {
    this.notificationService.readAllLocal();
  }

  protected loadProfile(): void {
    this.recruiterService.getProfile().subscribe({
      next: (res) => {
        if (res && res.data) {
          this.companyName.set(res.data.companyName);
          this.companyLogo.set(res.data.companyLogo || null);
          this.isApproved.set(res.data.isApproved);
          const userId = res.data.user?._id;
          if (userId) {
            this.notificationService.initSocket(userId);
          }
        }
      },
      error: (err) => {
        console.error('Failed to load profile for layout header:', err);
        // Fallback name
        const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');
        if (userStr) {
          try {
            const u = JSON.parse(userStr);
            this.companyName.set(u.recruiter?.companyName || u.name || 'Recruiter');
            this.companyLogo.set(u.recruiter?.companyLogo || null);
          } catch (e) {}
        }
      }
    });
  }

  protected logout(): void {
    this.notificationService.disconnectSocket();
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    this.router.navigate(['/login']);
  }
}
