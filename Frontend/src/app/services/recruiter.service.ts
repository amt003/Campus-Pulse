import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface RecruiterProfile {
  recruiterId: string;
  companyName: string;
  officialEmail: string;
  website?: string;
  gstNumber?: string;
  isApproved: boolean;
  trustScore?: number;
  tpoSuggestions?: { suggestion: string; sentAt?: string }[];
  user: {
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
    });
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

  getDriveApplications(driveId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/applications/${driveId}`, {
      headers: this.getAuthHeaders(),
    });
  }
}
