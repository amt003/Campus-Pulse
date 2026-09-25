import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { NotificationService, NotificationItem } from '../../services/notification.service';

@Component({
  selector: 'app-notifications-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './notifications.component.html',
  styleUrl: './notifications.component.css'
})
export class NotificationsComponent implements OnInit {
  private readonly notificationService = inject(NotificationService);
  private readonly router = inject(Router);

  // Signals
  protected readonly notifications = this.notificationService.notifications;
  protected readonly unreadCount = this.notificationService.unreadCount;

  protected activeFilter = signal<'all' | 'unread' | 'success' | 'warning' | 'info' | 'error'>('all');
  protected searchQuery = signal<string>('');
  protected isRefreshing = signal<boolean>(false);

  // Determine user role from route for contextual action links
  protected userRole = computed<'student' | 'recruiter' | 'tpo'>(() => {
    const url = this.router.url;
    if (url.includes('/recruiter')) return 'recruiter';
    if (url.includes('/tpo')) return 'tpo';
    return 'student';
  });

  // Filtered and searched notifications list
  protected filteredNotifications = computed(() => {
    let list = this.notifications();
    const filter = this.activeFilter();
    const query = this.searchQuery().trim().toLowerCase();

    // Apply category / read filter
    if (filter === 'unread') {
      list = list.filter(n => !n.isRead);
    } else if (filter !== 'all') {
      list = list.filter(n => n.type === filter);
    }

    // Apply search query
    if (query) {
      list = list.filter(n =>
        n.title.toLowerCase().includes(query) ||
        n.message.toLowerCase().includes(query)
      );
    }

    return list;
  });

  // Counts by filter
  protected countAll = computed(() => this.notifications().length);
  protected countUnread = computed(() => this.notifications().filter(n => !n.isRead).length);
  protected countSuccess = computed(() => this.notifications().filter(n => n.type === 'success').length);
  protected countWarning = computed(() => this.notifications().filter(n => n.type === 'warning').length);
  protected countInfo = computed(() => this.notifications().filter(n => n.type === 'info').length);

  ngOnInit(): void {
    this.refresh();
  }

  protected setFilter(filter: 'all' | 'unread' | 'success' | 'warning' | 'info' | 'error'): void {
    this.activeFilter.set(filter);
  }

  protected markAsRead(id: string, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.notificationService.readLocal(id);
  }

  protected markAllAsRead(): void {
    this.notificationService.readAllLocal();
  }

  protected refresh(): void {
    this.isRefreshing.set(true);
    this.notificationService.fetchNotifications().subscribe({
      next: (res) => {
        if (res && res.success && res.data) {
          this.notifications.set(res.data);
        }
        this.isRefreshing.set(false);
      },
      error: () => {
        this.isRefreshing.set(false);
      }
    });
  }

  protected clearSearch(): void {
    this.searchQuery.set('');
  }

  // Get action route based on notification content and user role
  protected getActionRoute(notif: NotificationItem): string | null {
    const text = (notif.title + ' ' + notif.message).toLowerCase();
    const role = this.userRole();

    if (role === 'student') {
      if (text.includes('schedule') || text.includes('interview') || text.includes('round')) return '/student/schedules';
      if (text.includes('offer') || text.includes('letter') || text.includes('selected') || text.includes('congratulations')) return '/student/offers';
      if (text.includes('application') || text.includes('applied') || text.includes('shortlist') || text.includes('drive')) return '/student/applications';
      if (text.includes('readiness') || text.includes('score') || text.includes('skill')) return '/student/readiness';
    } else if (role === 'recruiter') {
      if (text.includes('offer')) return '/recruiter/offers';
      if (text.includes('drive')) return '/recruiter/drives';
      if (text.includes('application') || text.includes('applicant') || text.includes('student')) return '/recruiter/all-applications';
    } else if (role === 'tpo') {
      if (text.includes('drive')) return '/tpo/oversee-drives';
      if (text.includes('recruiter') || text.includes('approval')) return '/tpo/approval';
      if (text.includes('student')) return '/tpo/students';
    }
    return null;
  }

  protected getActionLabel(notif: NotificationItem): string {
    const text = (notif.title + ' ' + notif.message).toLowerCase();
    if (text.includes('schedule') || text.includes('interview')) return 'View Schedule';
    if (text.includes('offer') || text.includes('selected')) return 'View Offer';
    if (text.includes('application') || text.includes('applied')) return 'View Application';
    if (text.includes('drive')) return 'View Drive';
    if (text.includes('readiness')) return 'View Readiness';
    return 'View Details';
  }

  protected formatTimestamp(dateStr: string): string {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hr${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  }
}
