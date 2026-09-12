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

export interface SeasonConfig {
  _id?: string;
  seasonStart: string;
  seasonEnd: string;
  updatedBy?: {
    _id: string;
    name: string;
    email: string;
  };
  updatedAt?: string;
  createdAt?: string;
}

export interface VerificationDetails {
  breakdown?: {
    domainAge: number;
    emailMatch: number;
    mca?: number;
  };
  whoisData?: {
    domain: string;
    creationDate: string;
    domainAgeYears: number;
    registrar: string;
    registrantCountry: string;
    isValid: boolean;
  };
  mcaData?: any;
  directors?: any[];
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
  status?: string;
  registrationStatus?: 'pending' | 'approved' | 'on_hold';
  holdFeedback?: {
    message: string;
    suggestions: string;
    providedAt?: string;
  };
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

export interface DriveOverview {
  _id: string;
  title: string;
  description: string;
  ctc: number;
  minCGPA: number;
  eligibleBranches: string[];
  maxBacklogs: number;
  applicationDeadline: string;
  hasAptitudeTest: boolean;
  hasGD: boolean;
  status: string;
  tpoFeedback?: string;
  createdAt: string;
  updatedAt: string;
  recruiter: {
    _id: string;
    companyName: string;
    companyLogo?: string | null;
    officialEmail?: string;
    website?: string;
  };
  applicationCount: number;
  placedCount: number;
}

export interface DriveXRayStudent {
  _id?: string;
  name: string;
  email: string;
  phone?: string;
  rollNumber: string;
  cgpa: number;
  branch: string;
  passoutYear?: number;
  resumePath?: string;
  profilePicPath?: string;
}

export interface DriveXRayApplication {
  applicationId: string;
  appliedDate: string;
  status: string;
  aiMatchScore: number | null;
  student: DriveXRayStudent;
  aptitude: {
    status: string;
    score: number | null;
    feedback: string | null;
    markedAt: string | null;
  };
  gd: {
    status: string;
    score: number | null;
    feedback: string | null;
    markedAt: string | null;
  };
  interview: {
    status: string;
    result: string;
    score: number | null;
    feedback: string | null;
    markedAt: string | null;
  };
  offer: {
    status: string;
    fileId?: string | null;
    filePath?: string | null;
    fileName?: string | null;
    uploadedDate?: string | null;
    acceptedAt?: string | null;
    declinedAt?: string | null;
    declineReason?: string | null;
  };
  xai: {
    matchScore: number | null;
    positiveSentences: string[];
    negativeSentences: string[];
    skillGaps: string[];
    strongSkills: string[];
    isOfflineFallback: boolean;
  };
}

export interface DriveXRaySummary {
  totalApplications: number;
  shortlisted: number;
  aptitudePassed: number;
  aptitudeFailed: number;
  gdShortlisted: number;
  gdRejected: number;
  interviewSelected: number;
  interviewRejected: number;
  placed: number;
}

export interface DriveXRayData {
  drive: {
    _id: string;
    title: string;
    description: string;
    ctc: number;
    minCGPA: number;
    eligibleBranches: string[];
    maxBacklogs: number;
    applicationDeadline: string;
    hasAptitudeTest: boolean;
    hasGD: boolean;
    status: string;
    companyName: string;
    companyLogo?: string | null;
    officialEmail?: string;
    website?: string;
    createdAt: string;
  };
  summary: DriveXRaySummary;
  applications: DriveXRayApplication[];
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

