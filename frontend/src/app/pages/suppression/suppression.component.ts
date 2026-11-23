import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { CrmService, SuppressionEntry } from '../../services/crm.service';

@Component({
  selector: 'app-suppression',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './suppression.component.html'
})
export class SuppressionComponent implements OnInit {
  suppressionList: SuppressionEntry[] = [];
  filteredList: SuppressionEntry[] = [];
  searchTerm: string = '';
  selectedType: string = 'All';
  isLoading: boolean = false;

  // Add modal state
  showAddModal: boolean = false;
  newEntry: { type: 'phone' | 'email'; value: string; reason: string } = {
    type: 'phone',
    value: '',
    reason: 'manual'
  };

  // Toast feedback
  toastMessage: string = '';
  toastType: 'success' | 'danger' = 'success';

  constructor(private crmService: CrmService) {}

  ngOnInit(): void {
    this.loadSuppressionList();
  }

  loadSuppressionList(): void {
    this.isLoading = true;
    this.crmService.getSuppressionList(this.searchTerm, this.selectedType).subscribe({
      next: (data) => {
        this.suppressionList = data;
        this.applyFilters();
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      }
    });
  }

  applyFilters(): void {
    this.filteredList = this.suppressionList.filter(item => {
      const matchSearch = !this.searchTerm ||
        item.value.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        item.reason.toLowerCase().includes(this.searchTerm.toLowerCase());

      const matchType = this.selectedType === 'All' || item.type === this.selectedType;
      return matchSearch && matchType;
    });
  }

  get phoneCount(): number {
    return this.suppressionList.filter(s => s.type === 'phone').length;
  }

  get emailCount(): number {
    return this.suppressionList.filter(s => s.type === 'email').length;
  }

  get stopKeywordCount(): number {
    return this.suppressionList.filter(s => s.reason === 'stop_keyword').length;
  }

  openAddModal(): void {
    this.newEntry = {
      type: 'phone',
      value: '',
      reason: 'manual'
    };
    this.showAddModal = true;
  }

  submitAdd(): void {
    if (!this.newEntry.value.trim()) {
      this.showToast('Please enter a phone number or email address.', 'danger');
      return;
    }

    this.crmService.addSuppression(this.newEntry.type, this.newEntry.value.trim(), this.newEntry.reason).subscribe({
      next: (res) => {
        this.showAddModal = false;
        this.showToast(`${this.newEntry.type.toUpperCase()} '${this.newEntry.value}' added to DND suppression list!`, 'success');
        this.loadSuppressionList();
      },
      error: (err) => {
        this.showToast(err.error?.message || 'Failed to add suppression entry', 'danger');
      }
    });
  }

  deleteEntry(item: SuppressionEntry): void {
    if (confirm(`Are you sure you want to remove '${item.value}' from DND? Outbound communications will be re-enabled.`)) {
      this.crmService.removeSuppression(item.id).subscribe({
        next: (success) => {
          if (success) {
            this.showToast(`'${item.value}' removed from DND suppression list.`, 'success');
            this.loadSuppressionList();
          } else {
            this.showToast('Failed to remove entry from suppression list.', 'danger');
          }
        },
        error: () => {
          this.showToast('Failed to remove entry from suppression list.', 'danger');
        }
      });
    }
  }

  showToast(message: string, type: 'success' | 'danger' = 'success'): void {
    this.toastMessage = message;
    this.toastType = type;
    setTimeout(() => {
      this.toastMessage = '';
    }, 4500);
  }

  getReasonBadgeClass(reason: string): string {
    switch (reason) {
      case 'stop_keyword':
        return 'bg-danger text-white';
      case 'unsubscribe':
        return 'bg-warning text-dark';
      case 'bounce':
        return 'bg-secondary text-white';
      case 'manual':
      default:
        return 'bg-info-subtle text-info border border-info-subtle';
    }
  }

  formatReasonLabel(reason: string): string {
    switch (reason) {
      case 'stop_keyword':
        return 'STOP Keyword (Auto)';
      case 'unsubscribe':
        return 'Unsubscribed';
      case 'bounce':
        return 'Email Bounce';
      case 'manual':
      default:
        return 'Manual DND Entry';
    }
  }
}
