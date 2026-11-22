import { Component, OnInit, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CrmService, TaskItem, Lead } from '../../services/crm.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './dashboard.component.html'
})
export class DashboardComponent implements OnInit, AfterViewInit {
  tasksToday: TaskItem[] = [];
  selectedPeriod: string = 'Last 30 Days';

  totalLeads: number = 0;
  callsToday: number = 0;
  wonDeals: number = 0;
  wonRevenue: number = 0;
  pipelineRevenue: number = 0;
  conversionRate: number = 0;

  private leadsList: Lead[] = [];

  constructor(private crmService: CrmService) {}

  ngOnInit(): void {
    this.crmService.getLeads().subscribe(leads => {
      this.leadsList = leads;
      this.totalLeads = leads.length;
      const won = leads.filter(l => l.status === 'Won');
      this.wonDeals = won.length;
      this.wonRevenue = won.reduce((sum, l) => sum + (l.budget_value || 0), 0);
      this.pipelineRevenue = leads.filter(l => l.status !== 'Won' && l.status !== 'Lost').reduce((sum, l) => sum + (l.budget_value || 0), 0);
      this.conversionRate = this.totalLeads > 0 ? Math.round((this.wonDeals / this.totalLeads) * 100) : 0;
      this.initCharts();
    });

    this.crmService.getTasks().subscribe(tasks => {
      this.tasksToday = tasks;
    });
  }

  ngAfterViewInit(): void {
    this.initCharts();
  }

  toggleTask(t: TaskItem): void {
    t.status = t.status === 'Completed' ? 'Pending' : 'Completed';
  }

  initCharts(): void {
    const Chart = (window as any).Chart;
    if (!Chart) return;

    // 1. Leads by Source (Doughnut)
    const sourceCtx = document.getElementById('sourceChart') as HTMLCanvasElement;
    if (sourceCtx) {
      const gmapsCount = this.leadsList.filter(l => l.source === 'Google Maps').length;
      const directCount = this.leadsList.filter(l => l.source === 'Website' || l.source === 'Direct').length;
      const referralCount = this.leadsList.filter(l => l.source === 'Referral').length;
      const manualCount = this.leadsList.filter(l => l.source === 'Manual Entry').length;

      const hasData = this.totalLeads > 0;
      const counts = hasData ? [gmapsCount, directCount, referralCount, manualCount] : [1, 0, 0, 0];
      const labels = hasData ? ['Google Maps', 'Website', 'Referrals', 'Manual Entry'] : ['Awaiting Leads', '', '', ''];

      // Destroy old instance if exists
      const oldChart = Chart.getChart(sourceCtx);
      if (oldChart) oldChart.destroy();

      new Chart(sourceCtx, {
        type: 'doughnut',
        data: {
          labels: labels,
          datasets: [{
            data: counts,
            backgroundColor: hasData ? ['#4f46e5', '#3b82f6', '#10b981', '#f59e0b'] : ['#e2e8f0', '#f1f5f9', '#f8fafc', '#ffffff'],
            borderWidth: 2,
            borderColor: '#ffffff'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } }
          }
        }
      });
    }

    // 2. Monthly Revenue Trend (Spline Line Chart)
    const trendCtx = document.getElementById('trendChart') as HTMLCanvasElement;
    if (trendCtx) {
      const oldTrend = Chart.getChart(trendCtx);
      if (oldTrend) oldTrend.destroy();

      new Chart(trendCtx, {
        type: 'line',
        data: {
          labels: ['Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov'],
          datasets: [{
            label: 'Won Revenue (₹)',
            data: [0, 0, 0, 0, 0, this.wonRevenue],
            borderColor: '#2563eb',
            backgroundColor: 'rgba(37, 99, 235, 0.08)',
            fill: true,
            tension: 0.3
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { grid: { color: '#f1f5f9' }, ticks: { callback: (v: any) => '₹' + v } },
            x: { grid: { display: false } }
          }
        }
      });
    }

    // 3. Pipeline Funnel (Bar)
    const funnelCtx = document.getElementById('funnelChart') as HTMLCanvasElement;
    if (funnelCtx) {
      const oldFunnel = Chart.getChart(funnelCtx);
      if (oldFunnel) oldFunnel.destroy();

      const newCount = this.leadsList.filter(l => l.status === 'New').length;
      const contactedCount = this.leadsList.filter(l => l.status === 'Contacted').length;
      const proposalCount = this.leadsList.filter(l => l.status === 'Proposal').length;
      const wonCount = this.leadsList.filter(l => l.status === 'Won').length;

      new Chart(funnelCtx, {
        type: 'bar',
        data: {
          labels: ['New Leads', 'Contacted', 'Proposal Sent', 'Won Deals'],
          datasets: [{
            label: 'Deals Count',
            data: [newCount, contactedCount, proposalCount, wonCount],
            backgroundColor: ['#3b82f6', '#6366f1', '#8b5cf6', '#10b981'],
            borderRadius: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { stepSize: 1 } },
            x: { grid: { display: false } }
          }
        }
      });
    }
  }
}
