import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login.component';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { LeadsComponent } from './pages/leads/leads.component';
import { GoogleMapsLeadsComponent } from './pages/google-maps-leads/google-maps-leads.component';
import { SequencesComponent } from './pages/sequences/sequences.component';
import { SuppressionComponent } from './pages/suppression/suppression.component';
import { IntegrationsComponent } from './pages/integrations/integrations.component';
import { PricingComponent } from './pages/pricing/pricing.component';
import { SuperAdminComponent } from './pages/super-admin/super-admin.component';
import { authGuard, superAdminGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: 'dashboard', component: DashboardComponent, canActivate: [authGuard] },
  { path: 'leads', component: LeadsComponent, canActivate: [authGuard] },
  { path: 'google-maps-leads', component: GoogleMapsLeadsComponent, canActivate: [authGuard] },
  { path: 'sequences', component: SequencesComponent, canActivate: [authGuard] },
  { path: 'suppression', component: SuppressionComponent, canActivate: [authGuard] },
  { path: 'integrations', component: IntegrationsComponent, canActivate: [authGuard] },
  { path: 'pricing', component: PricingComponent, canActivate: [authGuard] },
  { path: 'super-admin', component: SuperAdminComponent, canActivate: [superAdminGuard] },
  { path: '**', redirectTo: 'dashboard' }
];
