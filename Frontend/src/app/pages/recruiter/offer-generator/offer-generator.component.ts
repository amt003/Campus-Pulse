import {
  Component,
  OnInit,
  AfterViewInit,
  ViewChild,
  ElementRef,
  inject,
  signal,
  computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { RecruiterService } from '../../../services/recruiter.service';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export interface OfferTemplateData {
  applicationId: string;
  studentName: string;
  rollNumber: string;
  branch: string;
  jobRole: string;
  ctc: string;
  companyName: string;
  officialEmail?: string;
  website?: string;
  companyLogo?: string | null;
  topSkill?: string;
}

@Component({
  selector: 'app-offer-generator',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './offer-generator.component.html',
  styleUrl: './offer-generator.component.css'
})
export class OfferGeneratorComponent implements OnInit, AfterViewInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly recruiterService = inject(RecruiterService);
  private readonly sanitizer = inject(DomSanitizer);

  @ViewChild('signatureCanvas') signatureCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('offerPreviewRef') offerPreviewRef!: ElementRef<HTMLDivElement>;

  // Component States
  protected applicationId = signal<string>('');
  protected isLoading = signal<boolean>(true);
  protected isSubmitting = signal<boolean>(false);
  protected errorMessage = signal<string | null>(null);
  protected successMessage = signal<string | null>(null);

  // Offer Letter Form Data
  protected templateData = signal<OfferTemplateData | null>(null);
  protected joiningDate = signal<string>('');
  protected signatureImgUrl = signal<string | null>(null);
  protected todayFormatted = signal<string>('');

  // Signature Pad Canvas States
  private ctx: CanvasRenderingContext2D | null = null;
  private isDrawing = false;
  protected hasSigned = signal<boolean>(false);

  ngOnInit(): void {
    const today = new Date();
    this.todayFormatted.set(today.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }));

    // Default joining date = 30 days from today
    const defaultJoining = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
    this.joiningDate.set(defaultJoining.toISOString().split('T')[0]);

    this.route.params.subscribe(params => {
      const id = params['applicationId'];
      if (id) {
        this.applicationId.set(id);
        this.fetchOfferTemplate(id);
      } else {
        this.errorMessage.set('Invalid Application ID.');
        this.isLoading.set(false);
      }
    });
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.initSignaturePad();
    }, 300);
  }

  protected fetchOfferTemplate(appId: string): void {
    this.isLoading.set(true);
    this.recruiterService.getOfferTemplate(appId).subscribe({
      next: (res) => {
        if (res && res.success) {
          this.templateData.set(res.data);
          setTimeout(() => {
            this.initSignaturePad();
          }, 100);
        } else {
          this.errorMessage.set('Failed to fetch offer template data.');
        }
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error fetching offer template:', err);
        this.errorMessage.set(err.error?.message || 'Failed to load offer letter template.');
        this.isLoading.set(false);
      }
    });
  }

  // ── Signature Pad Logic ───────────────────────────────────────────────────
  private initSignaturePad(): void {
    if (!this.signatureCanvas) return;
    const canvas = this.signatureCanvas.nativeElement;
    this.ctx = canvas.getContext('2d');
    if (!this.ctx) return;

    // Set canvas dimensions
    canvas.width = canvas.offsetWidth || 340;
    canvas.height = canvas.offsetHeight || 130;

    this.ctx.lineWidth = 2.5;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.strokeStyle = '#1A5276'; // Primary Brand Navy
  }

  protected startDrawing(event: MouseEvent | TouchEvent): void {
    this.isDrawing = true;
    const pos = this.getCanvasPos(event);
    if (this.ctx) {
      this.ctx.beginPath();
      this.ctx.moveTo(pos.x, pos.y);
    }
  }

  protected draw(event: MouseEvent | TouchEvent): void {
    if (!this.isDrawing || !this.ctx) return;
    event.preventDefault();
    const pos = this.getCanvasPos(event);
    this.ctx.lineTo(pos.x, pos.y);
    this.ctx.stroke();
    this.hasSigned.set(true);
    this.updateSignatureImage();
  }

  protected stopDrawing(): void {
    if (this.isDrawing) {
      this.isDrawing = false;
      this.updateSignatureImage();
    }
  }

  protected clearSignature(): void {
    if (!this.signatureCanvas || !this.ctx) return;
    const canvas = this.signatureCanvas.nativeElement;
    this.ctx.clearRect(0, 0, canvas.width, canvas.height);
    this.hasSigned.set(false);
    this.signatureImgUrl.set(null);
  }

  private updateSignatureImage(): void {
    if (!this.signatureCanvas || !this.hasSigned()) return;
    const canvas = this.signatureCanvas.nativeElement;
    this.signatureImgUrl.set(canvas.toDataURL('image/png'));
  }

  private getCanvasPos(event: MouseEvent | TouchEvent): { x: number; y: number } {
    const canvas = this.signatureCanvas.nativeElement;
    const rect = canvas.getBoundingClientRect();
    let clientX = 0;
    let clientY = 0;

    if (event instanceof MouseEvent) {
      clientX = event.clientX;
      clientY = event.clientY;
    } else if (event.touches && event.touches[0]) {
      clientX = event.touches[0].clientX;
      clientY = event.touches[0].clientY;
    }

    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  }

  // ── Dynamic Date Formatter ─────────────────────────────────────────────────
  protected getFormattedJoiningDate(): string {
    if (!this.joiningDate()) return 'As mutually agreed';
    const d = new Date(this.joiningDate());
    if (isNaN(d.getTime())) return this.joiningDate();
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }

  // ── Attach & Send Offer (HTML2Canvas + jsPDF to Server Upload) ────────────
  protected async attachAndSendOffer(): Promise<void> {
    if (!this.joiningDate()) {
      this.errorMessage.set('Please select a valid Joining Date.');
      return;
    }

    if (!this.hasSigned()) {
      this.errorMessage.set('Please draw your Digital Signature on the canvas before sending.');
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);
    this.successMessage.set('Generating high-resolution PDF document...');

    try {
      const element = this.offerPreviewRef.nativeElement;
      
      // Capture preview HTML element as high resolution Canvas
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95);

      // Create A4 PDF document (210mm x 297mm)
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, Math.min(imgHeight, pdfHeight));

      // Convert PDF to Blob
      const pdfBlob = pdf.output('blob');
      const studentName = this.templateData()?.studentName || 'Candidate';
      const fileName = `Offer_Letter_${studentName.replace(/\s+/g, '_')}.pdf`;
      const pdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' });

      this.successMessage.set('Uploading offer letter to server...');

      // Call uploadOfferLetter API
      this.recruiterService.uploadOfferLetter(this.applicationId(), pdfFile).subscribe({
        next: (res) => {
          this.isSubmitting.set(false);
          this.successMessage.set('🎉 Offer letter attached and sent successfully!');
          setTimeout(() => {
            this.router.navigate(['/recruiter/dashboard']);
          }, 1800);
        },
        error: (err) => {
          console.error('Upload offer error:', err);
          this.isSubmitting.set(false);
          this.errorMessage.set(err.error?.message || 'Failed to upload offer letter to server.');
          setTimeout(() => this.errorMessage.set(null), 10000);
        }
      });

    } catch (err: any) {
      console.error('PDF Generation Error:', err);
      this.isSubmitting.set(false);
      this.errorMessage.set('Failed to generate PDF document: ' + err.message);
      setTimeout(() => this.errorMessage.set(null), 10000);
    }
  }

  protected goBack(): void {
    this.router.navigate(['/recruiter/dashboard']);
  }
}
