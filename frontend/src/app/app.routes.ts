import { Routes } from '@angular/router';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { LeadsComponent } from './pages/leads/leads.component';
import { GoogleMapsLeadsComponent } from './pages/google-maps-leads/google-maps-leads.component';
import { SequencesComponent } from './pages/sequences/sequences.component';
import { SuppressionComponent } from './pages/suppression/suppression.component';
import { IntegrationsComponent } from './pages/integrations/integrations.component';
import { PricingComponent } from './pages/pricing/pricing.component';
import { SuperAdminComponent } from './pages/super-admin/super-admin.component';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: 'dashboard', component: DashboardComponent },
  { path: 'leads', component: LeadsComponent },
  { path: 'google-maps-leads', component: GoogleMapsLeadsComponent },
  { path: 'sequences', component: SequencesComponent },
  { path: 'suppression', component: SuppressionComponent },
  { path: 'integrations', component: IntegrationsComponent },
  { path: 'pricing', component: PricingComponent },
  { path: 'super-admin', component: SuperAdminComponent },
  { path: '**', redirectTo: 'dashboard' }
];
