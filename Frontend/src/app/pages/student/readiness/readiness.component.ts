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
import { StudentService } from '../../../services/student.service';
import * as echarts from 'echarts';

interface Suggestion {
  severity: 'critical' | 'moderate' | 'positive';
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
}

interface ReadinessData {
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
  personalizedSuggestions: Suggestion[];
  applicationsCount: number;
  lastComputedAt: string;
}

@Component({
  selector: 'app-student-readiness',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './readiness.component.html',
  styleUrl: './readiness.component.css',
})
export class StudentReadinessComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly studentService = inject(StudentService);

  @ViewChild('gaugeChartRef') gaugeChartRef?: ElementRef<HTMLDivElement>;
  @ViewChild('funnelChartRef') funnelChartRef?: ElementRef<HTMLDivElement>;
  @ViewChild('radarChartRef') radarChartRef?: ElementRef<HTMLDivElement>;

  protected isLoading = signal<boolean>(true);
  protected isRefreshing = signal<boolean>(false);
  protected errorMsg = signal<string | null>(null);
  protected data = signal<ReadinessData | null>(null);

  private gaugeChart?: echarts.ECharts;
  private funnelChart?: echarts.ECharts;
  private radarChart?: echarts.ECharts;
  private resizeObserver?: ResizeObserver;

  ngOnInit(): void {
    this.fetchReadinessData();
  }

  ngAfterViewInit(): void {
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => {
        this.gaugeChart?.resize();
        this.funnelChart?.resize();
        this.radarChart?.resize();
      });
      if (this.gaugeChartRef?.nativeElement) {
        this.resizeObserver.observe(this.gaugeChartRef.nativeElement);
      }
    }
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.gaugeChart?.dispose();
    this.funnelChart?.dispose();
    this.radarChart?.dispose();
  }

  protected fetchReadinessData(): void {
    this.isLoading.set(true);
    this.isRefreshing.set(true);
    this.errorMsg.set(null);

    this.studentService.getMyReadiness().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.data.set(res.data);
          // Wait for DOM to render containers
          setTimeout(() => {
            this.initCharts(res.data);
          }, 50);
        } else {
          this.errorMsg.set('Failed to retrieve readiness evaluation.');
        }
        this.isLoading.set(false);
        this.isRefreshing.set(false);
      },
      error: (err) => {
        this.errorMsg.set(err.error?.message || 'Could not load your placement readiness score.');
        this.isLoading.set(false);
        this.isRefreshing.set(false);
      },
    });
  }

  private initCharts(d: ReadinessData): void {
    this.initGauge(d.praScore, d.praCategory);
    this.initFunnel(d.stageFunnel, d.weakestStage);
    this.initRadar(d.skillRadar, d.departmentRadar);
  }

  private initGauge(score: number, category: string): void {
    if (!this.gaugeChartRef?.nativeElement) return;
    if (this.gaugeChart) {
      this.gaugeChart.dispose();
    }
    this.gaugeChart = echarts.init(this.gaugeChartRef.nativeElement);

    const option: echarts.EChartsOption = {
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
          itemStyle: {
            color: '#003b5a',
            shadowColor: 'rgba(0, 59, 90, 0.3)',
            shadowBlur: 10,
          },
          progress: {
            show: true,
            roundCap: true,
            width: 18,
          },
          pointer: {
            icon: 'path://M12.8,0.7l12,40.1H0.7L12.8,0.7z',
            length: '12%',
            width: 14,
            offsetCenter: [0, '-60%'],
            itemStyle: {
              color: '#003b5a',
            },
          },
          axisLine: {
            roundCap: true,
            lineStyle: {
              width: 18,
              color: [
                [0.45, '#d32f2f'],  // Red
                [0.74, '#d97706'],  // Amber
                [1.0, '#2e7d32'],   // Green
              ],
            },
          },
          axisTick: {
            distance: -30,
            length: 8,
            lineStyle: {
              color: '#fff',
              width: 2,
            },
          },
          splitLine: {
            distance: -35,
            length: 14,
            lineStyle: {
              color: '#fff',
              width: 3,
            },
          },
          axisLabel: {
            distance: -20,
            color: '#41474e',
            fontSize: 12,
            fontWeight: 700,
          },
          title: {
            show: false,
          },
          detail: {
            valueAnimation: true,
            width: '60%',
            lineHeight: 36,
            borderRadius: 8,
            offsetCenter: [0, '-15%'],
            fontSize: 34,
            fontWeight: 900,
            formatter: '{value}',
            color: '#003b5a',
          },
          data: [
            {
              value: score,
              name: category,
            },
          ],
        },
      ],
    };

    this.gaugeChart.setOption(option);
  }

  private initFunnel(
    funnel: {
      applied: number;
      aptitudeCleared: number;
      gdCleared: number;
      interviewCleared: number;
      placed: number;
    },
    weakest: string
  ): void {
    if (!this.funnelChartRef?.nativeElement) return;
    if (this.funnelChart) {
      this.funnelChart.dispose();
    }
    this.funnelChart = echarts.init(this.funnelChartRef.nativeElement);

    const stages = [
      { name: 'Applied', value: funnel.applied, color: '#003b5a' },
      { name: 'Aptitude Cleared', value: funnel.aptitudeCleared, color: '#006497' },
      { name: 'GD Cleared', value: funnel.gdCleared, color: '#0080c0' },
      { name: 'Interview Cleared', value: funnel.interviewCleared, color: '#0284c7' },
      { name: 'Placed / Selected', value: funnel.placed, color: '#2e7d32' },
    ];

    const option: echarts.EChartsOption = {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: any) => {
          const item = params[0];
          return `<strong>${item.name}</strong>: ${item.value} drives`;
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
        boundaryGap: [0, 0.01],
        splitLine: {
          lineStyle: {
            color: 'rgba(0, 59, 90, 0.06)',
          },
        },
        axisLabel: {
          color: '#41474e',
          fontSize: 11,
          fontWeight: 600,
        },
      },
      yAxis: {
        type: 'category',
        data: stages.map((s) => s.name).reverse(),
        axisLine: { lineStyle: { color: 'rgba(0, 59, 90, 0.15)' } },
        axisLabel: {
          color: '#091d2e',
          fontSize: 12,
          fontWeight: 700,
        },
      },
      series: [
        {
          type: 'bar',
          data: stages.map((s) => ({
            value: s.value,
            itemStyle: {
              color: s.name.toLowerCase().includes(weakest.toLowerCase())
                ? '#d97706'
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
          barWidth: 20,
        },
      ],
    };

    this.funnelChart.setOption(option);
  }

  private initRadar(
    studentRadar: {
      DSA: number;
      Cloud: number;
      WebDev: number;
      Aptitude: number;
      Communication: number;
      Interview: number;
    },
    deptRadar?: {
      DSA: number;
      Cloud: number;
      WebDev: number;
      Aptitude: number;
      Communication: number;
      Interview: number;
    }
  ): void {
    if (!this.radarChartRef?.nativeElement) return;
    if (this.radarChart) {
      this.radarChart.dispose();
    }
    this.radarChart = echarts.init(this.radarChartRef.nativeElement);

    const dept = deptRadar || {
      DSA: 6.2,
      Cloud: 4.8,
      WebDev: 6.5,
      Aptitude: 6.5,
      Communication: 6.0,
      Interview: 6.0,
    };

    const studentVals = [
      studentRadar.DSA,
      studentRadar.Cloud,
      studentRadar.WebDev,
      studentRadar.Aptitude,
      studentRadar.Communication,
      studentRadar.Interview,
    ];

    const deptVals = [
      dept.DSA,
      dept.Cloud,
      dept.WebDev,
      dept.Aptitude,
      dept.Communication,
      dept.Interview,
    ];

    const option: echarts.EChartsOption = {
      legend: {
        bottom: 0,
        data: ['You (Personal Skills)', 'Department Average'],
        textStyle: {
          color: '#41474e',
          fontWeight: 700,
          fontSize: 12,
        },
      },
      tooltip: {
        trigger: 'item',
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
        axisName: {
          color: '#003b5a',
          fontWeight: 800,
          fontSize: 11.5,
        },
        splitArea: {
          areaStyle: {
            color: ['#f7f9ff', '#edf4ff', '#e2ecf9', '#d7e5f5'],
          },
        },
        splitLine: {
          lineStyle: {
            color: 'rgba(0, 59, 90, 0.1)',
          },
        },
        axisLine: {
          lineStyle: {
            color: 'rgba(0, 59, 90, 0.15)',
          },
        },
      },
      series: [
        {
          type: 'radar',
          data: [
            {
              value: studentVals,
              name: 'You (Personal Skills)',
              itemStyle: { color: '#003b5a' },
              lineStyle: { width: 2.5, color: '#003b5a' },
              areaStyle: { color: 'rgba(0, 100, 151, 0.3)' },
            },
            {
              value: deptVals,
              name: 'Department Average',
              itemStyle: { color: '#94a3b8' },
              lineStyle: { width: 2, type: 'dashed', color: '#64748b' },
              areaStyle: { color: 'transparent' },
            },
          ],
        },
      ],
    };

    this.radarChart.setOption(option);
  }

  protected getSeverityIcon(severity: string): string {
    switch (severity) {
      case 'critical':
        return 'error';
      case 'moderate':
        return 'warning';
      case 'positive':
        return 'verified';
      default:
        return 'lightbulb';
    }
  }

  protected getCategoryPillClass(category: string): string {
    const cat = category.toLowerCase();
    if (cat.includes('well') || cat.includes('high')) return 'pill-green';
    if (cat.includes('significant')) return 'pill-red';
    return 'pill-amber';
  }
}
