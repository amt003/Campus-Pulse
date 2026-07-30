import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, map } from 'rxjs';

export interface DashboardAnalytics {
  totalStudents: number;
  totalPlaced: number;
  totalUnplaced: number;
  placementPercentage: number;
  activeDrives: number;
  pendingApprovals: number;
}

export interface FunnelStage {
  stage: string;
  count: number;
}

export interface BranchStat {
  branch: string;
  total: number;
  placed: number;
  percentage: number;
}

export interface OfferTrends {
  totalOffers: number;
  accepted: number;
  declined: number;
  acceptanceRate: number;
}

export interface VerificationDetails {
  breakdown?: {
    domainAge: number;
    emailMatch: number;
  };
  whoisData?: {
    domain: string;
    creationDate: string;
    domainAgeYears: number;
    registrar: string;
    registrantCountry: string;
    isValid: boolean;
  };
  verifiedAt?: string;
}

export interface StudentRecord {
  _id: string;
  rollNumber: string;
  cgpa: number;
  branch: string;
  passoutYear: number;
  activeBacklogs: number;
  resumePath?: string;
  isProfileComplete: boolean;
  createdAt?: string;
  userId?: {
    _id: string;
    name: string;
    email: string;
    phone?: string;
    isActive: boolean;
    createdAt?: string;
  };
}

export interface StudentsResponse {
  success: boolean;
  data: StudentRecord[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  filterOptions: {
    branches: string[];
    passoutYears: number[];
  };
}

export interface PendingRecruiter {
  _id: string;
  companyName: string;
  officialEmail: string;
  website?: string;
  coverNote?: string;
  trustScore?: number;
  isApproved: boolean;
  createdAt?: string;
  verificationDetails?: VerificationDetails;
  userId?: {
    _id: string;
    name: string;
    email: string;
    phone: string;
    createdAt?: string;
  };
}

@Injectable({
  providedIn: 'root',
})
export class TpoService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:5000/api/tpo';

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token') || '';
    return new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    });
  }

  getAnalytics(): Observable<DashboardAnalytics> {
    return this.http.get<DashboardAnalytics>(`${this.apiUrl}/analytics`, {
      headers: this.getAuthHeaders(),
    });
  }

  getFunnel(): Observable<FunnelStage[]> {
    return this.http.get<FunnelStage[]>(`${this.apiUrl}/funnel`, {
      headers: this.getAuthHeaders(),
    });
  }

  getBranchStats(): Observable<BranchStat[]> {
    return this.http.get<BranchStat[]>(`${this.apiUrl}/branch-stats`, {
      headers: this.getAuthHeaders(),
    });
  }

  getOfferTrends(): Observable<OfferTrends> {
    return this.http.get<OfferTrends>(`${this.apiUrl}/offer-trends`, {
      headers: this.getAuthHeaders(),
    });
  }

  getPendingRecruiters(): Observable<PendingRecruiter[]> {
    return this.http.get<any>(`${this.apiUrl}/recruiters/pending`, {
      headers: this.getAuthHeaders(),
    }).pipe(
      map(res => (Array.isArray(res) ? res : res.data || []))
    );
  }

  getApprovedRecruiters(): Observable<PendingRecruiter[]> {
    return this.http.get<any>(`${this.apiUrl}/recruiters/approved`, {
      headers: this.getAuthHeaders(),
    }).pipe(
      map(res => (Array.isArray(res) ? res : res.data || []))
    );
  }

  getRecruiterVerification(id: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/recruiter/${id}/verify`, {
      headers: this.getAuthHeaders(),
    });
  }

  approveRecruiter(id: string): Observable<any> {
    return this.http.put(
      `${this.apiUrl}/recruiter/${id}/approve`,
      {},
      { headers: this.getAuthHeaders() }
    );
  }

  rejectRecruiter(id: string): Observable<any> {
    return this.http.put(
      `${this.apiUrl}/recruiter/${id}/reject`,
      {},
      { headers: this.getAuthHeaders() }
    );
  }

  toggleRecruiterStatus(id: string): Observable<any> {
    return this.http.put(
      `${this.apiUrl}/recruiter/${id}/toggle-status`,
      {},
      { headers: this.getAuthHeaders() }
    );
  }

  sendRecruiterSuggestion(id: string, suggestion: string): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/recruiter/${id}/suggestion`,
      { suggestion },
      { headers: this.getAuthHeaders() }
    );
  }

  importStudents(data: any[]): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/import-students`,
      { students: data },
      { headers: this.getAuthHeaders() }
    );
  }

  getStudents(params: {
    search?: string;
    branch?: string;
    passoutYear?: string;
    minCgpa?: string;
    maxCgpa?: string;
    activeBacklogs?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: string;
  }): Observable<StudentsResponse> {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') queryParams.set(k, String(v));
    });
    return this.http.get<StudentsResponse>(
      `${this.apiUrl}/students?${queryParams.toString()}`,
      { headers: this.getAuthHeaders() }
    );
  }
}
