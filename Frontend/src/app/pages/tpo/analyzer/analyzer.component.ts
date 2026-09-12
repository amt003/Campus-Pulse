import {
  Component,
  OnInit,
  AfterViewInit,
  OnDestroy,
  inject,
  signal,
  ElementRef,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TpoService } from '../../../services/tpo.service';
import * as echarts from 'echarts';

interface DepartmentMetrics {
  branch: string;
  totalStudents: number;
  placedCount: number;
  placementPercentage: number;
  avgPraScore: number;
  avgCgpa: number;
  stageDropOff: {
    applied: number;
    aptitudeCleared: number;
    gdCleared: number;
    interviewCleared: number;
    placed: number;
  };
  topMissingSkills: { name: string; count: number; percentage: number }[];
  departmentRecommendations: { priority: string; title: string; desc: string; icon?: string }[];
  radarAverage: {
    DSA: number;
    Cloud: number;
    WebDev: number;
    Aptitude: number;
    Communication: number;
    Interview: number;
  };
  highestDropStage: string;
  lastUpdated: string;
}

interface RankedStudent {
  rank: number;
  studentId: string;
  rollNumber: string;
  name: string;
  email: string;
  branch: string;
  passoutYear: number;
  cgpa: number;
  praScore: number;
  praCategory: string;
  weakestStage: string;
  applicationsCount: number;
  hasResume: boolean;
  activeBacklogs: number;
}

interface IndividualReadiness {
  student: {
    _id: string;
    name: string;
    email: string;
    rollNumber: string;
    branch: string;
    passoutYear: number;
    cgpa: number;
    activeBacklogs: number;
    isProfileComplete: boolean;
    hasResume: boolean;
  };
  praScore: number;
  praCategory: string;
  subScores: {
    cgpa: number;
    aiMatch: number;
    aptitude: number;
    gd: number;
    interview: number;
    resume: number;
  };
  subScoreMeta?: {
    aptAttempted: number;
    aptPassed: number;
    gdAttempted: number;
    gdShortlisted: number;
    interviewAttempted: number;
    interviewSelected: number;
    matchCount: number;
    appliedCount: number;
  };
  stageFunnel: {
    applied: number;
    aptitudeCleared: number;
    gdCleared: number;
    interviewCleared: number;
    placed: number;
  };
  weakestStage: string;
  skillRadar: {
    DSA: number;
    Cloud: number;
    WebDev: number;
    Aptitude: number;
    Communication: number;
    Interview: number;
  };
  departmentRadar?: {
    DSA: number;
    Cloud: number;
    WebDev: number;
    Aptitude: number;
    Communication: number;
    Interview: number;
  };
  recurringSkillGaps: string[];
  personalizedSuggestions: { 
    severity: string; 
    category?: string; 
    message: string; 
    actions?: string[];
    resources?: {
      title: string;
      platform: string;
      url: string;
      type: string;
      badge?: string;
    }[];
  }[];
  applicationsCount: number;
  lastComputedAt: string;
}

