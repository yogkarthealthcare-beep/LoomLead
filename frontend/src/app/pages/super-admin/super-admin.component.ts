import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { CrmService } from '../../services/crm.service';

export interface TenantRow {
  id: string;
  name: string;
  owner: string;
  email: string;
  plan: string;
  users: number;
  leads: number;
  expiry: string;
  status: string;
}

@Component({
  selector: 'app-super-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './super-admin.component.html'
})
export class SuperAdminComponent implements OnInit {
  searchTerm: string = '';
  selectedStatus: string = 'All';

  tenants: TenantRow[] = [];
  filteredTenants: TenantRow[] = [];
  impersonationToast: string = '';

  totalTenants: number = 0;
  activeSubscribers: number = 0;
  totalPlatformLeads: number = 0;
  totalMrr: number = 0;

  constructor(private crmService: CrmService) {}

  ngOnInit(): void {
    this.crmService.getSuperAdminTenants().subscribe(data => {
      this.tenants = data;
      this.computeStats();
      this.filterTenants();
    });
  }

  computeStats(): void {
    this.totalTenants = this.tenants.length;
    this.activeSubscribers = this.tenants.filter(t => t.status === 'Active').length;
    this.totalPlatformLeads = this.tenants.reduce((sum, t) => sum + (t.leads || 0), 0);
    this.totalMrr = this.tenants.reduce((sum, t) => {
      const price = t.plan === 'Advanced' ? 7999 : (t.plan === 'Medium Pro' ? 2999 : (t.plan === 'Basic' ? 999 : 0));
      return sum + price;
    }, 0);
  }

  filterTenants(): void {
    this.filteredTenants = this.tenants.filter(t => {
      const matchSearch = !this.searchTerm ||
        t.name.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        t.owner.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        t.email.toLowerCase().includes(this.searchTerm.toLowerCase());

      const matchStatus = this.selectedStatus === 'All' || t.status === this.selectedStatus;
      return matchSearch && matchStatus;
    });
  }

  impersonate(tenant: TenantRow): void {
    this.impersonationToast = `Logging in as Tenant Admin: "${tenant.owner}" (${tenant.name}). Redirecting...`;
    setTimeout(() => this.impersonationToast = '', 4000);
  }

  toggleStatus(tenant: TenantRow): void {
    tenant.status = tenant.status === 'Active' ? 'Suspended' : 'Active';
    this.computeStats();
  }
}
