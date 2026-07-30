import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  TpoService,
  StudentRecord,
  StudentsResponse,
} from '../../../services/tpo.service';

@Component({
  selector: 'app-tpo-students',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './students.component.html',
  styleUrl: './students.component.css',
})
export class TpoStudentsComponent implements OnInit, OnDestroy {
  private readonly tpoService = inject(TpoService);
  private readonly router = inject(Router);

  // ── Data State ────────────────────────────────────────────────────────────
  protected students = signal<StudentRecord[]>([]);
  protected isLoading = signal<boolean>(true);
  protected errorMsg = signal<string | null>(null);

  // ── Filter State ─────────────────────────────────────────────────────────
  protected searchQuery = signal<string>('');
  protected filterBranch = signal<string>('');
  protected filterYear = signal<string>('');
  protected filterMinCgpa = signal<string>('');
  protected filterMaxCgpa = signal<string>('');
  protected filterBacklogs = signal<string>('');
  protected sortBy = signal<string>('createdAt');
  protected sortOrder = signal<string>('desc');

  // ── Filter Options (from API) ─────────────────────────────────────────────
  protected branchOptions = signal<string[]>([]);
  protected yearOptions = signal<number[]>([]);

  // ── Pagination ────────────────────────────────────────────────────────────
  protected currentPage = signal<number>(1);
  protected totalPages = signal<number>(1);
  protected totalStudents = signal<number>(0);
  protected pageSize = 20;

  // ── UI ────────────────────────────────────────────────────────────────────
  protected currentUser = signal<{ name: string; email: string } | null>(null);
  protected expandedRow = signal<string | null>(null);
  private searchDebounce?: ReturnType<typeof setTimeout>;

  ngOnInit(): void {
    const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');
    if (userStr) {
      try { this.currentUser.set(JSON.parse(userStr)); } catch { /* ignore */ }
    }
    this.fetchStudents();
  }

  protected fetchStudents(resetPage = false): void {
    if (resetPage) this.currentPage.set(1);
    this.isLoading.set(true);
    this.errorMsg.set(null);

    this.tpoService.getStudents({
      search: this.searchQuery(),
      branch: this.filterBranch(),
      passoutYear: this.filterYear(),
      minCgpa: this.filterMinCgpa(),
      maxCgpa: this.filterMaxCgpa(),
      activeBacklogs: this.filterBacklogs(),
      page: this.currentPage(),
      limit: this.pageSize,
      sortBy: this.sortBy(),
      sortOrder: this.sortOrder(),
    }).subscribe({
      next: (res: StudentsResponse) => {
        this.students.set(res.data);
        this.totalStudents.set(res.pagination.total);
        this.totalPages.set(res.pagination.totalPages || 1);
        if (res.filterOptions?.branches?.length) this.branchOptions.set(res.filterOptions.branches);
        if (res.filterOptions?.passoutYears?.length) this.yearOptions.set(res.filterOptions.passoutYears);
        this.isLoading.set(false);
      },
      error: (err: any) => {
        this.errorMsg.set(err.error?.message || 'Failed to load students. Please try again.');
        this.isLoading.set(false);
      },
    });
  }

  protected onSearchInput(value: string): void {
    this.searchQuery.set(value);
    clearTimeout(this.searchDebounce);
    this.searchDebounce = setTimeout(() => this.fetchStudents(true), 350);
  }

  protected applyFilters(): void {
    this.fetchStudents(true);
  }

  protected clearFilters(): void {
    this.searchQuery.set('');
    this.filterBranch.set('');
    this.filterYear.set('');
    this.filterMinCgpa.set('');
    this.filterMaxCgpa.set('');
    this.filterBacklogs.set('');
    this.sortBy.set('createdAt');
    this.sortOrder.set('desc');
    this.fetchStudents(true);
  }

  protected setPage(page: number): void {
    if (page < 1 || page > this.totalPages()) return;
    this.currentPage.set(page);
    this.fetchStudents();
  }

  protected toggleSort(field: string): void {
    if (this.sortBy() === field) {
      this.sortOrder.set(this.sortOrder() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortBy.set(field);
      this.sortOrder.set('desc');
    }
    this.fetchStudents(true);
  }

  protected toggleRow(id: string): void {
    this.expandedRow.set(this.expandedRow() === id ? null : id);
  }

  protected get noBacklogsCount(): number {
    return this.students().filter(s => s.activeBacklogs === 0).length;
  }

  protected get highCgpaCount(): number {
    return this.students().filter(s => s.cgpa >= 8.5).length;
  }

  protected getCgpaClass(cgpa: number): string {
    if (cgpa >= 8.5) return 'cgpa-excellent';
    if (cgpa >= 7.0) return 'cgpa-good';
    if (cgpa >= 6.0) return 'cgpa-average';
    return 'cgpa-low';
  }

  protected get pageNumbers(): number[] {
    const pages: number[] = [];
    const total = this.totalPages();
    const current = this.currentPage();
    const delta = 2;
    for (let i = Math.max(1, current - delta); i <= Math.min(total, current + delta); i++) {
      pages.push(i);
    }
    return pages;
  }

  protected logout(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    this.router.navigate(['/login']);
  }

  protected exportCSV(): void {
    const rows = this.students();
    if (!rows.length) return;
    const headers = ['Roll Number', 'Name', 'Email', 'Branch', 'Passout Year', 'CGPA', 'Active Backlogs', 'Phone', 'Status'];
    const csvRows = rows.map(s => [
      s.rollNumber,
      s.userId?.name || '',
      s.userId?.email || '',
      s.branch,
      s.passoutYear,
      s.cgpa,
      s.activeBacklogs,
      s.userId?.phone || '',
      s.userId?.isActive ? 'Active' : 'Inactive',
    ].join(','));
    const csv = [headers.join(','), ...csvRows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `students_export_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  protected get activeFiltersCount(): number {
    return [this.filterBranch(), this.filterYear(), this.filterMinCgpa(), this.filterMaxCgpa(), this.filterBacklogs(), this.searchQuery()]
      .filter(v => v !== '').length;
  }

  ngOnDestroy(): void {
    clearTimeout(this.searchDebounce);
  }
}
