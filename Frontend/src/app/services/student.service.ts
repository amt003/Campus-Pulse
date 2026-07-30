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
  };
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

  updateProfile(data: Partial<StudentProfile>): Observable<{ profile: StudentProfile }> {
    return this.http.put<{ profile: StudentProfile }>(`${this.apiUrl}/profile`, data, {
      headers: this.getAuthHeaders().set('Content-Type', 'application/json'),
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
}
