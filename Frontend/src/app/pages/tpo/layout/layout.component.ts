import { Component, OnInit, OnDestroy, inject, signal, computed, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { TpoService } from '../../../services/tpo.service';
import { NotificationService } from '../../../services/notification.service';

@Component({
  selector: 'app-tpo-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.css'
})
export class TpoLayoutComponent implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly tpoService = inject(TpoService);
  private readonly notificationService = inject(NotificationService);

  protected currentUser = signal<{ name: string; email: string; role: string; _id?: string; id?: string } | null>(null);
  protected pendingCount = signal<number>(0);
  protected pendingDriveCount = signal<number>(0);
  protected isNotificationsOpen = signal<boolean>(false);

  // Expose notification signals
  protected readonly unreadCount = this.notificationService.unreadCount;
  protected readonly notifications = this.notificationService.notifications;
  protected readonly activeToasts = this.notificationService.activeToasts;
  protected readonly latestNotifications = computed(() => this.notifications().slice(0, 4));

  protected dismissToast(id: string): void {
    this.notificationService.dismissToast(id);
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

  ngOnInit(): void {
    const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');
    if (userStr) {
      try {
        const u = JSON.parse(userStr);
        this.currentUser.set(u);
        const userId = u._id || u.id;
        if (userId) {
          this.notificationService.initSocket(userId);
        }
      } catch (err) {
        console.error('Failed to parse user details in layout:', err);
      }
    }
    this.loadPendingCount();
  }

  ngOnDestroy(): void {
    this.notificationService.disconnectSocket();
  }

  private loadPendingCount(): void {
    this.tpoService.getPendingRecruiters().subscribe({
      next: (data) => {
        this.pendingCount.set(data?.length || 0);
      },
      error: (err) => console.error('Failed to fetch pending count for layout badge:', err)
    });
    this.tpoService.getPendingDrives().subscribe({
      next: (res) => {
        this.pendingDriveCount.set(res?.drives?.length || 0);
      },
      error: (err) => console.error('Failed to fetch pending drive count for layout badge:', err)
    });
  }

  protected logout(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    this.router.navigate(['/login']);
  }
}
