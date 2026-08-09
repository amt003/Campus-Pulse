import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { StudentService, StudentProfile } from '../../../services/student.service';

@Component({
  selector: 'app-student-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.css'
})
export class StudentLayoutComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly studentService = inject(StudentService);
  protected profile = signal<StudentProfile | null>(null);
  protected isSidebarCollapsed = signal<boolean>(false);

  ngOnInit(): void {
    this.loadProfile();
  }

  protected toggleSidebar(): void {
    this.isSidebarCollapsed.set(!this.isSidebarCollapsed());
  }

  protected loadProfile(): void {
    this.studentService.getProfile().subscribe({
      next: (res) => {
        if (res && res.profile) {
          this.profile.set(res.profile);
        }
      },
      error: (err) => {
        console.error('Failed to load profile for layout header:', err);
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