  getOnHoldRecruiters(): Observable<PendingRecruiter[]> {
    return this.http.get<any>(`${this.apiUrl}/recruiters/on-hold`, {
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

  putRecruiterOnHold(id: string, data: { feedback: string; suggestions?: string }): Observable<any> {
    return this.http.put(
      `${this.apiUrl}/recruiter/${id}/hold`,
      data,
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

  reVerifyRecruiter(id: string): Observable<any> {
    return this.http.put(
      `${this.apiUrl}/recruiter/${id}/re-verify`,
      {},
      { headers: this.getAuthHeaders() }
    );
  }

  reverifyRecruiter(id: string): Observable<any> {
    return this.http.put(
      `${this.apiUrl}/recruiter/${id}/reverify`,
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

  getPendingDrives(): Observable<any> {
    return this.http.get(`${this.apiUrl}/drives/pending`, { headers: this.getAuthHeaders() });
  }

  approveDrive(driveId: string): Observable<any> {
    return this.http.put(`${this.apiUrl}/drive/${driveId}/approve`, {}, { headers: this.getAuthHeaders() });
  }

  rejectDrive(driveId: string, reason: string): Observable<any> {
    return this.http.put(`${this.apiUrl}/drive/${driveId}/reject`, { reason }, { headers: this.getAuthHeaders() });
  }

  holdDrive(driveId: string, reason: string): Observable<any> {
    return this.http.put(`${this.apiUrl}/drive/${driveId}/hold`, { reason }, { headers: this.getAuthHeaders() });
  }

  getSeasonConfig(): Observable<{ success: boolean; data: SeasonConfig }> {
    return this.http.get<{ success: boolean; data: SeasonConfig }>(
      `${this.apiUrl}/season-config`,
      { headers: this.getAuthHeaders() }
    );
  }

  updateSeasonConfig(config: { seasonStart: string; seasonEnd: string }): Observable<{ success: boolean; message: string; data: SeasonConfig }> {
    return this.http.put<{ success: boolean; message: string; data: SeasonConfig }>(
      `${this.apiUrl}/season-config`,
      config,
      { headers: this.getAuthHeaders() }
    );
  }

  getStudentAuditDetails(rollNumber: string): Observable<{ success: boolean; student: any; overallStatus: string; applications: any[] }> {
    return this.http.get<{ success: boolean; student: any; overallStatus: string; applications: any[] }>(
      `${this.apiUrl}/student/${rollNumber}/audit`,
      { headers: this.getAuthHeaders() }
    );
  }

  getCollegeConfig(): Observable<{ success: boolean; data: { branches: string[]; passoutYears: number[]; seasonStart?: string; seasonEnd?: string } }> {
    return this.http.get<{ success: boolean; data: { branches: string[]; passoutYears: number[]; seasonStart?: string; seasonEnd?: string } }>(
      `${this.apiUrl}/college-config`,
      { headers: this.getAuthHeaders() }
    );
  }

  updateCollegeConfig(data: { branches?: string[]; passoutYears?: number[] }): Observable<any> {
    return this.http.put<any>(
      `${this.apiUrl}/college-config`,
      data,
      { headers: this.getAuthHeaders() }
    );
  }

  addBranch(branch: string): Observable<any> {
    return this.http.post<any>(
      `${this.apiUrl}/college-config/branch`,
      { branch },
      { headers: this.getAuthHeaders() }
    );
  }

  deleteBranch(branch: string): Observable<any> {
    return this.http.delete<any>(
      `${this.apiUrl}/college-config/branch/${encodeURIComponent(branch)}`,
      { headers: this.getAuthHeaders() }
    );
  }

  addPassoutYear(year: number): Observable<any> {
    return this.http.post<any>(
      `${this.apiUrl}/college-config/passout-year`,
      { year },
      { headers: this.getAuthHeaders() }
    );
  }

  deletePassoutYear(year: number): Observable<any> {
    return this.http.delete<any>(
      `${this.apiUrl}/college-config/passout-year/${year}`,
      { headers: this.getAuthHeaders() }
    );
  }

  getAllDrives(): Observable<{ success: boolean; drives: DriveOverview[] }> {
    return this.http.get<{ success: boolean; drives: DriveOverview[] }>(
      `${this.apiUrl}/drives`,
      { headers: this.getAuthHeaders() }
    );
  }

  getDriveApplicationsForTPO(driveId: string): Observable<{ success: boolean; data: DriveXRayData }> {
    return this.http.get<{ success: boolean; data: DriveXRayData }>(
      `${this.apiUrl}/drive/${driveId}/applications`,
      { headers: this.getAuthHeaders() }
    );
  }

  getAllSchedules(startDate?: string, endDate?: string, eventType?: string, company?: string): Observable<CalendarSchedulesResponse> {
    const queryParams = new URLSearchParams();
    if (startDate) queryParams.set('startDate', startDate);
    if (endDate) queryParams.set('endDate', endDate);
    if (eventType && eventType !== 'All' && eventType !== 'ALL') queryParams.set('eventType', eventType);
    if (company && company !== 'All' && company !== 'ALL') queryParams.set('company', company);

    return this.http.get<CalendarSchedulesResponse>(
      `${this.apiUrl}/schedules?${queryParams.toString()}`,
      { headers: this.getAuthHeaders() }
    );
  }

  getCalendarSummary(): Observable<CalendarSummaryResponse> {
    return this.http.get<CalendarSummaryResponse>(
      `${this.apiUrl}/schedules/summary`,
      { headers: this.getAuthHeaders() }
    );
  }

  getStudentReadiness(rollNumber: string): Observable<any> {
    return this.http.get<any>(
      `${this.apiUrl}/analyzer/student/${encodeURIComponent(rollNumber.trim())}`,
      { headers: this.getAuthHeaders() }
    );
  }

  getDepartmentReadiness(branch: string): Observable<any> {
    return this.http.get<any>(
      `${this.apiUrl}/analyzer/department/${encodeURIComponent(branch)}`,
      { headers: this.getAuthHeaders() }
    );
  }

  getAllStudentsReadiness(branch?: string, sort?: string): Observable<any> {
    const queryParams = new URLSearchParams();
    if (branch && branch !== 'All') queryParams.set('branch', branch);
    if (sort) queryParams.set('sort', sort);

    const queryStr = queryParams.toString() ? `?${queryParams.toString()}` : '';
    return this.http.get<any>(
      `${this.apiUrl}/analyzer/overview${queryStr}`,
      { headers: this.getAuthHeaders() }
    );
  }
}

export interface CalendarStudent {
  _id?: string;
  name: string;
  rollNumber: string;
  branch: string;
  email: string;
  cgpa?: number;
}

export interface CalendarSlot {
  timeSlot: string;
  companyName: string;
  driveTitle: string;
  eventType: 'Aptitude' | 'GD' | 'Interview' | string;
  location: string;
  meetingUrl?: string | null;
  driveId?: string | null;
  studentCount: number;
  students: CalendarStudent[];
}

export interface GroupedScheduleDay {
  date: string;
  dayOfWeek: string;
  slots: CalendarSlot[];
}

export interface CalendarSchedulesResponse {
  success: boolean;
  data: {
    dateRange: {
      startDate: string;
      endDate: string;
    };
    totalSchedules: number;
    totalStudentsScheduled: number;
    groupedSchedules: GroupedScheduleDay[];
  };
}

export interface CalendarSummaryResponse {
  success: boolean;
  summary: {
    totalThisWeek: number;
    totalThisMonth: number;
    totalStudentsScheduled: number;
    mostScheduledCompany: string;
    busiestDay: string;
    clashesDetected: {
      date: string;
      dayOfWeek: string;
      companyCount: number;
      companies: string[];
      totalStudents: number;
      warning: string;
    }[];
  };
}
