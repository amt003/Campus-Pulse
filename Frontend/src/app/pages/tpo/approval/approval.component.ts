import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { TpoService, PendingRecruiter } from '../../../services/tpo.service';

@Component({
  selector: 'app-tpo-approval',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './approval.component.html',
  styleUrl: './approval.component.css',
})
export class TpoApprovalComponent implements OnInit {
  private readonly tpoService = inject(TpoService);

  protected isLoading = signal<boolean>(true);
  protected isRefreshing = signal<boolean>(false);
  
  // Tab lists
  protected pendingList = signal<PendingRecruiter[]>([]);
  protected onHoldList = signal<PendingRecruiter[]>([]);
  protected approvedList = signal<PendingRecruiter[]>([]);
  protected activeTab = signal<'pending' | 'on_hold' | 'approved'>('pending');

  protected expandedRecruiterId = signal<string | null>(null);

  // Modals & Suggestions state
  protected selectedRecruiter = signal<PendingRecruiter | null>(null);
  protected isApproveModalOpen = signal<boolean>(false);
  protected isProcessing = signal<boolean>(false);

  protected suggestionInputs = signal<Record<string, string>>({});
  protected isSendingSuggestion = signal<string | null>(null);
  protected suggestionSuccessMsg = signal<Record<string, string>>({});
  protected reVerifyingId = signal<string | null>(null);
  protected reVerifyingMcaId = signal<string | null>(null);
  protected isHoldProcessing = signal<string | null>(null);
  protected holdErrorMsg = signal<Record<string, string>>({});

  ngOnInit(): void {
    this.loadAllRecruiters();
  }

  protected loadAllRecruiters(isInitial = true): void {
    if (isInitial) this.isLoading.set(true);
    this.isRefreshing.set(true);

    forkJoin({
      pending: this.tpoService.getPendingRecruiters(),
      onHold: this.tpoService.getOnHoldRecruiters(),
      approved: this.tpoService.getApprovedRecruiters()
    }).subscribe({
      next: (res) => {
        this.pendingList.set(res.pending || []);
        this.onHoldList.set(res.onHold || []);
        this.approvedList.set(res.approved || []);
        this.isLoading.set(false);
        this.isRefreshing.set(false);
      },
      error: (err) => {
        console.error('Failed to load recruiters:', err);
        this.isLoading.set(false);
        this.isRefreshing.set(false);
      }
    });
  }

  protected get currentRecruitersList(): PendingRecruiter[] {
    const tab = this.activeTab();
    if (tab === 'pending') return this.pendingList();
    if (tab === 'on_hold') return this.onHoldList();
    return this.approvedList();
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
        this.loadAllRecruiters(false);
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
    // Always use the backend-computed trustScore as the authoritative total
    const total = rec.trustScore ?? 0;
    const storedBreakdown = rec.verificationDetails?.breakdown;
    const hasRealVerification = rec.verificationDetails?.verifiedAt != null;

    if (hasRealVerification && storedBreakdown) {
      return {
        domainAge: storedBreakdown.domainAge ?? 0,
        emailMatch: storedBreakdown.emailMatch ?? 0,
        mca: (storedBreakdown as any).mca ?? 0,
        total,
      };
    }

    // Fallback: estimate sub-scores from WHOIS data if real verification not yet run
    const age = rec.verificationDetails?.whoisData?.domainAgeYears;
    const domainAge = age ? (age >= 10 ? 50 : age >= 3 ? 40 : 30) : 30;
    const emailMatch = Math.max(0, Math.min(50, total - domainAge));
    const mca = Math.max(0, total - (domainAge + emailMatch));

    return { domainAge, emailMatch, mca, total };
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

  protected confirmHold(recId: string): void {
    const feedback = this.suggestionInputs()[recId];
    if (!feedback || !feedback.trim()) {
      this.holdErrorMsg.update((prev) => ({
        ...prev,
        [recId]: 'Please provide feedback before putting the recruiter on hold.',
      }));
      return;
    }

    this.holdErrorMsg.update((prev) => { const n = {...prev}; delete n[recId]; return n; });
    this.isHoldProcessing.set(recId);

    this.tpoService.putRecruiterOnHold(recId, { feedback: feedback.trim() }).subscribe({
      next: () => {
        this.isHoldProcessing.set(null);
        this.suggestionInputs.update((prev) => ({ ...prev, [recId]: '' }));
        this.loadAllRecruiters(false);
      },
      error: (err) => {
        console.error('Failed to put recruiter on hold:', err);
        this.isHoldProcessing.set(null);
        this.holdErrorMsg.update((prev) => ({
          ...prev,
          [recId]: err?.error?.message || 'Failed to put recruiter on hold.',
        }));
      },
    });
  }

  protected getMcaLookupUrl(rec: PendingRecruiter): string {
    const query = rec.verificationDetails?.mcaData?.cin || rec.companyName || '';
    return `https://www.zaubacorp.com/companysearchresults?search=${encodeURIComponent(query)}`;
  }

  protected reVerify(recId: string): void {
    this.reVerifyingId.set(recId);
    this.tpoService.reVerifyRecruiter(recId).subscribe({
      next: () => {
        this.reVerifyingId.set(null);
        this.loadAllRecruiters(false);
      },
      error: (err) => {
        console.error('Re-verification failed:', err);
        this.reVerifyingId.set(null);
      },
    });
  }

  protected mcaReVerify(recId: string): void {
    this.reVerifyingMcaId.set(recId);
    this.tpoService.reverifyRecruiter(recId).subscribe({
      next: () => {
        this.reVerifyingMcaId.set(null);
        this.loadAllRecruiters(false);
      },
      error: (err) => {
        console.error('MCA Re-verification failed:', err);
        this.reVerifyingMcaId.set(null);
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
