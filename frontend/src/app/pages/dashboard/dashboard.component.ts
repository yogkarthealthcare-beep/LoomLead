import { Component, OnInit, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CrmService, TaskItem } from '../../services/crm.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './dashboard.component.html'
})
export class DashboardComponent implements OnInit, AfterViewInit {
  tasksToday: TaskItem[] = [];
  selectedPeriod: string = 'Last 30 Days';

  constructor(private crmService: CrmService) {}

  ngOnInit(): void {
    this.crmService.getTasks().subscribe(tasks => {
      this.tasksToday = tasks;
    });
  }

  ngAfterViewInit(): void {
    this.initCharts();
  }

  initCharts(): void {
    const Chart = (window as any).Chart;
    if (!Chart) return;

    // 1. Leads by Source (Doughnut)
    const sourceCtx = document.getElementById('sourceChart') as HTMLCanvasElement;
    if (sourceCtx) {
      new Chart(sourceCtx, {
        type: 'doughnut',
        data: {
          labels: ['Google Maps Leads', 'Direct Website', 'Referrals', 'Social Media', 'Inbound Calls'],
          datasets: [{
            data: [42, 28, 15, 10, 5],
            backgroundColor: ['#4f46e5', '#3b82f6', '#10b981', '#f59e0b', '#ec4899'],
            borderWidth: 2,
            borderColor: '#ffffff'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } }
          }
        }
      });
    }

    // 2. Monthly Revenue Trend (Spline Line Chart)
    const trendCtx = document.getElementById('trendChart') as HTMLCanvasElement;
    if (trendCtx) {
      new Chart(trendCtx, {
        type: 'line',
        data: {
          labels: ['Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov'],
          datasets: [{
            label: 'Won Revenue (₹ Lakhs)',
            data: [35, 48, 52, 64, 78, 92],
            borderColor: '#2563eb',
            backgroundColor: 'rgba(37, 99, 235, 0.1)',
            fill: true,
            tension: 0.4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { grid: { color: '#f1f5f9' }, ticks: { callback: (v: any) => '₹' + v + 'L' } },
            x: { grid: { display: false } }
          }
        }
      });
    }

    // 3. Pipeline Funnel (Bar)
    const funnelCtx = document.getElementById('funnelChart') as HTMLCanvasElement;
    if (funnelCtx) {
      new Chart(funnelCtx, {
        type: 'bar',
        data: {
          labels: ['New Inquiries', 'Contacted', 'Site Visit', 'Proposal Sent', 'Won Deals'],
          datasets: [{
            label: 'Deals Count',
            data: [85, 62, 41, 28, 18],
            backgroundColor: ['#3b82f6', '#6366f1', '#eab308', '#8b5cf6', '#10b981'],
            borderRadius: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { grid: { color: '#f1f5f9' } },
            x: { grid: { display: false } }
          }
        }
      });
    }
  }

  toggleTask(task: TaskItem): void {
    task.status = task.status === 'Completed' ? 'Pending' : 'Completed';
  }
}
