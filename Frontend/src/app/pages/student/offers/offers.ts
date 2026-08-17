import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { StudentService } from '../../../services/student.service';
import { ToastService } from '../../../services/toast.service';

@Component({
  selector: 'app-student-offers',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './offers.html',
  styleUrl: './offers.css'
})
export class StudentOffersComponent implements OnInit {
  private readonly studentService = inject(StudentService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly toastService = inject(ToastService);

  protected isSingleOfferMode = signal<boolean>(false);
  protected currentApplicationId = signal<string | null>(null);

  protected selectedApplication = signal<any | null>(null);
  protected offerDetails = signal<any | null>(null);
  protected driveDetails = signal<any | null>(null);
  protected allOffers = signal<any[]>([]);
  
  protected safePdfUrl: SafeResourceUrl | null = null;
  protected isLoading = signal<boolean>(true);
  protected errorMessage = signal<string>('');
  protected successMessage = signal<string>('');

  // Inline accept confirmation (replaces native confirm())
  protected isConfirmingAccept = signal<boolean>(false);

  // Decline Modal States
  protected isDeclineModalOpen = signal<boolean>(false);
  protected selectedDeclineReason = signal<string>('Better Offer');
  protected isSubmittingAction = signal<boolean>(false);

  protected declineReasons: string[] = [
    'Better Offer',
    'Low CTC',
    'Location Issue',
    'Personal Reasons'
  ];

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      const appId = params['applicationId'];
      if (appId) {
        this.isSingleOfferMode.set(true);
        this.currentApplicationId.set(appId);
        this.loadSingleOffer(appId);
      } else {
        this.isSingleOfferMode.set(false);
        this.loadAllOffers();
      }
    });
  }

  protected loadSingleOffer(appId: string): void {
    this.isLoading.set(true);
    this.errorMessage.set('');

    this.studentService.getOfferDetails(appId).subscribe({
      next: (res) => {
        if (res && res.success) {
          this.selectedApplication.set(res.application);
          this.offerDetails.set(res.offer || res.application?.offer);
          this.driveDetails.set(res.drive || res.application?.driveId);

          const pdfApiUrl = this.studentService.getOfferPdfUrl(appId);
          this.safePdfUrl = this.sanitizer.bypassSecurityTrustResourceUrl(pdfApiUrl);
        } else {
          this.errorMessage.set('Offer letter details not found.');
          this.toastService.error('Offer not found', 'Offer letter details could not be loaded');
        }
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to load offer details:', err);
        const errMsg = err.error?.message || 'Failed to fetch offer letter details.';
        this.errorMessage.set(errMsg);
        this.toastService.error(
          'Failed to load offer',
          err.error?.message || 'Check your connection and try again'
        );
        this.isLoading.set(false);
      }
    });
  }

  protected loadAllOffers(): void {
    this.isLoading.set(true);
    this.studentService.getApplications().subscribe({
      next: (res) => {
        const apps = res.applications || [];
        const offers = apps.filter(app => app.offer && app.offer.status && app.offer.status !== 'Not Sent');
        this.allOffers.set(offers);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to load offers list:', err);
        this.isLoading.set(false);
      }
    });
  }

  protected getDaysRemaining(expiryDate: string | Date | undefined): number {
    if (!expiryDate) return 7;
    const expiry = new Date(expiryDate).getTime();
    const now = new Date().getTime();
    const diffDays = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  }

  protected acceptOffer(): void {
    const appId = this.currentApplicationId();
    if (!appId) return;

    if (!this.isConfirmingAccept()) {
      // First click: ask for inline confirmation
      this.isConfirmingAccept.set(true);
      return;
    }

    // Second click: confirmed
    this.isConfirmingAccept.set(false);
    this.isSubmittingAction.set(true);

    this.studentService.acceptOffer(appId).subscribe({
      next: (res) => {
        this.isSubmittingAction.set(false);
        const company = this.driveDetails()?.company ?? this.driveDetails()?.title ?? '';
        this.toastService.success(
          'Offer accepted',
          company ? `Placement status updated — ${company}` : 'Your placement status has been updated'
        );
        this.loadSingleOffer(appId);
      },
      error: (err) => {
        this.isSubmittingAction.set(false);
        this.toastService.error(
          'Offer acceptance failed',
          err.error?.message || 'Try again or contact the placement cell'
        );
      }
    });
  }

  protected cancelAcceptConfirm(): void {
    this.isConfirmingAccept.set(false);
  }

  protected openDeclineModal(): void {
    this.selectedDeclineReason.set('Better Offer');
    this.isDeclineModalOpen.set(true);
  }

  protected closeDeclineModal(): void {
    this.isDeclineModalOpen.set(false);
  }

  protected confirmDeclineOffer(): void {
    const appId = this.currentApplicationId();
    if (!appId) return;

    this.isSubmittingAction.set(true);
    const reason = this.selectedDeclineReason();

    this.studentService.declineOffer(appId, reason).subscribe({
      next: (res) => {
        this.isSubmittingAction.set(false);
        this.closeDeclineModal();
        this.toastService.info(
          'Offer declined',
          'The placement cell has been updated'
        );
        this.loadSingleOffer(appId);
      },
      error: (err) => {
        this.isSubmittingAction.set(false);
        this.toastService.error(
          'Offer decline failed',
          err.error?.message || 'Try again or contact the placement cell'
        );
      }
    });
  }
}
