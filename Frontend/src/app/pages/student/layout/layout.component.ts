import { Component, OnInit, OnDestroy, inject, signal, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { StudentService, StudentProfile } from '../../../services/student.service';
import { NotificationService } from '../../../services/notification.service';

@Component({
  selector: 'app-student-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.css'
})
export class StudentLayoutComponent implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly studentService = inject(StudentService);
  private readonly notificationService = inject(NotificationService);

  protected profile = signal<StudentProfile | null>(null);
  protected isSidebarCollapsed = signal<boolean>(false);
  protected isNotificationsOpen = signal<boolean>(false);

  // Expose notification signals
  protected readonly unreadCount = this.notificationService.unreadCount;
  protected readonly notifications = this.notificationService.notifications;
  protected readonly activeToasts = this.notificationService.activeToasts;

  protected dismissToast(id: string): void {
    this.notificationService.dismissToast(id);
  }

  ngOnInit(): void {
    this.loadProfile();
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

  protected toggleSidebar(): void {
    this.isSidebarCollapsed.set(!this.isSidebarCollapsed());
  }

  protected loadProfile(): void {
    this.studentService.getProfile().subscribe({
      next: (res) => {
        if (res && res.profile) {
          this.profile.set(res.profile);
          // Initialize Socket.io connection for real-time notifications
          if (res.profile.userId && res.profile.userId._id) {
            this.notificationService.initSocket(res.profile.userId._id);
          }
        }
      },
      error: (err) => {
        console.error('Failed to load profile for layout header:', err);
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
