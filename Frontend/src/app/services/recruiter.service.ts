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
}
