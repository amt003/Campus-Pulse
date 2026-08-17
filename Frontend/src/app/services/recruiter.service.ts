import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';

export interface RecruiterProfile {
  recruiterId: string;
  companyName: string;
  officialEmail: string;
  website?: string;
  companyLogo?: string;
  isApproved: boolean;
  trustScore?: number;
  tpoSuggestions?: { suggestion: string; sentAt?: string }[];
  user: {
    _id?: string;
    name: string;
    email: string;
  };
}

export interface RecruiterProfileResponse {
  success: boolean;
  data: RecruiterProfile;
}

@Injectable({
  providedIn: 'root',
})
export class RecruiterService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:5000/api/recruiter';

  private profileSubject = new BehaviorSubject<RecruiterProfile | null>(null);
  public profile$ = this.profileSubject.asObservable();

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token') || '';
    return new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    });
  }

  getProfile(): Observable<RecruiterProfileResponse> {
    return this.http.get<RecruiterProfileResponse>(`${this.apiUrl}/profile`, {
      headers: this.getAuthHeaders(),
    }).pipe(
      tap(res => {
        if (res && res.data) {
          this.profileSubject.next(res.data);
        }
      })
    );
  }

  createDrive(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/drive`, data, {
      headers: this.getAuthHeaders(),
    });
  }

  getDrives(): Observable<any> {
    return this.http.get(`${this.apiUrl}/drives`, {
      headers: this.getAuthHeaders(),
    });
  }

  getAllApplications(): Observable<any> {
    return this.http.get(`${this.apiUrl}/all-applications`, {
      headers: this.getAuthHeaders(),
    });
  }

  getAllOffers(): Observable<any> {
    return this.http.get(`${this.apiUrl}/all-offers`, {
      headers: this.getAuthHeaders(),
    });
  }

  closeDrive(driveId: string): Observable<any> {
    return this.http.put(`${this.apiUrl}/drive/${driveId}/close`, {}, {
      headers: this.getAuthHeaders(),
    });
  }

  getDriveApplications(driveId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/applications/${driveId}`, {
      headers: this.getAuthHeaders(),
    });
  }

  private getMultipartHeaders(): HttpHeaders {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token') || '';
    return new HttpHeaders({
      Authorization: `Bearer ${token}`,
    });
  }

  updateApplicationStatus(applicationId: string, status: string): Observable<any> {
    return this.http.put(`${this.apiUrl}/application/${applicationId}/status`, { status }, {
      headers: this.getAuthHeaders(),
    });
  }

  scheduleStage(driveId: string, payload: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/schedule/${driveId}`, payload, {
      headers: this.getAuthHeaders(),
    });
  }

  scheduleEvent(payload: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/schedule`, payload, {
      headers: this.getAuthHeaders(),
    });
  }

  checkAvailability(payload: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/check-availability`, payload, {
      headers: this.getAuthHeaders(),
    });
  }

  updateProfile(formData: FormData): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/profile`, formData, {
      headers: this.getMultipartHeaders(),
    }).pipe(
      tap((res: any) => {
        if (res && res.success) {
          this.getProfile().subscribe();
        }
      })
    );
  }

  updateProfileJson(data: any): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/profile`, data, {
      headers: this.getAuthHeaders(),
    });
  }

  requestReapproval(): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/request-reapproval`, {}, {
      headers: this.getAuthHeaders(),
    });
  }


  getResumeText(applicationId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/application/${applicationId}/resume-text`, {
      headers: this.getAuthHeaders(),
    });
  }

  declareAptitudeResults(applicationIds: string[], result: string, score?: number, feedback?: string): Observable<any> {
    return this.http.put(`${this.apiUrl}/result/aptitude`, { applicationIds, result, score, feedback }, {
      headers: this.getAuthHeaders(),
    });
  }

  declareGDResults(applicationIds: string[], result: string, score?: number, feedback?: string): Observable<any> {
    return this.http.put(`${this.apiUrl}/result/gd`, { applicationIds, result, score, feedback }, {
      headers: this.getAuthHeaders(),
    });
  }

  declareInterviewResults(applicationIds: string[], result: string, score?: number, feedback?: string): Observable<any> {
    return this.http.put(`${this.apiUrl}/result/interview`, { applicationIds, result, score, feedback }, {
      headers: this.getAuthHeaders(),
    });
  }

  uploadOfferLetter(applicationId: string, file: File): Observable<any> {
    const formData = new FormData();
    formData.append('offerLetter', file);
    return this.http.post(`${this.apiUrl}/application/${applicationId}/offer`, formData, {
      headers: this.getMultipartHeaders(),
    });
  }

  getOfferTemplate(applicationId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/application/${applicationId}/offer-template`, {
      headers: this.getAuthHeaders(),
    });
  }

  bulkUploadAptitudeScores(
    driveId: string,
    cutoffScore: number,
    scores?: { rollNumber: string; score: number }[],
    csvContent?: string
  ): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/drive/${driveId}/bulk-aptitude`,
      { cutoffScore, scores, csvContent },
      { headers: this.getAuthHeaders() }
    );
  }

  getAnalytics(): Observable<any> {
    return this.http.get(`${this.apiUrl}/analytics`, {
      headers: this.getAuthHeaders(),
    });
  }

  getDriveAttachments(driveId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/drive/${driveId}/attachments`, {
      headers: this.getAuthHeaders(),
    });
  }

  uploadDriveAttachment(driveId: string, file: File): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post(`${this.apiUrl}/drive/${driveId}/attachment`, formData, {
      headers: this.getMultipartHeaders(),
    });
  }

  deleteDriveAttachment(driveId: string, fileId: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/drive/${driveId}/attachment/${fileId}`, {
      headers: this.getAuthHeaders(),
    });
  }

  resubmitDrive(driveId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/drive/${driveId}/resubmit`, {}, {
      headers: this.getAuthHeaders(),
    });
  }

  updateDrive(driveId: string, data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/drive/${driveId}`, data, {
      headers: this.getAuthHeaders(),
    });
  }
}
