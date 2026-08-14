import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface StudentProfile {
  _id: string;
  userId: {
    _id: string;
    name: string;
    email: string;
    phone?: string;
    isActive: boolean;
  };
  rollNumber: string;
  cgpa: number;
  branch: string;
  passoutYear: number;
  activeBacklogs: number;
  resumePath?: string;
  profilePicPath?: string;
  isProfileComplete: boolean;
}

export interface Drive {
  _id: string;
  title: string;
  description: string;
  ctc: number;
  minCGPA: number;
  eligibleBranches: string[];
  maxBacklogs: number;
  applicationDeadline: string;
  status: string;
  hasAptitudeTest?: boolean;
  hasGD?: boolean;
  companyName?: string;
  companyLogo?: string;
}

export interface Application {
  _id: string;
  studentId: string;
  driveId: Drive;
  status: string;
  offer: {
    status: string;
    ctc?: number;
    feedback?: string;
    uploadedDate?: string | Date;
    acceptedAt?: string | Date;
    declinedAt?: string | Date;
    declineReason?: string;
  };
  aptitude?: {
    status: string;
    score?: number | null;
    feedback?: string | null;
    markedAt?: string | Date | null;
  };
  gd?: {
    status: string;
    score?: number | null;
    feedback?: string | null;
    markedAt?: string | Date | null;
  };
  interview?: {
    status: string;
    result?: string;
    score?: number | null;
    feedback?: string | null;
    markedAt?: string | Date | null;
  };
  xai?: {
    matchScore: number | null;
    positiveSentences?: string[];
    negativeSentences?: string[];
    skillGaps?: string[];
    strongSkills?: string[];
  };
  aiMatchScore?: number | null;
  createdAt: string;
}

@Injectable({
  providedIn: 'root',
})
export class StudentService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:5000/api/student';

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token') || '';
    return new HttpHeaders({
      Authorization: `Bearer ${token}`,
    });
  }

  getProfile(): Observable<{ profile: StudentProfile }> {
    return this.http.get<{ profile: StudentProfile }>(`${this.apiUrl}/profile`, {
      headers: this.getAuthHeaders(),
    });
  }

  updateProfile(data: any): Observable<{ profile: StudentProfile }> {
    const headers = data instanceof FormData
      ? this.getAuthHeaders()
      : this.getAuthHeaders().set('Content-Type', 'application/json');
    return this.http.put<{ profile: StudentProfile }>(`${this.apiUrl}/profile`, data, {
      headers,
    });
  }

  uploadResume(formData: FormData): Observable<{ resumePath: string; profile: StudentProfile }> {
    return this.http.post<{ resumePath: string; profile: StudentProfile }>(
      `${this.apiUrl}/resume`,
      formData,
      {
        headers: this.getAuthHeaders(),
      }
    );
  }

  getEligibleDrives(): Observable<{ drives: Drive[] }> {
    return this.http.get<{ drives: Drive[] }>(`${this.apiUrl}/drives`, {
      headers: this.getAuthHeaders(),
    });
  }

  applyToDrive(driveId: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/apply/${driveId}`, {}, {
      headers: this.getAuthHeaders(),
    });
  }

  getApplications(): Observable<{ applications: Application[] }> {
    return this.http.get<{ applications: Application[] }>(`${this.apiUrl}/applications`, {
      headers: this.getAuthHeaders(),
    });
  }

  getApplicationDetails(id: string): Observable<{ application: Application; schedules: any[] }> {
    return this.http.get<{ application: Application; schedules: any[] }>(
      `${this.apiUrl}/application/${id}`,
      {
        headers: this.getAuthHeaders(),
      }
    );
  }

  getSchedule(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/schedule`, {
      headers: this.getAuthHeaders(),
    });
  }

  getOfferDetails(applicationId: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/offer/${applicationId}`, {
      headers: this.getAuthHeaders(),
    });
  }

  getOfferPdfUrl(applicationId: string): string {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token') || '';
    return `${this.apiUrl}/offer/${applicationId}/pdf?token=${token}`;
  }

  acceptOffer(applicationId: string): Observable<any> {
    return this.http.put<any>(
      `${this.apiUrl}/offer/${applicationId}/accept`,
      {},
      { headers: this.getAuthHeaders() }
    );
  }

  declineOffer(applicationId: string, reason: string): Observable<any> {
    return this.http.put<any>(
      `${this.apiUrl}/offer/${applicationId}/decline`,
      { reason },
      { headers: this.getAuthHeaders() }
    );
  }
}
