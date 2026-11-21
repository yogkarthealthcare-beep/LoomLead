import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-super-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './super-admin.component.html'
})
export class SuperAdminComponent implements OnInit {
  searchTerm: string = '';
  selectedStatus: string = 'All';

  tenants = [
    { id: '1', name: 'Apex Realty Group', owner: 'Vikram Mehta', email: 'vikram@apexrealty.com', plan: 'Medium Pro', users: 3, leads: 142, expiry: '2026-12-20', status: 'Active', mrr: 2999 },
    { id: '2', name: 'CarePlus Dental Clinics', owner: 'Dr. Sameer Joshi', email: 'dr.joshi@careplus.org', plan: 'Advanced', users: 12, leads: 1840, expiry: '2027-01-15', status: 'Active', mrr: 7999 },
    { id: '3', name: 'Zenith Architecture Studio', owner: 'Ananya Deshmukh', email: 'ananya@zenithdesign.in', plan: 'Basic', users: 2, leads: 310, expiry: '2026-11-28', status: 'Active', mrr: 999 },
    { id: '4', name: 'IronCore Fitness Clubs', owner: 'Vikram Chawla', email: 'v.chawla@fitnesstransform.com', plan: 'Free', users: 1, leads: 48, expiry: '2026-12-05', status: 'Active', mrr: 0 },
    { id: '5', name: 'Metro EduTech Institute', owner: 'Ramesh Sundaram', email: 'ramesh@metroedutech.in', plan: 'Medium Pro', users: 8, leads: 2450, expiry: '2026-11-10', status: 'Expired', mrr: 0 }
  ];

  filteredTenants = [...this.tenants];
  impersonationToast: string = '';

  ngOnInit(): void {
    this.filterTenants();
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

  impersonate(tenant: any): void {
    this.impersonationToast = `Logging in as Tenant Admin: "${tenant.owner}" (${tenant.name}). Redirecting...`;
    setTimeout(() => this.impersonationToast = '', 4000);
  }

  toggleStatus(tenant: any): void {
    tenant.status = tenant.status === 'Active' ? 'Suspended' : 'Active';
  }
}
