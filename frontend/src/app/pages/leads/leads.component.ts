import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { CrmService, Lead } from '../../services/crm.service';

@Component({
  selector: 'app-leads',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './leads.component.html'
})
export class LeadsComponent implements OnInit {
  leads: Lead[] = [];
  filteredLeads: Lead[] = [];
  availableCategories: string[] = [];
  searchTerm: string = '';
  selectedScore: string = 'All';
  selectedStatus: string = 'All';
  selectedCategory: string = 'All';
  selectedLeadIds: Set<string> = new Set();
  viewMode: 'table' | 'kanban' = 'table';
  sortBy: string = 'score_desc';
  kanbanStages: string[] = ['New', 'Contacted', 'Qualified', 'Won', 'Lost'];

  // Scoring Settings & Breakdown modal state
  showScoringSettingsModal: boolean = false;
  showBreakdownModal: boolean = false;
  selectedLeadBreakdown: any = null;
  scoringConfig: any = null;
  isRecalculatingScores: boolean = false;
  scoringToast: string = '';

  // New Lead Modal state
  showAddModal: boolean = false;
  newLead: Partial<Lead> = {
    name: '',
    phone: '',
    email: '',
    company_name: '',
    category: 'Business & Commercial',
    source: 'Manual Entry',
    status: 'New',
    score: 'Warm',
    budget_value: 0
  };

  // Call Logging Modal state
  showCallModal: boolean = false;
  activeLeadForCall: Lead | null = null;
  callOutcome: string = 'connected';
  callDuration: number = 180;
  callNotes: string = '';
  callSuccessToast: string = '';
  dndWarningToast: string = '';

  // Plan Gating Modal state
  showUpgradeModal: boolean = false;
  lockedFeatureTitle: string = '';

  constructor(private crmService: CrmService) {}

  ngOnInit(): void {
    this.loadLeads();
  }

  loadLeads(): void {
    this.crmService.getLeads().subscribe(data => {
      this.leads = data;
      this.extractCategories();
      this.applyFilters();
    });
  }

  extractCategories(): void {
    const set = new Set<string>();
    this.leads.forEach(l => {
      if (l.category && l.category.trim()) {
        set.add(l.category.trim());
      }
    });
    this.availableCategories = Array.from(set).sort();
  }

