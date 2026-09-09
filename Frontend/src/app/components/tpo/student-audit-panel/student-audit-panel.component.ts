import { Component, Input, Output, EventEmitter, OnInit, OnChanges, OnDestroy, SimpleChanges, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TpoService } from '../../../services/tpo.service';

@Component({
  selector: 'app-student-audit-panel',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="panel-backdrop" (click)="onClose()" (wheel)="$event.stopPropagation()" (touchmove)="$event.stopPropagation()">
      <div class="panel-drawer" (click)="$event.stopPropagation()" (wheel)="$event.stopPropagation()">

        <!-- Panel Header -->
        <div class="panel-header">
          <div class="header-info">
            <h2 class="student-title">
              <span class="material-symbols-outlined icon-person">account_circle</span>
              <span>{{ auditData()?.student?.name || 'Student Placement Audit' }}</span>
            </h2>
            <span class="roll-badge" *ngIf="rollNumber">
              Roll No: <strong>{{ rollNumber }}</strong>
            </span>
          </div>
          <button class="btn-close-panel" (click)="onClose()" title="Close Panel">&times;</button>
        </div>

        <!-- Panel Body -->
        <div class="panel-body" (wheel)="$event.stopPropagation()">

          <!-- Loading State -->
          <div class="state-loading" *ngIf="isLoading()">
            <div class="spinner"></div>
            <p>Fetching student placement history…</p>
          </div>

          <!-- Error State -->
          <div class="state-error" *ngIf="errorMsg() && !isLoading()">
            <span class="material-symbols-outlined icon-error">error</span>
            <p>{{ errorMsg() }}</p>
          </div>

          <!-- Main Content -->
          <ng-container *ngIf="!isLoading() && !errorMsg() && auditData() as data">

            <!-- Section 1: Profile Summary Card -->
            <div class="card-profile-summary">
              <div class="summary-top">
                <div class="avatar-large">
                  {{ (data.student?.name || 'S')[0].toUpperCase() }}
                </div>
                <div class="student-meta">
                  <h3 class="meta-name">{{ data.student?.name }}</h3>
                  <p class="meta-sub">{{ data.student?.email }}<ng-container *ngIf="data.student?.phone"> &bull; {{ data.student?.phone }}</ng-container></p>
                </div>
                <div class="status-pill-wrap">
                  <span class="badge-overall-status" [class]="getOverallStatusClass(data.overallStatus)">
                    <span class="status-dot"></span>
                    <span>{{ data.overallStatus }}</span>
                  </span>
                </div>
              </div>

              <div class="summary-grid">
                <div class="metric-item">
                  <span class="metric-label">Branch</span>
                  <strong class="metric-val chip-branch">{{ data.student?.branch }}</strong>
                </div>
                <div class="metric-item">
                  <span class="metric-label">CGPA</span>
                  <strong class="metric-val cgpa-highlight">{{ data.student?.cgpa | number:'1.1-2' }}</strong>
                </div>
                <div class="metric-item">
                  <span class="metric-label">Passout Year</span>
                  <strong class="metric-val">{{ data.student?.passoutYear }}</strong>
                </div>
                <div class="metric-item">
                  <span class="metric-label">Active Backlogs</span>
                  <strong class="metric-val" [class.text-danger]="data.student?.activeBacklogs > 0">
                    {{ data.student?.activeBacklogs === 0 ? 'None' : data.student?.activeBacklogs }}
                  </strong>
                </div>
              </div>
            </div>

            <!-- Section 2: Placement Drive Audit Cards -->
            <div class="drives-section">
              <div class="section-head">
                <h4 class="section-title">
                  <span class="material-symbols-outlined">work_history</span>
                  <span>Applied Job Drives ({{ sortedApplications().length }})</span>
                </h4>
              </div>

              <!-- Empty State -->
              <div class="empty-drives-card" *ngIf="sortedApplications().length === 0">
                <span class="material-symbols-outlined empty-icon">assignment_late</span>
                <h5>No Drive Applications Found</h5>
                <p>This student has not applied to any recruitment drives yet.</p>
              </div>

              <!-- Applications Cards List -->
              <div class="drive-card" *ngFor="let app of sortedApplications()">
                <!-- Card Header -->
                <div class="card-header">
                  <div class="company-brand">
                    <div class="logo-box">
                      {{ app.companyName[0].toUpperCase() }}
                    </div>
                    <div>
                      <h4 class="company-name">{{ app.companyName }}</h4>
                      <span class="drive-title">{{ app.driveTitle }}</span>
                    </div>
                  </div>
                  <div class="card-header-right">
                    <span class="badge-app-status" [class]="getAppStatusClass(app.status)">
                      {{ app.status }}
                    </span>
                    <span class="applied-date">Applied {{ app.appliedDate | date:'mediumDate' }}</span>
                  </div>
                </div>

                <!-- Drive Key Details Row -->
                <div class="drive-meta-bar">
                  <div class="meta-chip">
                    <span class="material-symbols-outlined">payments</span>
                    <span>CTC: <strong>₹{{ app.ctc }}</strong></span>
                  </div>
                  <div class="meta-chip" *ngIf="app.aiMatchScore">
                    <span class="material-symbols-outlined">psychology</span>
                    <span>AI Match Score: <strong>{{ app.aiMatchScore }}%</strong></span>
                  </div>
                </div>

                <!-- Stage-Wise Audit Breakdown Table -->
                <div class="table-container">
                  <table class="stage-table">
                    <thead>
                      <tr>
                        <th>Stage</th>
                        <th>Status</th>
                        <th>Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      <!-- Aptitude Stage -->
                      <tr>
                        <td class="stage-name">
                          <span class="material-symbols-outlined stage-icon">quiz</span>
                          <span>Aptitude Test</span>
                        </td>
                        <td>
                          <span class="stage-badge" [class]="getStageBadgeClass(app.aptitude?.status)">
                            {{ app.aptitude?.status || 'Pending' }}
                          </span>
                        </td>
                        <td class="stage-details">
                          <span *ngIf="app.aptitude?.score !== null && app.aptitude?.score !== undefined">Score: <strong>{{ app.aptitude?.score }}%</strong></span>
                          <span *ngIf="app.aptitude?.score === null || app.aptitude?.score === undefined">—</span>
                        </td>
                      </tr>

                      <!-- GD Stage -->
                      <tr>
                        <td class="stage-name">
                          <span class="material-symbols-outlined stage-icon">forum</span>
                          <span>Group Discussion</span>
                        </td>
                        <td>
                          <span class="stage-badge" [class]="getStageBadgeClass(app.gd?.status)">
                            {{ app.gd?.status || 'Pending' }}
                          </span>
                        </td>
                        <td class="stage-details">
                          <span *ngIf="app.gd?.score !== null && app.gd?.score !== undefined">Score: <strong>{{ app.gd?.score }}%</strong></span>
                          <span *ngIf="app.gd?.score === null || app.gd?.score === undefined">—</span>
                        </td>
                      </tr>

                      <!-- Interview Stage -->
                      <tr>
                        <td class="stage-name">
                          <span class="material-symbols-outlined stage-icon">record_voice_over</span>
                          <span>Interview</span>
                        </td>
                        <td>
                          <span class="stage-badge" [class]="getStageBadgeClass(app.interview?.result)">
                            {{ app.interview?.result || 'Pending' }}
                          </span>
                        </td>
                        <td class="stage-details">
                          <span>{{ app.interview?.feedback || '—' }}</span>
                        </td>
                      </tr>

                      <!-- Offer Stage -->
                      <tr>
                        <td class="stage-name">
                          <span class="material-symbols-outlined stage-icon">verified_user</span>
                          <span>Offer Status</span>
                        </td>
                        <td>
                          <span class="stage-badge" [class]="getStageBadgeClass(app.offer?.status)">
                            {{ app.offer?.status || 'None' }}
                          </span>
                        </td>
                        <td class="stage-details">
                          <span *ngIf="app.offer?.acceptedAt">Accepted on {{ app.offer?.acceptedAt | date:'mediumDate' }}</span>
                          <span *ngIf="!app.offer?.acceptedAt">—</span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <!-- Offer Letter Link Footer if available -->
                <div class="card-footer-offer" *ngIf="app.offer?.fileId || app.offer?.filePath || app.status === 'Placed'">
                  <div class="offer-info">
                    <span class="material-symbols-outlined icon-offer">description</span>
                    <span>Official Offer Document Issued</span>
                  </div>
                  <span class="offer-status-note" *ngIf="app.offer?.status === 'Accepted'">
                    ✅ Offer Accepted by Student
                  </span>
                </div>

              </div>
            </div>

          </ng-container>

        </div>

      </div>
    </div>
  `,
  styles: [`
    :host {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      z-index: 99999;
      display: block;
    }

    .panel-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(15, 23, 42, 0.45);
      backdrop-filter: blur(4px);
      z-index: 99999;
      display: flex;
      justify-content: flex-end;
      overflow: hidden;
      touch-action: none;
      animation: fadeIn 0.25s ease-out;
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    .panel-drawer {
      width: 62vw;
      max-width: 780px;
      min-width: 320px;
      height: 100vh;
      max-height: 100vh;
      background: #f8fafc;
      box-shadow: -8px 0 32px rgba(0, 0, 0, 0.18);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      animation: slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    }

    @keyframes slideInRight {
      from { transform: translateX(100%); }
      to { transform: translateX(0); }
    }

    /* Header */
    .panel-header {
      padding: 20px 24px;
      background: #1e293b;
      color: white;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      flex-shrink: 0;
    }

    .student-title {
      margin: 0;
      font-size: 19px;
      font-weight: 800;
      display: flex;
      align-items: center;
      gap: 10px;
      color: #f8fafc;
    }

    .icon-person {
      color: #38bdf8;
      font-size: 26px;
    }

    .roll-badge {
      display: inline-block;
      margin-top: 4px;
      font-size: 12px;
      color: #94a3b8;
    }

    .roll-badge strong {
      color: #38bdf8;
    }

    .btn-close-panel {
      background: rgba(255, 255, 255, 0.1);
      border: none;
      color: white;
      font-size: 24px;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s;
    }

    .btn-close-panel:hover {
      background: rgba(255, 255, 255, 0.25);
    }

    /* Body - Invisible Scrollbar & Full Scrollability */
    .panel-body {
      flex: 1 1 auto;
      min-height: 0;
      max-height: calc(100vh - 77px);
      overflow-y: auto !important;
      -webkit-overflow-scrolling: touch;
      overscroll-behavior: contain;
      padding: 24px 24px 60px;
      display: flex;
      flex-direction: column;
      gap: 24px;
      /* Invisible scrollbar */
      scrollbar-width: none !important;
      -ms-overflow-style: none !important;
    }

    .panel-body::-webkit-scrollbar {
      display: none !important;
      width: 0 !important;
      height: 0 !important;
    }

    /* Loading / Error */
    .state-loading, .state-error {
      padding: 60px 20px;
      text-align: center;
      color: #64748b;
    }

    .spinner {
      width: 38px;
      height: 38px;
      border: 3.5px solid #e2e8f0;
      border-top-color: #0284c7;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin: 0 auto 16px auto;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    /* Profile Summary Card */
    .card-profile-summary {
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      padding: 20px 24px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.02);
    }

    .summary-top {
      display: flex;
      align-items: center;
      gap: 16px;
      padding-bottom: 18px;
      border-bottom: 1px solid #f1f5f9;
      margin-bottom: 18px;
    }

    .avatar-large {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: linear-gradient(135deg, #0284c7, #0369a1);
      color: white;
      font-size: 20px;
      font-weight: 800;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .student-meta {
      flex: 1;
    }

    .meta-name {
      margin: 0 0 2px 0;
      font-size: 18px;
      font-weight: 800;
      color: #0f172a;
    }

    .meta-sub {
      margin: 0;
      font-size: 13px;
      color: #64748b;
      font-weight: 500;
    }

    .badge-overall-status {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .status-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
    }

    .status-placed {
      background: #dcfce7;
      color: #15803d;
      border: 1px solid #86efac;
    }
    .status-placed .status-dot { background: #16a34a; }

    .status-progress {
      background: #e0f2fe;
      color: #0369a1;
      border: 1px solid #7dd3fc;
    }
    .status-progress .status-dot { background: #0284c7; }

    .status-notplaced {
      background: #fee2e2;
      color: #b91c1c;
      border: 1px solid #fca5a5;
    }
    .status-notplaced .status-dot { background: #dc2626; }

    .status-none {
      background: #f1f5f9;
      color: #64748b;
      border: 1px solid #cbd5e1;
    }
    .status-none .status-dot { background: #94a3b8; }

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
    }

    .metric-item {
      display: flex;
      flex-direction: column;
      gap: 3px;
    }

    .metric-label {
      font-size: 11px;
      font-weight: 700;
      color: #94a3b8;
      text-transform: uppercase;
    }

    .metric-val {
      font-size: 15px;
      color: #1e293b;
      font-weight: 800;
    }

    .chip-branch {
      color: #0284c7;
    }

    .cgpa-highlight {
      color: #0f172a;
    }

    .text-danger { color: #dc2626; }

    /* Section Header */
    .section-head {
      margin-bottom: 16px;
    }

    .section-title {
      margin: 0;
      font-size: 16px;
      font-weight: 800;
      color: #1e293b;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    /* Drive Cards */
    .drives-section {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .empty-drives-card {
      background: white;
      border: 1.5px dashed #cbd5e1;
      border-radius: 14px;
      padding: 36px 20px;
      text-align: center;
      color: #64748b;
    }

    .empty-icon {
      font-size: 36px;
      color: #94a3b8;
      margin-bottom: 8px;
    }

    .drive-card {
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      padding: 20px;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.02);
      display: flex;
      flex-direction: column;
      gap: 14px;
      transition: border-color 0.2s;
    }

    .drive-card:hover {
      border-color: #cbd5e1;
    }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }

    .company-brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .logo-box {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      background: #f1f5f9;
      color: #0284c7;
      font-size: 18px;
      font-weight: 800;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1px solid #e2e8f0;
    }

    .company-name {
      margin: 0 0 2px 0;
      font-size: 16px;
      font-weight: 800;
      color: #0f172a;
    }

    .drive-title {
      font-size: 12.5px;
      color: #64748b;
      font-weight: 600;
    }

    .card-header-right {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 4px;
    }

    .badge-app-status {
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 11.5px;
      font-weight: 750;
    }

    .app-placed { background: #dcfce7; color: #15803d; }
    .app-progress { background: #e0f2fe; color: #0369a1; }
    .app-rejected { background: #fee2e2; color: #b91c1c; }

    .applied-date {
      font-size: 11px;
      color: #94a3b8;
    }

    /* Drive Meta Bar */
    .drive-meta-bar {
      display: flex;
      gap: 14px;
      background: #f8fafc;
      padding: 10px 14px;
      border-radius: 8px;
      border: 1px solid #f1f5f9;
    }

    .meta-chip {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12.5px;
      color: #475569;
    }

    .meta-chip span.material-symbols-outlined {
      font-size: 16px;
      color: #0284c7;
    }

    /* Stage Table */
    .table-container {
      overflow-x: auto;
    }

    .stage-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12.5px;
    }

    .stage-table th {
      text-align: left;
      padding: 8px 12px;
      background: #f1f5f9;
      color: #475569;
      font-size: 11px;
      font-weight: 750;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .stage-table td {
      padding: 10px 12px;
      border-bottom: 1px solid #f1f5f9;
      color: #334155;
    }

    .stage-name {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 700;
    }

    .stage-icon {
      font-size: 16px;
      color: #64748b;
    }

    .stage-badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 700;
    }

    .stage-passed { background: #dcfce7; color: #15803d; }
    .stage-failed { background: #fee2e2; color: #b91c1c; }
    .stage-pending { background: #f1f5f9; color: #64748b; }

    .stage-details {
      color: #64748b;
    }

    .card-footer-offer {
      background: #eafaf1;
      border: 1px solid #a9dfbf;
      border-radius: 8px;
      padding: 10px 14px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .offer-info {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12.5px;
      font-weight: 700;
      color: #1e8449;
    }

    .icon-offer {
      font-size: 18px;
    }

    .offer-status-note {
      font-size: 12px;
      font-weight: 700;
      color: #1e8449;
    }
  `]
})
export class StudentAuditPanelComponent implements OnInit, OnChanges, OnDestroy {
  @Input({ required: true }) rollNumber!: string;
  @Output() close = new EventEmitter<void>();

  private readonly tpoService = inject(TpoService);

  protected isLoading = signal<boolean>(true);
  protected errorMsg = signal<string | null>(null);
  protected auditData = signal<{ student: any; overallStatus: string; applications: any[] } | null>(null);

  ngOnInit(): void {
    document.body.style.overflow = 'hidden';
    if (this.rollNumber) {
      this.loadAuditDetails();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['rollNumber'] && !changes['rollNumber'].isFirstChange() && this.rollNumber) {
      this.loadAuditDetails();
    }
  }

  ngOnDestroy(): void {
    document.body.style.overflow = '';
  }

  protected loadAuditDetails(): void {
    this.isLoading.set(true);
    this.errorMsg.set(null);

    this.tpoService.getStudentAuditDetails(this.rollNumber).subscribe({
      next: (res) => {
        if (res && res.success) {
          this.auditData.set({
            student: res.student,
            overallStatus: res.overallStatus,
            applications: res.applications || [],
          });
        } else {
          this.errorMsg.set('Failed to load student audit details.');
        }
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Audit details fetch error:', err);
        this.errorMsg.set(err.error?.message || 'Failed to fetch student placement audit.');
        this.isLoading.set(false);
      }
    });
  }

  protected sortedApplications(): any[] {
    const apps = this.auditData()?.applications || [];
    // Sort order: In Progress > Placed > Rejected
    return [...apps].sort((a, b) => {
      const getPriority = (status: string) => {
        if (['Placed', 'Offer Accepted'].includes(status)) return 2;
        if (['Rejected', 'Withdrawn'].includes(status)) return 3;
        return 1; // In progress / Applied / Shortlisted
      };
      return getPriority(a.status) - getPriority(b.status);
    });
  }

  protected onClose(): void {
    document.body.style.overflow = '';
    this.close.emit();
  }

  protected getOverallStatusClass(status?: string): string {
    switch (status) {
      case 'Placed': return 'status-placed';
      case 'In Progress': return 'status-progress';
      case 'Not Placed': return 'status-notplaced';
      default: return 'status-none';
    }
  }

  protected getAppStatusClass(status?: string): string {
    if (['Placed', 'Offer Accepted'].includes(status || '')) return 'app-placed';
    if (['Rejected', 'Withdrawn'].includes(status || '')) return 'app-rejected';
    return 'app-progress';
  }

  protected getStageBadgeClass(status?: string): string {
    if (['Passed', 'Shortlisted', 'Selected', 'Accepted'].includes(status || '')) return 'stage-passed';
    if (['Failed', 'Rejected', 'Declined'].includes(status || '')) return 'stage-failed';
    return 'stage-pending';
  }
}