@Component({
  selector: 'app-tpo-analyzer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './analyzer.component.html',
  styleUrl: './analyzer.component.css',
})
export class TpoAnalyzerComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly tpoService = inject(TpoService);

  // Tab State: 'dept' | 'student'
  protected activeTab = signal<'dept' | 'student'>('dept');

  // Department Tab State
  protected selectedBranch = signal<string>('All');
  protected availableBranches = signal<string[]>(['All', 'CSE', 'IT', 'ECE', 'ME', 'Civil', 'MCA']);
  protected deptMetrics = signal<DepartmentMetrics | null>(null);
  protected rankedStudents = signal<RankedStudent[]>([]);
  protected sortBy = signal<'pra' | 'cgpa' | 'roll'>('pra');
  protected isDeptLoading = signal<boolean>(true);
  protected deptErrorMsg = signal<string | null>(null);

  // Student Tab State
  protected searchRollNumber = signal<string>('');
  protected searchedStudentPra = signal<IndividualReadiness | null>(null);
  protected isStudentLoading = signal<boolean>(false);
  protected studentErrorMsg = signal<string | null>(null);

  // ECharts Element References (Dept Tab)
  @ViewChild('deptDropOffRef') deptDropOffRef?: ElementRef<HTMLDivElement>;
  @ViewChild('deptSkillsRef') deptSkillsRef?: ElementRef<HTMLDivElement>;

  // ECharts Element References (Student Tab)
  @ViewChild('studentGaugeRef') studentGaugeRef?: ElementRef<HTMLDivElement>;
  @ViewChild('studentFunnelRef') studentFunnelRef?: ElementRef<HTMLDivElement>;
  @ViewChild('studentRadarRef') studentRadarRef?: ElementRef<HTMLDivElement>;

  private deptDropOffChart?: echarts.ECharts;
  private deptSkillsChart?: echarts.ECharts;
  private studentGaugeChart?: echarts.ECharts;
  private studentFunnelChart?: echarts.ECharts;
  private studentRadarChart?: echarts.ECharts;
  private resizeObserver?: ResizeObserver;

  ngOnInit(): void {
    this.fetchDepartmentData();
  }

  ngAfterViewInit(): void {
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => {
        this.deptDropOffChart?.resize();
        this.deptSkillsChart?.resize();
        this.studentGaugeChart?.resize();
        this.studentFunnelChart?.resize();
        this.studentRadarChart?.resize();
      });
      if (this.deptDropOffRef?.nativeElement) {
        this.resizeObserver.observe(this.deptDropOffRef.nativeElement);
      }
    }
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.disposeAllCharts();
  }

  private disposeAllCharts(): void {
    this.deptDropOffChart?.dispose();
    this.deptSkillsChart?.dispose();
    this.studentGaugeChart?.dispose();
    this.studentFunnelChart?.dispose();
    this.studentRadarChart?.dispose();
  }

  protected selectTab(tab: 'dept' | 'student'): void {
    this.activeTab.set(tab);
    setTimeout(() => {
      if (tab === 'dept' && this.deptMetrics()) {
        this.initDeptCharts(this.deptMetrics()!);
      } else if (tab === 'student' && this.searchedStudentPra()) {
        this.initStudentCharts(this.searchedStudentPra()!);
      }
    }, 60);
  }

  // ── Department Analysis Logic ─────────────────────────────────────────────

  protected onBranchChange(branch: string): void {
    this.selectedBranch.set(branch);
    this.fetchDepartmentData();
  }

  protected onSortChange(sort: 'pra' | 'cgpa' | 'roll'): void {
    this.sortBy.set(sort);
    this.fetchRankedStudents();
  }

  protected fetchDepartmentData(): void {
    this.isDeptLoading.set(true);
    this.deptErrorMsg.set(null);

    const branch = this.selectedBranch();

    this.tpoService.getDepartmentReadiness(branch).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.deptMetrics.set(res.data);
          setTimeout(() => {
            this.initDeptCharts(res.data);
          }, 50);
        } else {
          this.deptErrorMsg.set('Failed to retrieve department analytics.');
        }
        this.isDeptLoading.set(false);
      },
      error: (err) => {
        this.deptErrorMsg.set(err.error?.message || 'Could not load department readiness.');
        this.isDeptLoading.set(false);
      },
    });

    this.fetchRankedStudents();
  }

  private fetchRankedStudents(): void {
    const branch = this.selectedBranch();
    const sort = this.sortBy();

    this.tpoService.getAllStudentsReadiness(branch, sort).subscribe({
      next: (res) => {
        if (res.success && Array.isArray(res.data)) {
          this.rankedStudents.set(res.data);
        }
      },
      error: () => {
        // Silently keep current
      },
    });
  }

  private initDeptCharts(metrics: DepartmentMetrics): void {
    this.initDeptDropOff(metrics.stageDropOff, metrics.highestDropStage);
    this.initDeptSkills(metrics.topMissingSkills);
  }

  private initDeptDropOff(
    stages: {
      applied: number;
      aptitudeCleared: number;
      gdCleared: number;
      interviewCleared: number;
      placed: number;
    },
    highestDrop: string
  ): void {
    if (!this.deptDropOffRef?.nativeElement) return;
    if (this.deptDropOffChart) {
      this.deptDropOffChart.dispose();
    }
    this.deptDropOffChart = echarts.init(this.deptDropOffRef.nativeElement);

    const stageData = [
      { name: 'Applied', value: stages.applied, color: '#003b5a' },
      { name: 'Aptitude Cleared', value: stages.aptitudeCleared, color: '#006497' },
      { name: 'GD Cleared', value: stages.gdCleared, color: '#0080c0' },
      { name: 'Interview Cleared', value: stages.interviewCleared, color: '#0284c7' },
      { name: 'Placed / Offers', value: stages.placed, color: '#2e7d32' },
    ];

    const option: echarts.EChartsOption = {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: any) => {
          const item = params[0];
          return `<strong>${item.name}</strong>: ${item.value} candidate attempts`;
        },
      },
      grid: {
        top: 20,
        bottom: 20,
        left: 130,
        right: 40,
      },
      xAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: 'rgba(0, 59, 90, 0.06)' } },
        axisLabel: { color: '#41474e', fontSize: 11, fontWeight: 600 },
      },
      yAxis: {
        type: 'category',
        data: stageData.map((s) => s.name).reverse(),
        axisLine: { lineStyle: { color: 'rgba(0, 59, 90, 0.15)' } },
        axisLabel: { color: '#091d2e', fontSize: 12, fontWeight: 700 },
      },
      series: [
        {
          type: 'bar',
          data: stageData.map((s) => ({
            value: s.value,
            itemStyle: {
              color: s.name.toLowerCase().includes(highestDrop.toLowerCase())
                ? '#d32f2f'
                : s.color,
              borderRadius: [0, 6, 6, 0],
            },
          })).reverse(),
          label: {
            show: true,
            position: 'right',
            color: '#003b5a',
            fontWeight: 800,
            fontSize: 12,
          },
          barWidth: 22,
        },
      ],
    };

    this.deptDropOffChart.setOption(option);
  }

  private initDeptSkills(skills: { name: string; count: number; percentage: number }[]): void {
    if (!this.deptSkillsRef?.nativeElement) return;
    if (this.deptSkillsChart) {
      this.deptSkillsChart.dispose();
    }
    this.deptSkillsChart = echarts.init(this.deptSkillsRef.nativeElement);

    const top6 = skills.slice(0, 6).reverse();

    const option: echarts.EChartsOption = {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: any) => {
          const item = params[0];
          return `<strong>${item.name}</strong>: missing in ${item.value} candidate evaluations`;
        },
      },
      grid: {
        top: 15,
        bottom: 20,
        left: 150,
        right: 50,
      },
      xAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: 'rgba(0, 59, 90, 0.06)' } },
        axisLabel: { color: '#41474e', fontSize: 11, fontWeight: 600 },
      },
      yAxis: {
        type: 'category',
        data: top6.map((s) => s.name),
        axisLine: { lineStyle: { color: 'rgba(0, 59, 90, 0.15)' } },
        axisLabel: {
          color: '#091d2e',
          fontSize: 11.5,
          fontWeight: 700,
          formatter: (val: string) => (val.length > 20 ? val.substring(0, 18) + '…' : val),
        },
      },
      series: [
        {
          type: 'bar',
          data: top6.map((s) => ({
            value: s.count,
            itemStyle: {
              color: '#d97706',
              borderRadius: [0, 6, 6, 0],
            },
          })),
          label: {
            show: true,
            position: 'right',
            color: '#d97706',
            fontWeight: 800,
            fontSize: 11.5,
            formatter: '{c}',
          },
          barWidth: 18,
        },
      ],
    };

    this.deptSkillsChart.setOption(option);
  }

  // ── Student Analysis Logic ────────────────────────────────────────────────

  protected inspectStudent(rollNumber: string): void {
    this.searchRollNumber.set(rollNumber);
    this.selectTab('student');
    this.searchStudentReadiness();
  }

  protected searchStudentReadiness(): void {
    const roll = this.searchRollNumber().trim();
    if (!roll) return;

    this.isStudentLoading.set(true);
    this.studentErrorMsg.set(null);
    this.searchedStudentPra.set(null);

    this.tpoService.getStudentReadiness(roll).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.searchedStudentPra.set(res.data);
          setTimeout(() => {
            this.initStudentCharts(res.data);
          }, 50);
        } else {
          this.studentErrorMsg.set(`No readiness record found for roll number: ${roll}`);
        }
        this.isStudentLoading.set(false);
      },
      error: (err) => {
        this.studentErrorMsg.set(err.error?.message || `Failed to find student with roll number: ${roll}`);
        this.isStudentLoading.set(false);
      },
    });
  }

  private initStudentCharts(pra: IndividualReadiness): void {
    // 1. Gauge
    if (this.studentGaugeRef?.nativeElement) {
      if (this.studentGaugeChart) this.studentGaugeChart.dispose();
      this.studentGaugeChart = echarts.init(this.studentGaugeRef.nativeElement);

      this.studentGaugeChart.setOption({
        series: [
          {
            type: 'gauge',
            startAngle: 180,
            endAngle: 0,
            min: 0,
            max: 100,
            splitNumber: 5,
            radius: '95%',
            center: ['50%', '70%'],
            itemStyle: { color: '#003b5a' },
            progress: { show: true, roundCap: true, width: 18 },
            pointer: {
              icon: 'path://M12.8,0.7l12,40.1H0.7L12.8,0.7z',
              length: '12%',
              width: 14,
              offsetCenter: [0, '-60%'],
              itemStyle: { color: '#003b5a' },
            },
            axisLine: {
              roundCap: true,
              lineStyle: {
                width: 18,
                color: [
                  [0.45, '#d32f2f'],
                  [0.74, '#d97706'],
                  [1.0, '#2e7d32'],
                ],
              },
            },
            axisTick: { distance: -30, length: 8, lineStyle: { color: '#fff', width: 2 } },
            splitLine: { distance: -35, length: 14, lineStyle: { color: '#fff', width: 3 } },
            axisLabel: { distance: -20, color: '#41474e', fontSize: 12, fontWeight: 700 },
            detail: {
              valueAnimation: true,
              offsetCenter: [0, '-15%'],
              fontSize: 34,
              fontWeight: 900,
              formatter: '{value}',
              color: '#003b5a',
            },
            data: [{ value: pra.praScore, name: pra.praCategory }],
          },
        ],
      });
    }

    // 2. Funnel
    if (this.studentFunnelRef?.nativeElement) {
      if (this.studentFunnelChart) this.studentFunnelChart.dispose();
      this.studentFunnelChart = echarts.init(this.studentFunnelRef.nativeElement);

      const stages = [
        { name: 'Applied', value: pra.stageFunnel.applied, color: '#003b5a' },
        { name: 'Aptitude Cleared', value: pra.stageFunnel.aptitudeCleared, color: '#006497' },
        { name: 'GD Cleared', value: pra.stageFunnel.gdCleared, color: '#0080c0' },
        { name: 'Interview Cleared', value: pra.stageFunnel.interviewCleared, color: '#0284c7' },
        { name: 'Placed / Selected', value: pra.stageFunnel.placed, color: '#2e7d32' },
      ];

      this.studentFunnelChart.setOption({
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
        grid: { top: 20, bottom: 20, left: 130, right: 40 },
        xAxis: {
          type: 'value',
          splitLine: { lineStyle: { color: 'rgba(0, 59, 90, 0.06)' } },
          axisLabel: { color: '#41474e', fontSize: 11, fontWeight: 600 },
        },
        yAxis: {
          type: 'category',
          data: stages.map((s) => s.name).reverse(),
          axisLine: { lineStyle: { color: 'rgba(0, 59, 90, 0.15)' } },
          axisLabel: { color: '#091d2e', fontSize: 12, fontWeight: 700 },
        },
        series: [
          {
            type: 'bar',
            data: stages.map((s) => ({
              value: s.value,
              itemStyle: {
                color: s.name.toLowerCase().includes(pra.weakestStage.toLowerCase()) ? '#d97706' : s.color,
                borderRadius: [0, 6, 6, 0],
              },
            })).reverse(),
            label: { show: true, position: 'right', color: '#003b5a', fontWeight: 800, fontSize: 12 },
            barWidth: 20,
          },
        ],
      });
    }

    // 3. Radar
    if (this.studentRadarRef?.nativeElement) {
      if (this.studentRadarChart) this.studentRadarChart.dispose();
      this.studentRadarChart = echarts.init(this.studentRadarRef.nativeElement);

      const dept = pra.departmentRadar || {
        DSA: 6.2, Cloud: 4.8, WebDev: 6.5, Aptitude: 6.5, Communication: 6.0, Interview: 6.0,
      };

      this.studentRadarChart.setOption({
        legend: {
          bottom: 0,
          data: ['Student Capability', 'Department Average'],
          textStyle: { color: '#41474e', fontWeight: 700, fontSize: 12 },
        },
        radar: {
          indicator: [
            { name: 'DSA & Algorithms', max: 10 },
            { name: 'Cloud & DevOps', max: 10 },
            { name: 'Web Dev & Stack', max: 10 },
            { name: 'Aptitude & Logic', max: 10 },
            { name: 'Communication & GD', max: 10 },
            { name: 'Technical Interview', max: 10 },
          ],
          center: ['50%', '46%'],
          radius: '65%',
          axisName: { color: '#003b5a', fontWeight: 800, fontSize: 11.5 },
          splitArea: { areaStyle: { color: ['#f7f9ff', '#edf4ff', '#e2ecf9', '#d7e5f5'] } },
          splitLine: { lineStyle: { color: 'rgba(0, 59, 90, 0.1)' } },
          axisLine: { lineStyle: { color: 'rgba(0, 59, 90, 0.15)' } },
        },
        series: [
          {
            type: 'radar',
            data: [
              {
                value: [
                  pra.skillRadar.DSA,
                  pra.skillRadar.Cloud,
                  pra.skillRadar.WebDev,
                  pra.skillRadar.Aptitude,
                  pra.skillRadar.Communication,
                  pra.skillRadar.Interview,
                ],
                name: 'Student Capability',
                itemStyle: { color: '#003b5a' },
                lineStyle: { width: 2.5, color: '#003b5a' },
                areaStyle: { color: 'rgba(0, 100, 151, 0.3)' },
              },
              {
                value: [
                  dept.DSA, dept.Cloud, dept.WebDev, dept.Aptitude, dept.Communication, dept.Interview,
                ],
                name: 'Department Average',
                itemStyle: { color: '#94a3b8' },
                lineStyle: { width: 2, type: 'dashed', color: '#64748b' },
                areaStyle: { color: 'transparent' },
              },
            ],
          },
        ],
      });
    }
  }

  protected getCategoryPillClass(category: string): string {
    const cat = category.toLowerCase();
    if (cat.includes('well') || cat.includes('high')) return 'pill-green';
    if (cat.includes('significant')) return 'pill-red';
    return 'pill-amber';
  }

  protected getSeverityIcon(severity: string): string {
    switch (severity) {
      case 'critical': return 'error';
      case 'moderate': return 'warning';
      case 'positive': return 'verified';
      default: return 'lightbulb';
    }
  }
}
