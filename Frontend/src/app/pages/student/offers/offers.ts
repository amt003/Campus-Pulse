import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StudentService, Application } from '../../../services/student.service';

@Component({
  selector: 'app-student-offers',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './offers.html',
  styleUrl: './offers.css'
})
export class StudentOffersComponent implements OnInit {
  private readonly studentService = inject(StudentService);
  protected applications = signal<Application[]>([]);
  protected isLoading = signal<boolean>(true);

  protected studentOffers = computed(() => {
    return this.applications().filter(app => app.offer && app.offer.status !== 'Not Sent');
  });

  ngOnInit(): void {
    this.loadOffers();
  }

  protected loadOffers(): void {
    this.isLoading.set(true);
    this.studentService.getApplications().subscribe({
      next: (res) => {
        if (res && res.applications) {
          this.applications.set(res.applications);
        }
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to load applications for offers:', err);
        this.isLoading.set(false);
      }
    });
  }

  protected getCTCInLpa(ctcInRupees: number): string {
    if (!ctcInRupees) return '—';
    const lpa = ctcInRupees / 100000;
    return lpa.toFixed(1) + ' LPA';
  }

  protected acceptSimulatedOffer(appId: string): void {
    if (confirm('Are you sure you want to ACCEPT this job offer? This decision is final.')) {
      this.applications.set(
        this.applications().map(app => {
          if (app._id === appId) {
            return {
              ...app,
              status: 'Placed',
              offer: { ...app.offer, status: 'Accepted', acceptedAt: new Date() }
            };
          }
          return app;
        })
      );
      alert('Congratulations! You have accepted the job offer. The placement cell has been notified. 🎉');
    }
  }

  protected declineSimulatedOffer(appId: string): void {
    const reason = prompt('Please enter your reason for declining this offer:');
    if (reason !== null) {
      this.applications.set(
        this.applications().map(app => {
          if (app._id === appId) {
            return {
              ...app,
              status: 'Rejected',
              offer: {
                ...app.offer,
                status: 'Declined',
                declinedAt: new Date(),
                declineReason: reason
              }
            };
          }
          return app;
        })
      );
      alert('You have declined the job offer. The placement cell has been notified.');
    }
  }
}
