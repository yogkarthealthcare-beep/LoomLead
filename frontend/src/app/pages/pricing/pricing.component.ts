import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-pricing',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './pricing.component.html'
})
export class PricingComponent {
  isYearly: boolean = false;
  selectedPlanForUpgrade: any = null;
  showCheckoutModal: boolean = false;

  plans = [
    {
      code: 'free',
      name: 'Free Plan',
      tagline: 'Ideal for solo freelancers & early exploration',
      monthlyPrice: 0,
      yearlyPrice: 0,
      users: '1 User only',
      leads: '50 Leads max',
      gmaps: '5 Extractions / mo',
      badge: 'Free Forever',
      color: 'secondary',
      popular: false,
      features: [
        { name: 'Lead & Contact Management', included: true },
        { name: 'Google Maps Prospector (5/mo)', included: true },
        { name: 'AI Agent Copilot (5/day)', included: true },
        { name: 'Call Tracking & Notes', included: true },
        { name: 'Sales Pipeline (Kanban)', included: false },
        { name: 'Advanced Reports & Charts', included: false },
        { name: 'Data Import / Export (PDF/Excel)', included: false },
        { name: 'Quotations & Invoices', included: false }
      ]
    },
    {
      code: 'basic',
      name: 'Basic Starter',
      tagline: 'Perfect for small teams & startup agencies',
      monthlyPrice: 999,
      yearlyPrice: 799,
      users: 'Up to 3 Users',
      leads: '1,000 Leads',
      gmaps: '50 Extractions / mo',
      badge: 'Starter',
      color: 'primary',
      popular: false,
      features: [
        { name: 'Lead & Contact Management', included: true },
        { name: 'Google Maps Prospector (50/mo)', included: true },
        { name: 'AI Agent Copilot (25/day)', included: true },
        { name: 'Call Tracking & Notes', included: true },
        { name: 'Sales Pipeline (Kanban)', included: true },
        { name: 'Basic CSV Import / Export', included: true },
        { name: 'Advanced Reports & Charts', included: false },
        { name: 'Quotations & Invoices', included: false }
      ]
    },
    {
      code: 'medium',
      name: 'Medium Pro',
      tagline: 'Best for growing sales teams needing BI & automations',
      monthlyPrice: 2999,
      yearlyPrice: 2399,
      users: 'Up to 10 Users',
      leads: '10,000 Leads',
      gmaps: '500 Extractions / mo',
      badge: 'Most Popular',
      color: 'indigo',
      popular: true,
      features: [
        { name: 'Lead & Contact Management', included: true },
        { name: 'Google Maps Prospector (500/mo)', included: true },
        { name: 'AI Agent Copilot (150/day)', included: true },
        { name: 'Call Tracking & Notes', included: true },
        { name: 'Sales Pipeline (Kanban)', included: true },
        { name: 'Full Reports & Chart.js BI', included: true },
        { name: 'Excel, PDF, Word & CSV Import', included: true },
        { name: 'Automated Workflow Rules', included: true }
      ]
    },
    {
      code: 'advanced',
      name: 'Advanced Enterprise',
      tagline: 'Complete CRM suite with full invoicing & unlimited scale',
      monthlyPrice: 7999,
      yearlyPrice: 6399,
      users: 'Unlimited Users',
      leads: 'Unlimited Leads',
      gmaps: '2,500 Extractions / mo',
      badge: 'Enterprise',
      color: 'dark',
      popular: false,
      features: [
        { name: 'Lead & Contact Management', included: true },
        { name: 'Google Maps Prospector (2,500/mo)', included: true },
        { name: 'AI Agent Copilot (Unlimited)', included: true },
        { name: 'Call Tracking & Notes', included: true },
        { name: 'Multi-Pipeline Funnels', included: true },
        { name: 'Quotations & Invoicing Suite', included: true },
        { name: 'REST API & Webhooks Access', included: true },
        { name: '24/7 Dedicated Account Manager', included: true }
      ]
    }
  ];

  selectPlan(plan: any): void {
    this.selectedPlanForUpgrade = plan;
    this.showCheckoutModal = true;
  }
}
