import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { RecruiterService } from '../../../services/recruiter.service';

@Component({
  selector: 'app-recruiter-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.css'
})
export class RecruiterLayoutComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly recruiterService = inject(RecruiterService);
  protected companyName = signal<string>('Recruiter');
  protected companyLogo = signal<string | null>(null);
  protected isApproved = signal<boolean>(false);

  ngOnInit(): void {
    this.loadProfile();
    this.recruiterService.profile$.subscribe((profile) => {
      if (profile) {
        this.companyName.set(profile.companyName);
        this.companyLogo.set(profile.companyLogo || null);
        this.isApproved.set(profile.isApproved);
      }
    });
  }

  protected loadProfile(): void {
    this.recruiterService.getProfile().subscribe({
      next: (res) => {
        if (res && res.data) {
          this.companyName.set(res.data.companyName);
          this.companyLogo.set(res.data.companyLogo || null);
          this.isApproved.set(res.data.isApproved);
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
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    this.router.navigate(['/login']);
  }
}
