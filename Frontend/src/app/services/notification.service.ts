import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { io, Socket } from 'socket.io-client';

export interface NotificationItem {
  _id: string;
  userId: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  isRead: boolean;
  createdAt: string;
}

export interface ToastItem {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:5000/api/notifications';
  private readonly socketUrl = 'http://localhost:5000';
  private socket: Socket | null = null;

  // Signals for state management
  readonly notifications = signal<NotificationItem[]>([]);
  readonly activeToasts = signal<ToastItem[]>([]);

  readonly unreadCount = computed(() =>
    this.notifications().filter((n) => !n.isRead).length
  );

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token') || '';
    return new HttpHeaders({
      Authorization: `Bearer ${token}`,
    });
  }

  showToast(title: string, message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info'): void {
    const id = 'toast_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const item: ToastItem = { id, title, message, type };

    this.activeToasts.update((list) => [...list, item]);

    // Automatically disappear after exactly 10 seconds (10,000 ms)
    setTimeout(() => {
      this.dismissToast(id);
    }, 10000);
  }

  dismissToast(id: string): void {
    this.activeToasts.update((list) => list.filter((t) => t.id !== id));
  }

  initSocket(userId: string): void {
    if (this.socket) {
      this.socket.disconnect();
    }

    console.log('[Socket] Connecting to server...', this.socketUrl);
    this.socket = io(this.socketUrl);

    this.socket.on('connect', () => {
      console.log('[Socket] Connected. Registering user:', userId);
      this.socket?.emit('register', userId);
    });

    this.socket.on('notification', (newNotification: NotificationItem) => {
      console.log('[Socket] New notification received:', newNotification);
      // Prepend to notifications list
      this.notifications.update((list) => [newNotification, ...list]);
      // Show 10-second toast notification
      this.showToast(
        newNotification.title || 'Notification',
        newNotification.message,
        newNotification.type || 'info'
      );
    });

    this.socket.on('disconnect', () => {
      console.log('[Socket] Disconnected from server');
    });

    // Fetch initial list
    this.fetchNotifications().subscribe({
      next: (res) => {
        if (res && res.success && res.data) {
          this.notifications.set(res.data);
        }
      },
    });
  }

  disconnectSocket(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      console.log('[Socket] Connection terminated');
    }
  }

  fetchNotifications(): Observable<{ success: boolean; data: NotificationItem[] }> {
    return this.http.get<{ success: boolean; data: NotificationItem[] }>(this.apiUrl, {
      headers: this.getAuthHeaders(),
    });
  }

  markAsRead(id: string): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/${id}/read`, {}, {
      headers: this.getAuthHeaders(),
    });
  }

  markAllAsRead(): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/read-all`, {}, {
      headers: this.getAuthHeaders(),
    });
  }

  // Local helper UI actions
  readLocal(id: string): void {
    this.markAsRead(id).subscribe({
      next: () => {
        this.notifications.update((list) =>
          list.map((n) => (n._id === id ? { ...n, isRead: true } : n))
        );
      },
    });
  }

  readAllLocal(): void {
    this.markAllAsRead().subscribe({
      next: () => {
        this.notifications.update((list) =>
          list.map((n) => ({ ...n, isRead: true }))
        );
      },
    });
  }
}
