import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';

export interface Lead {
  id: string;
  name: string;
  phone: string;
  email: string;
  company_name: string;
  source: string;
  status: string;
  score: 'Hot' | 'Warm' | 'Cold';
  budget_value: number;
  next_followup_at: string;
  created_at: string;
}

export interface TaskItem {
  id: string;
  title: string;
  type: string;
  priority: 'High' | 'Medium' | 'Low';
  due_date: string;
  status: 'Pending' | 'Completed';
  lead_name?: string;
  lead_phone?: string;
}

export interface GooglePlaceResult {
  place_id: string;
  name: string;
  phone: string;
  address: string;
  city: string;
  rating: number;
  user_ratings_total: number;
  website: string;
  is_already_lead: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class CrmService {
  private apiUrl = 'http://localhost:5000/api/v1';

  // Realistic fallback demo data
  private demoLeads: Lead[] = [
    { id: '1', name: 'Rajesh Kulkarni', phone: '+91 98201 12345', email: 'rajesh.k@apexrealty.com', company_name: 'Kulkarni Holdings', source: 'Google Maps', status: 'Contacted', score: 'Hot', budget_value: 2500000, next_followup_at: 'Today, 4:00 PM', created_at: '2026-11-18' },
    { id: '2', name: 'Ananya Deshmukh', phone: '+91 99302 23456', email: 'ananya@zenithdesign.in', company_name: 'Zenith Studio', source: 'Website', status: 'New', score: 'Warm', budget_value: 1200000, next_followup_at: 'Tomorrow, 11:30 AM', created_at: '2026-11-19' },
    { id: '3', name: 'Dr. Sameer Joshi', phone: '+91 97110 34567', email: 'dr.joshi@careplus.org', company_name: 'CarePlus Dental', source: 'Google Maps', status: 'Proposal', score: 'Hot', budget_value: 4500000, next_followup_at: 'Today, 2:00 PM', created_at: '2026-11-15' },
    { id: '4', name: 'Pooja Agarwal', phone: '+91 98450 45678', email: 'pooja@agarwalinfra.com', company_name: 'Agarwal Infra', source: 'Referral', status: 'Won', score: 'Warm', budget_value: 8000000, next_followup_at: 'Completed', created_at: '2026-11-10' },
    { id: '5', name: 'Vikram Chawla', phone: '+91 98990 56789', email: 'v.chawla@fitnesstransform.com', company_name: 'IronCore Gym', source: 'Google Maps', status: 'Negotiation', score: 'Hot', budget_value: 3200000, next_followup_at: '22 Nov, 3:30 PM', created_at: '2026-11-12' },
    { id: '6', name: 'Neha Singhal', phone: '+91 98101 67890', email: 'neha@singhallegal.com', company_name: 'Singhal & Co', source: 'Social Media', status: 'Lost', score: 'Cold', budget_value: 900000, next_followup_at: 'None', created_at: '2026-11-08' }
  ];

  private demoTasks: TaskItem[] = [
    { id: 't1', title: 'Call Dr. Sameer Joshi for Dental Clinic Expansion proposal', type: 'Call', priority: 'High', due_date: 'Today, 2:00 PM', status: 'Pending', lead_name: 'Dr. Sameer Joshi', lead_phone: '+91 97110 34567' },
    { id: 't2', title: 'Send revised quotation on WhatsApp to Rajesh Kulkarni', type: 'Call', priority: 'High', due_date: 'Today, 4:00 PM', status: 'Pending', lead_name: 'Rajesh Kulkarni', lead_phone: '+91 98201 12345' },
    { id: 't3', title: 'Schedule Zoom demo meeting with Ananya Deshmukh', type: 'Meeting', priority: 'Medium', due_date: 'Tomorrow, 11:30 AM', status: 'Pending', lead_name: 'Ananya Deshmukh', lead_phone: '+91 99302 23456' },
    { id: 't4', title: 'Follow-up on signed booking agreement with Pooja Agarwal', type: 'Site Visit', priority: 'Low', due_date: 'Yesterday', status: 'Completed', lead_name: 'Pooja Agarwal', lead_phone: '+91 98450 45678' }
  ];

  constructor(private http: HttpClient) {}

  getLeads(): Observable<Lead[]> {
    return of(this.demoLeads);
  }

  getTasks(): Observable<TaskItem[]> {
    return of(this.demoTasks);
  }

  addLead(lead: Partial<Lead>): Observable<Lead> {
    const newLead: Lead = {
      id: (this.demoLeads.length + 1).toString(),
      name: lead.name || 'New Lead',
      phone: lead.phone || '',
      email: lead.email || '',
      company_name: lead.company_name || 'N/A',
      source: lead.source || 'Manual Entry',
      status: lead.status || 'New',
      score: lead.score || 'Warm',
      budget_value: lead.budget_value || 0,
      next_followup_at: lead.next_followup_at || 'Tomorrow, 10:00 AM',
      created_at: new Date().toISOString().split('T')[0]
    };
    this.demoLeads.unshift(newLead);
    return of(newLead);
  }

  // Google Maps Lead Finder
  searchGoogleMaps(query: string, location: string): Observable<GooglePlaceResult[]> {
    const city = location || 'Mumbai';
    const mockResults: GooglePlaceResult[] = [
      { place_id: 'p1', name: `Elite ${query} Hub`, phone: '+91 98204 88121', address: `Shop 14, Lotus Plaza, Andheri, ${city}`, city: city, rating: 4.8, user_ratings_total: 194, website: 'https://elitehub.example.com', is_already_lead: false },
      { place_id: 'p2', name: `Prime Care ${query} Center`, phone: '+91 97112 44321', address: `Plot 52, Ring Road, Sector 18, ${city}`, city: city, rating: 4.9, user_ratings_total: 312, website: 'https://primecare.example.com', is_already_lead: true },
      { place_id: 'p3', name: `Vanguard ${query} Solutions`, phone: '+91 99308 77654', address: `Level 2, Infinity Tower, MIDC, ${city}`, city: city, rating: 4.6, user_ratings_total: 87, website: 'https://vanguardsol.example.com', is_already_lead: false },
      { place_id: 'p4', name: `Metro City ${query}`, phone: '+91 98451 99887', address: `Station Road, Near Metro Gate 3, ${city}`, city: city, rating: 4.5, user_ratings_total: 65, website: 'https://metrocity.example.com', is_already_lead: false },
      { place_id: 'p5', name: `Apex Signature ${query}`, phone: '+91 98115 33221', address: `Galleria Complex, FC Road, ${city}`, rating: 4.7, user_ratings_total: 142, city: city, website: 'https://apexsignature.example.com', is_already_lead: false }
    ];
    return of(mockResults);
  }

  importGoogleMapsPlaces(places: GooglePlaceResult[]): Observable<{ count: number }> {
    places.forEach(p => {
      this.addLead({
        name: p.name,
        phone: p.phone,
        company_name: p.name,
        source: 'Google Maps',
        score: 'Warm',
        status: 'New'
      });
    });
    return of({ count: places.length });
  }

  // AI Copilot Query Processor
  askAICopilot(prompt: string): Observable<{ message: string; action?: any; suggestions?: string[] }> {
    const p = prompt.toLowerCase();
    if (p.includes('hot') || p.includes('urgent')) {
      return of({
        message: 'Here are your Hot priority leads currently awaiting follow-up today.',
        action: { type: 'FILTER_LEADS', score: 'Hot' },
        suggestions: ['Schedule call with Dr. Sameer Joshi', 'Open Pipeline Kanban', 'Log a call']
      });
    }

    if (p.includes('google map') || p.includes('scraper') || p.includes('find lead') || p.includes('niche')) {
      return of({
        message: 'Opening Google Maps Lead Discovery page. Trending searches: "Interior Designers in Mumbai", "Dental Clinics in Delhi".',
        action: { type: 'NAVIGATE', route: '/google-maps-leads' },
        suggestions: ['Search Interior Designers in Pune', 'Search Real Estate Agents in Bangalore']
      });
    }

    if (p.includes('call') && (p.includes('task') || p.includes('banao') || p.includes('remind'))) {
      const task: TaskItem = {
        id: 't_' + Date.now(),
        title: prompt.replace(/task banao|create task|remind me to/gi, '').trim() || 'Follow-up with client',
        type: 'Call',
        priority: 'High',
        due_date: 'Tomorrow, 3:00 PM',
        status: 'Pending'
      };
      this.demoTasks.unshift(task);
      return of({
        message: `✅ Task scheduled successfully: "${task.title}" for Tomorrow at 3:00 PM.`,
        action: { type: 'TASK_CREATED', task },
        suggestions: ['View Today\'s Tasks', 'Open Hot Leads', 'Send WhatsApp Template']
      });
    }

    if (p.includes('summary') || p.includes('revenue') || p.includes('kya haal hai')) {
      return of({
        message: '📊 Today\'s CRM Summary:\n• Total Leads: 24\n• Calls Completed Today: 12\n• Hot Deals in Pipeline: 3 (₹1.02 Cr)\n• Closed Won This Month: ₹80,00,000',
        action: { type: 'NAVIGATE', route: '/dashboard' },
        suggestions: ['View Overdue Tasks', 'Check Revenue Graph', 'Export to PDF']
      });
    }

    return of({
      message: `Aapka request mila: "${prompt}". Aap mujhse bol sakte hain:\n• "Hot leads dikhao"\n• "Google Maps se leads nikaalo"\n• "Rahul ko call karne ka task banao kal 3 baje"\n• "Total revenue aur calls summary batao"`,
      suggestions: ['Show Hot Leads', 'Find Leads on Google Maps', 'View Revenue Report', 'Open Pipeline']
    });
  }
}
