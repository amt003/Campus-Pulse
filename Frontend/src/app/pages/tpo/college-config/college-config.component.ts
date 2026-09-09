import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TpoService } from '../../../services/tpo.service';

@Component({
  selector: 'app-tpo-college-config',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="config-root">
      <main class="config-container">

        <!-- Page Header -->
        <div class="header-card">
          <div class="header-left">
            <div class="header-icon-badge">
              <span class="material-symbols-outlined">settings_suggest</span>
            </div>
            <div>
              <h1 class="header-title">College Configuration</h1>
              <p class="header-subtitle">
                Dynamically manage academic branches and passout years. Changes instantly reflect across student profiles, recruiter drive options, and analytics filters.
              </p>
            </div>
          </div>
        </div>

        <!-- Notification Banners -->
        <div class="banner-success" *ngIf="successMsg()">
          <span class="material-symbols-outlined">check_circle</span>
          <span>{{ successMsg() }}</span>
          <button class="btn-close-toast" (click)="successMsg.set(null)">&times;</button>
        </div>

        <div class="banner-error" *ngIf="errorMsg()">
          <span class="material-symbols-outlined">error</span>
          <span>{{ errorMsg() }}</span>
          <button class="btn-close-toast" (click)="errorMsg.set(null)">&times;</button>
        </div>

        <!-- Content Grid -->
        <div class="config-grid" *ngIf="!isLoading(); else loadingTpl">

          <!-- Section 1: Academic Branches -->
          <div class="section-card">
            <div class="card-title-bar">
              <div class="title-with-icon">
                <span class="material-symbols-outlined title-icon icon-blue">school</span>
                <div>
                  <h3 class="card-title">Academic Branches</h3>
                  <span class="card-subtitle">{{ branches().length }} active branches configured</span>
                </div>
              </div>
            </div>

            <!-- Add Branch Input Bar -->
            <div class="add-bar">
              <input
                type="text"
                class="input-add"
                placeholder="e.g. AI & DS, Cyber Security, ECE"
                [(ngModel)]="newBranchInput"
                (keyup.enter)="onAddBranch()"
              />
              <button class="btn-add" (click)="onAddBranch()" [disabled]="!newBranchInput.trim()">
                <span class="material-symbols-outlined">add</span>
                <span>Add Branch</span>
              </button>
            </div>

            <!-- Branches List -->
            <div class="items-list">
              <div class="item-chip" *ngFor="let b of branches()">
                <span class="chip-label">{{ b }}</span>
                <button class="btn-delete-chip" (click)="onDeleteBranch(b)" title="Remove Branch">
                  &times;
                </button>
              </div>
              <div class="empty-list-note" *ngIf="branches().length === 0">
                No branches configured. Add a new branch above.
              </div>
            </div>
          </div>

          <!-- Section 2: Passout Years -->
          <div class="section-card">
            <div class="card-title-bar">
              <div class="title-with-icon">
                <span class="material-symbols-outlined title-icon icon-teal">calendar_month</span>
                <div>
                  <h3 class="card-title">Passout Years</h3>
                  <span class="card-subtitle">{{ passoutYears().length }} graduating years configured</span>
                </div>
              </div>
            </div>

            <!-- Add Year Input Bar -->
            <div class="add-bar">
              <input
                type="number"
                class="input-add"
                placeholder="e.g. 2029"
                [(ngModel)]="newYearInput"
                (keyup.enter)="onAddYear()"
              />
              <button class="btn-add" (click)="onAddYear()" [disabled]="!newYearInput">
                <span class="material-symbols-outlined">add</span>
                <span>Add Year</span>
              </button>
            </div>

            <!-- Passout Years List -->
            <div class="items-list">
              <div class="item-chip chip-year" *ngFor="let y of passoutYears()">
                <span class="chip-label">Year {{ y }}</span>
                <button class="btn-delete-chip" (click)="onDeleteYear(y)" title="Remove Year">
                  &times;
                </button>
              </div>
              <div class="empty-list-note" *ngIf="passoutYears().length === 0">
                No passout years configured. Add a new year above.
              </div>
            </div>
          </div>

        </div>

        <!-- Global Save Action Footer -->
        <div class="save-footer" *ngIf="!isLoading()">
          <button class="btn-save-all" (click)="onSaveAll()" [disabled]="isSaving()">
            @if (isSaving()) {
              <span>Saving Changes...</span>
            } @else {
              <span class="material-symbols-outlined">save</span>
              <span>Save All Configuration Changes</span>
            }
          </button>
        </div>

        <ng-template #loadingTpl>
          <div class="loading-box">
            <div class="spinner"></div>
            <p>Loading college configuration…</p>
          </div>
        </ng-template>

      </main>
    </div>
  `,
  styles: [`
    .config-root {
      background: #f7f9ff;
      min-height: calc(100vh - 70px);
      padding-bottom: 60px;
    }

    .config-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 32px 24px;
      display: flex;
      flex-direction: column;
      gap: 24px;
    }

    /* Header Card */
    .header-card {
      background: white;
      border-radius: 16px;
      padding: 24px 28px;
      border: 1px solid rgba(193, 199, 207, 0.4);
      box-shadow: 0 4px 16px rgba(0, 59, 90, 0.03);
      border-top: 4px solid #006497;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 18px;
    }

    .header-icon-badge {
      width: 52px;
      height: 52px;
      border-radius: 14px;
      background: #edf4ff;
      color: #006497;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .header-icon-badge .material-symbols-outlined { font-size: 28px; }

    .header-title {
      margin: 0 0 4px 0;
      font-size: 24px;
      font-weight: 850;
      color: #003b5a;
      letter-spacing: -0.5px;
    }

    .header-subtitle {
      margin: 0;
      font-size: 13.5px;
      color: #41474e;
      font-weight: 500;
      line-height: 1.5;
    }

    /* Banners */
    .banner-success, .banner-error {
      padding: 14px 20px;
      border-radius: 12px;
      font-size: 13.5px;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 12px;
      position: relative;
    }

    .banner-success {
      background: #eafaf1;
      border: 1.5px solid #a9dfbf;
      color: #1e8449;
    }

    .banner-error {
      background: #fdedec;
      border: 1.5px solid #f5b7b1;
      color: #922b21;
    }

    .btn-close-toast {
      margin-left: auto;
      background: transparent;
      border: none;
      font-size: 20px;
      cursor: pointer;
      color: inherit;
    }

    /* Content Grid */
    .config-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 24px;
    }

    @media (max-width: 900px) {
      .config-grid { grid-template-columns: 1fr; }
    }

    .section-card {
      background: white;
      border: 1px solid rgba(193, 199, 207, 0.4);
      border-radius: 16px;
      padding: 24px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.02);
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .card-title-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .title-with-icon {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .title-icon {
      font-size: 24px;
    }

    .icon-blue { color: #0284c7; }
    .icon-teal { color: #0d9488; }

    .card-title {
      margin: 0;
      font-size: 17px;
      font-weight: 800;
      color: #0f172a;
    }

    .card-subtitle {
      font-size: 12px;
      color: #64748b;
      font-weight: 600;
    }

    /* Add Bar */
    .add-bar {
      display: flex;
      gap: 10px;
    }

    .input-add {
      flex: 1;
      border: 1.5px solid #cbd5e1;
      border-radius: 10px;
      padding: 10px 14px;
      font-size: 13.5px;
      font-family: inherit;
      outline: none;
      transition: border-color 0.2s;
    }

    .input-add:focus {
      border-color: #006497;
    }

    .btn-add {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 10px 18px;
      border-radius: 10px;
      border: none;
      background: #006497;
      color: white;
      font-size: 13px;
      font-weight: 750;
      cursor: pointer;
      transition: all 0.2s;
      flex-shrink: 0;
    }

    .btn-add:hover:not(:disabled) {
      background: #003b5a;
    }

    .btn-add:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    /* Items List */
    .items-list {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      min-height: 120px;
      align-content: flex-start;
      padding: 16px;
      background: #f8fafc;
      border-radius: 12px;
      border: 1px solid #f1f5f9;
    }

    .item-chip {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: white;
      border: 1.5px solid #cbd5e1;
      padding: 7px 12px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 750;
      color: #1e293b;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
      transition: all 0.2s;
    }

    .chip-year {
      border-color: #99f6e4;
      background: #f0fdfa;
      color: #0f766e;
    }

    .item-chip:hover {
      border-color: #94a3b8;
    }

    .btn-delete-chip {
      background: rgba(239, 68, 68, 0.1);
      border: none;
      color: #ef4444;
      font-size: 16px;
      line-height: 1;
      width: 22px;
      height: 22px;
      border-radius: 50%;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
    }

    .btn-delete-chip:hover {
      background: #ef4444;
      color: white;
    }

    .empty-list-note {
      font-size: 13px;
      color: #94a3b8;
      font-style: italic;
    }

    /* Save Footer */
    .save-footer {
      background: white;
      border: 1px solid rgba(193, 199, 207, 0.4);
      border-radius: 16px;
      padding: 20px 28px;
      display: flex;
      justify-content: flex-end;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.02);
    }

    .btn-save-all {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 28px;
      border-radius: 12px;
      border: none;
      background: linear-gradient(135deg, #006497, #003b5a);
      color: white;
      font-size: 14px;
      font-weight: 800;
      cursor: pointer;
      box-shadow: 0 4px 14px rgba(0, 100, 151, 0.25);
      transition: all 0.2s;
    }

    .btn-save-all:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 6px 18px rgba(0, 100, 151, 0.35);
    }

    .loading-box {
      padding: 80px;
      text-align: center;
      color: #64748b;
    }

    .spinner {
      width: 40px;
      height: 40px;
      border: 3.5px solid #e2e8f0;
      border-top-color: #006497;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin: 0 auto 16px auto;
    }

    @keyframes spin { to { transform: rotate(360deg); } }
  `]
})
export class TpoCollegeConfigComponent implements OnInit {
  private readonly tpoService = inject(TpoService);

  protected isLoading = signal<boolean>(true);
  protected isSaving = signal<boolean>(false);
  protected successMsg = signal<string | null>(null);
  protected errorMsg = signal<string | null>(null);

  protected branches = signal<string[]>([]);
  protected passoutYears = signal<number[]>([]);

  protected newBranchInput: string = '';
  protected newYearInput: number | null = null;

  ngOnInit(): void {
    this.loadCollegeConfig();
  }

  protected loadCollegeConfig(): void {
    this.isLoading.set(true);
    this.errorMsg.set(null);

    this.tpoService.getCollegeConfig().subscribe({
      next: (res) => {
        if (res && res.data) {
          this.branches.set(res.data.branches || []);
          this.passoutYears.set((res.data.passoutYears || []).sort((a: number, b: number) => a - b));
        }
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to fetch college config:', err);
        this.errorMsg.set(err.error?.message || 'Failed to load college configuration.');
        this.isLoading.set(false);
      }
    });
  }

  protected onAddBranch(): void {
    const val = this.newBranchInput.trim().toUpperCase();
    if (!val) return;

    if (this.branches().includes(val)) {
      this.errorMsg.set(`Branch "${val}" already exists.`);
      return;
    }

    this.tpoService.addBranch(val).subscribe({
      next: (res) => {
        if (res && res.data) {
          this.branches.set(res.data.branches || []);
        } else {
          this.branches.set([...this.branches(), val]);
        }
        this.newBranchInput = '';
        this.successMsg.set(`Branch "${val}" added successfully.`);
      },
      error: (err) => {
        this.errorMsg.set(err.error?.message || `Failed to add branch "${val}".`);
      }
    });
  }

  protected onDeleteBranch(branch: string): void {
    this.errorMsg.set(null);
    this.successMsg.set(null);

    this.tpoService.deleteBranch(branch).subscribe({
      next: (res) => {
        if (res && res.data) {
          this.branches.set(res.data.branches || []);
        } else {
          this.branches.set(this.branches().filter(b => b !== branch));
        }
        this.successMsg.set(`Branch "${branch}" removed successfully.`);
      },
      error: (err) => {
        this.errorMsg.set(err.error?.message || `Cannot delete branch "${branch}".`);
      }
    });
  }

  protected onAddYear(): void {
    if (!this.newYearInput) return;
    const yearNum = Number(this.newYearInput);

    if (isNaN(yearNum) || yearNum < 1990 || yearNum > 2100) {
      this.errorMsg.set('Please enter a valid 4-digit year.');
      return;
    }

    if (this.passoutYears().includes(yearNum)) {
      this.errorMsg.set(`Passout year ${yearNum} already exists.`);
      return;
    }

    this.tpoService.addPassoutYear(yearNum).subscribe({
      next: (res) => {
        if (res && res.data) {
          this.passoutYears.set((res.data.passoutYears || []).sort((a: number, b: number) => a - b));
        } else {
          this.passoutYears.set([...this.passoutYears(), yearNum].sort((a: number, b: number) => a - b));
        }
        this.newYearInput = null;
        this.successMsg.set(`Passout year ${yearNum} added successfully.`);
      },
      error: (err) => {
        this.errorMsg.set(err.error?.message || `Failed to add passout year ${yearNum}.`);
      }
    });
  }

  protected onDeleteYear(year: number): void {
    this.errorMsg.set(null);
    this.successMsg.set(null);

    this.tpoService.deletePassoutYear(year).subscribe({
      next: (res) => {
        if (res && res.data) {
          this.passoutYears.set((res.data.passoutYears || []).sort((a: number, b: number) => a - b));
        } else {
          this.passoutYears.set(this.passoutYears().filter(y => y !== year));
        }
        this.successMsg.set(`Passout year ${year} removed successfully.`);
      },
      error: (err) => {
        this.errorMsg.set(err.error?.message || `Cannot delete year ${year}.`);
      }
    });
  }

  protected onSaveAll(): void {
    this.isSaving.set(true);
    this.errorMsg.set(null);
    this.successMsg.set(null);

    this.tpoService.updateCollegeConfig({
      branches: this.branches(),
      passoutYears: this.passoutYears(),
    }).subscribe({
      next: (res) => {
        this.isSaving.set(false);
        this.successMsg.set('All college configuration changes saved successfully!');
      },
      error: (err) => {
        this.isSaving.set(false);
        this.errorMsg.set(err.error?.message || 'Failed to save configuration changes.');
      }
    });
  }
}