  applyFilters(): void {
    this.filteredLeads = this.leads.filter(l => {
      const matchSearch = !this.searchTerm || 
        l.name.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        l.phone.includes(this.searchTerm) ||
        (l.email && l.email.toLowerCase().includes(this.searchTerm.toLowerCase())) ||
        (l.company_name && l.company_name.toLowerCase().includes(this.searchTerm.toLowerCase())) ||
        (l.category && l.category.toLowerCase().includes(this.searchTerm.toLowerCase()));

      const matchCategory = this.selectedCategory === 'All' || l.category === this.selectedCategory;
      const matchScore = this.selectedScore === 'All' || l.score === this.selectedScore;
      const matchStatus = this.selectedStatus === 'All' || l.status === this.selectedStatus;

      return matchSearch && matchCategory && matchScore && matchStatus;
    });

    // Apply sorting
    this.filteredLeads.sort((a, b) => {
      if (this.sortBy === 'score_desc') return (b.score_value || 50) - (a.score_value || 50);
      if (this.sortBy === 'score_asc') return (a.score_value || 50) - (b.score_value || 50);
      if (this.sortBy === 'deal_desc') return (b.budget_value || 0) - (a.budget_value || 0);
      if (this.sortBy === 'name') return a.name.localeCompare(b.name);
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }

  getLeadsForStage(stage: string): Lead[] {
    return this.filteredLeads.filter(l => l.status === stage);
  }

  // Scoring Settings Actions
  openScoringSettings(): void {
    this.crmService.getScoringConfig().subscribe(cfg => {
      this.scoringConfig = cfg || {};
      this.showScoringSettingsModal = true;
    });
  }

  saveScoringConfig(): void {
    if (!this.scoringConfig) return;
    this.crmService.updateScoringConfig(this.scoringConfig).subscribe(() => {
      this.showScoringSettingsModal = false;
      this.scoringToast = 'Lead scoring weights updated successfully.';
      setTimeout(() => this.scoringToast = '', 4000);
      this.loadLeads();
    });
  }

  resetScoringConfig(): void {
    if (confirm('Reset scoring configuration back to system defaults?')) {
      this.crmService.resetScoringConfig().subscribe(cfg => {
        this.scoringConfig = cfg;
        this.scoringToast = 'Scoring configuration reset to default rules.';
        setTimeout(() => this.scoringToast = '', 4000);
      });
    }
  }

  triggerRecalculateScores(): void {
    this.isRecalculatingScores = true;
    this.crmService.recalculateLeadScores().subscribe({
      next: (res) => {
        this.isRecalculatingScores = false;
        this.scoringToast = `Enqueued ${res.total_queued || 0} leads for score recalculation. Updating...`;
        setTimeout(() => {
          this.loadLeads();
          this.scoringToast = '';
        }, 1500);
      },
      error: () => {
        this.isRecalculatingScores = false;
      }
    });
  }

  openScoreBreakdown(lead: Lead): void {
    this.crmService.getLeadScoreBreakdown(lead.id).subscribe(data => {
      this.selectedLeadBreakdown = data;
      this.showBreakdownModal = true;
    });
  }

  resetFilters(): void {
    this.searchTerm = '';
    this.selectedScore = 'All';
    this.selectedStatus = 'All';
    this.selectedCategory = 'All';
    this.applyFilters();
  }

  toggleSelectAll(event: any): void {
    if (event.target.checked) {
      this.filteredLeads.forEach(l => this.selectedLeadIds.add(l.id));
    } else {
      this.selectedLeadIds.clear();
    }
  }

  toggleLeadSelect(id: string): void {
    if (this.selectedLeadIds.has(id)) {
      this.selectedLeadIds.delete(id);
    } else {
      this.selectedLeadIds.add(id);
    }
  }

  openAddLeadModal(): void {
    this.newLead = {
      name: '',
      phone: '',
      email: '',
      company_name: '',
      source: 'Manual Entry',
      status: 'New',
      score: 'Warm',
      budget_value: 0
    };
    this.showAddModal = true;
  }

  saveLead(): void {
    if (!this.newLead.name || !this.newLead.phone) return;
    this.crmService.addLead(this.newLead).subscribe(() => {
      this.showAddModal = false;
      this.loadLeads();
    });
  }

  openCallModal(lead: Lead): void {
    if (lead.is_dnd) {
      this.alertDnd(lead);
      return;
    }
    this.activeLeadForCall = lead;
    this.callOutcome = 'connected';
    this.callDuration = 120;
    this.callNotes = '';
    this.showCallModal = true;
  }

  alertDnd(lead: Lead): void {
    this.dndWarningToast = `🛑 DND SUPPRESSED: Cannot contact "${lead.name}" (${lead.phone}). Reason: ${lead.dnd_reason || 'Client is in Do-Not-Disturb suppression list'}.`;
    setTimeout(() => {
      this.dndWarningToast = '';
    }, 6000);
  }

  submitCallLog(): void {
    if (this.activeLeadForCall) {
      this.crmService.logCall(this.activeLeadForCall.id, this.callOutcome, this.callDuration, this.callNotes).subscribe();
    }
    this.callSuccessToast = `Call logged with ${this.activeLeadForCall?.name} (Outcome: ${this.callOutcome})`;
    this.showCallModal = false;
    setTimeout(() => this.callSuccessToast = '', 4000);
  }

  triggerPlanGating(feature: string): void {
    this.lockedFeatureTitle = feature;
    this.showUpgradeModal = true;
  }

  deleteLead(id: string): void {
    if (confirm('Are you sure you want to delete this lead?')) {
      this.crmService.deleteLead(id).subscribe(() => {
        this.leads = this.leads.filter(l => l.id !== id);
        this.applyFilters();
      });
    }
  }
}
