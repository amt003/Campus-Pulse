import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { RecruiterService } from '../../../services/recruiter.service';
import { ToastService } from '../../../services/toast.service';

@Component({
  selector: 'app-recruiter-offers',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './offers.html',
  styleUrl: './offers.css'
})
export class RecruiterOffersComponent implements OnInit {
  private readonly recruiterService = inject(RecruiterService);
  private readonly toastService = inject(ToastService);
  private readonly router = inject(Router);

  protected offers = signal<any[]>([]);
  protected isLoading = signal<boolean>(true);

  // Filters
  protected searchTerm = signal<string>('');
  protected selectedStatus = signal<string>('all');

  // Modal for inspecting decline reasons or offer preview
  protected selectedOfferForModal = signal<any | null>(null);
  protected isDeclineModalOpen = signal<boolean>(false);

  ngOnInit(): void {
    this.fetchOffers();
  }

  protected fetchOffers(): void {
    this.isLoading.set(true);
    this.recruiterService.getAllOffers().subscribe({
      next: (res) => {
        this.isLoading.set(false);
        if (res && res.offers) {
          this.offers.set(res.offers);
        }
      },
      error: (err) => {
        this.isLoading.set(false);
        this.toastService.error('Failed to load offer letters', err.error?.message || 'Try again later');
      }
    });
  }

  // KPIs
  protected totalOffers = computed(() => this.offers().length);
  protected acceptedOffers = computed(() => 
    this.offers().filter(o => o.offer?.status === 'Accepted' || o.status === 'Placed' || o.status === 'Offer Accepted').length
  );
  protected declinedOffers = computed(() => 
    this.offers().filter(o => o.offer?.status === 'Declined' || o.status === 'Offer Declined').length
  );
  protected pendingOffers = computed(() => 
    this.totalOffers() - (this.acceptedOffers() + this.declinedOffers())
  );

  protected filteredOffers = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    const statusFilter = this.selectedStatus();

    return this.offers().filter(app => {
      const studentName = app.studentId?.userId?.name?.toLowerCase() || '';
      const rollNumber = app.studentId?.rollNumber?.toLowerCase() || '';
      const driveTitle = app.driveId?.title?.toLowerCase() || '';

      const matchesSearch = !term || 
        studentName.includes(term) || 
        rollNumber.includes(term) || 
        driveTitle.includes(term);

      const offerStatus = app.offer?.status || app.status;
      let matchesStatus = true;
      if (statusFilter === 'accepted') {
        matchesStatus = ['Accepted', 'Placed', 'Offer Accepted'].includes(offerStatus);
      } else if (statusFilter === 'declined') {
        matchesStatus = ['Declined', 'Offer Declined'].includes(offerStatus);
      } else if (statusFilter === 'pending') {
        matchesStatus = ['Sent', 'Viewed', 'Downloaded'].includes(offerStatus);
      }

      return matchesSearch && matchesStatus;
    });
  });

  protected getCTCInLpa(ctcInRupees?: number): string {
    if (!ctcInRupees) return '—';
    const lpa = ctcInRupees / 100000;
    return lpa.toFixed(1) + ' LPA';
  }

  protected openDeclineReasonModal(app: any): void {
    this.selectedOfferForModal.set(app);
    this.isDeclineModalOpen.set(true);
  }

  protected closeDeclineReasonModal(): void {
    this.isDeclineModalOpen.set(false);
    this.selectedOfferForModal.set(null);
  }

  protected downloadOfferLetter(appId: string): void {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token') || '';
    const downloadUrl = `http://localhost:5000/api/recruiter/offer/${appId}/pdf?token=${token}`;
    window.open(downloadUrl, '_blank');
  }

  protected viewOfferGenerator(appId: string): void {
    this.router.navigate(['/recruiter/offer', appId]);
  }
}
