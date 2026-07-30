import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { TpoService } from '../../../services/tpo.service';

@Component({
  selector: 'app-tpo-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.css'
})
export class TpoLayoutComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly tpoService = inject(TpoService);
  protected currentUser = signal<{ name: string; email: string; role: string } | null>(null);
  protected pendingCount = signal<number>(0);

  ngOnInit(): void {
    const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');
    if (userStr) {
      try {
        this.currentUser.set(JSON.parse(userStr));
      } catch (err) {
        console.error('Failed to parse user details in layout:', err);
      }
    }
    this.loadPendingCount();
  }

  private loadPendingCount(): void {
    this.tpoService.getPendingRecruiters().subscribe({
      next: (data) => {
        this.pendingCount.set(data?.length || 0);
      },
      error: (err) => console.error('Failed to fetch pending count for layout badge:', err)
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
