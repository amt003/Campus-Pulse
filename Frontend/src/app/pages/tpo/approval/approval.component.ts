import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TpoService, PendingRecruiter } from '../../../services/tpo.service';

@Component({
  selector: 'app-tpo-approval',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './approval.component.html',
  styleUrl: './approval.component.css',
})
export class TpoApprovalComponent implements OnInit {
  private readonly tpoService = inject(TpoService);

  protected isLoading = signal<boolean>(true);
  protected isRefreshing = signal<boolean>(false);
  protected pendingRecruiters = signal<PendingRecruiter[]>([]);
  protected expandedRecruiterId = signal<string | null>(null);

  // Modals & Suggestions state
  protected selectedRecruiter = signal<PendingRecruiter | null>(null);
  protected isApproveModalOpen = signal<boolean>(false);
  protected isRejectModalOpen = signal<boolean>(false);
  protected isProcessing = signal<boolean>(false);

  protected suggestionInputs = signal<Record<string, string>>({});
  protected isSendingSuggestion = signal<string | null>(null);
  protected suggestionSuccessMsg = signal<Record<string, string>>({});

  ngOnInit(): void {
    this.loadPendingRecruiters();
  }

  protected loadPendingRecruiters(isInitial = true): void {
    if (isInitial) this.isLoading.set(true);
    this.isRefreshing.set(true);

    this.tpoService.getPendingRecruiters().subscribe({
      next: (data) => {
        this.pendingRecruiters.set(data || []);
        this.isLoading.set(false);
        this.isRefreshing.set(false);
      },
      error: (err) => {
        console.error('Failed to load pending recruiters:', err);
        this.isLoading.set(false);
        this.isRefreshing.set(false);
      },
    });
  }

  protected toggleExpand(id: string): void {
    if (this.expandedRecruiterId() === id) {
      this.expandedRecruiterId.set(null);
    } else {
      this.expandedRecruiterId.set(id);
    }
  }

  // Modals
  protected openApproveModal(rec: PendingRecruiter): void {
    this.selectedRecruiter.set(rec);
    this.isApproveModalOpen.set(true);
  }

  protected closeApproveModal(): void {
    this.isApproveModalOpen.set(false);
    this.selectedRecruiter.set(null);
  }

  protected confirmApprove(): void {
    const rec = this.selectedRecruiter();
    if (!rec) return;

    this.isProcessing.set(true);
    this.tpoService.approveRecruiter(rec._id).subscribe({
      next: () => {
        this.isProcessing.set(false);
        this.closeApproveModal();
        this.loadPendingRecruiters(false);
      },
      error: () => this.isProcessing.set(false),
    });
  }

  protected openRejectModal(rec: PendingRecruiter): void {
    this.selectedRecruiter.set(rec);
    this.isRejectModalOpen.set(true);
  }

  protected closeRejectModal(): void {
    this.isRejectModalOpen.set(false);
    this.selectedRecruiter.set(null);
  }

  protected confirmReject(): void {
    const rec = this.selectedRecruiter();
    if (!rec) return;

    this.isProcessing.set(true);
    this.tpoService.rejectRecruiter(rec._id).subscribe({
      next: () => {
        this.isProcessing.set(false);
        this.closeRejectModal();
        this.loadPendingRecruiters(false);
      },
      error: () => this.isProcessing.set(false),
    });
  }

  // Real Dynamic Recruiter Data Extractor
  protected getFormattedDomain(rec: PendingRecruiter): string {
    if (rec.verificationDetails?.whoisData?.domain) return rec.verificationDetails.whoisData.domain;
    if (rec.website) return rec.website.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
    if (rec.officialEmail && rec.officialEmail.includes('@')) return rec.officialEmail.split('@')[1];
    return 'company.com';
  }

  protected getFormattedDomainAge(rec: PendingRecruiter): string {
    const age = rec.verificationDetails?.whoisData?.domainAgeYears;
    return age ? `${age} years` : 'Verify on WHOIS';
  }

  protected getFormattedRegistrar(rec: PendingRecruiter): string {
    return rec.verificationDetails?.whoisData?.registrar || 'Verify on WHOIS';
  }

  protected getWhoisLookupUrl(rec: PendingRecruiter): string {
    const domain = this.getFormattedDomain(rec);
    return `https://whois.domaintools.com/${domain}`;
  }

  protected getFormattedBreakdown(rec: PendingRecruiter) {
    const age = rec.verificationDetails?.whoisData?.domainAgeYears;
    const domainAge = age ? (age >= 10 ? 50 : age >= 3 ? 40 : 30) : 30;

    let emailMatch = 15;
    const officialEmail = (rec.officialEmail || '').toLowerCase();
    const domain = this.getFormattedDomain(rec).toLowerCase();
    if (officialEmail && domain && (officialEmail.endsWith(domain) || domain.includes(officialEmail.split('@')[1] || ''))) {
      emailMatch = 50;
    }

    const total = Math.min(100, domainAge + emailMatch);

    return { domainAge, emailMatch, total };
  }

  protected updateSuggestionInput(recId: string, val: string): void {
    this.suggestionInputs.update((prev) => ({ ...prev, [recId]: val }));
  }

  protected sendSuggestion(recId: string): void {
    const text = this.suggestionInputs()[recId];
    if (!text || !text.trim()) return;

    this.isSendingSuggestion.set(recId);
    this.tpoService.sendRecruiterSuggestion(recId, text.trim()).subscribe({
      next: () => {
        this.isSendingSuggestion.set(null);
        this.suggestionSuccessMsg.update((prev) => ({
          ...prev,
          [recId]: 'Suggestion & feedback sent to recruiter successfully!',
        }));
        this.suggestionInputs.update((prev) => ({ ...prev, [recId]: '' }));
        setTimeout(() => {
          this.suggestionSuccessMsg.update((prev) => {
            const nextObj = { ...prev };
            delete nextObj[recId];
            return nextObj;
          });
        }, 4000);
      },
      error: (err) => {
        console.error('Failed to send suggestion:', err);
        this.isSendingSuggestion.set(null);
      },
    });
  }

  protected getTrustScoreColor(score?: number): string {
    const s = score || 0;
    if (s >= 80) return '#27AE60';
    if (s >= 60) return '#F39C12';
    return '#E74C3C';
  }
}
