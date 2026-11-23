import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { CrmService, GooglePlaceResult } from '../../services/crm.service';

@Component({
  selector: 'app-google-maps-leads',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './google-maps-leads.component.html'
})
export class GoogleMapsLeadsComponent implements OnInit {
  searchQuery: string = '';
  selectedCity: string = '';
  isLoading: boolean = false;
  results: GooglePlaceResult[] = [];
  filteredResults: GooglePlaceResult[] = [];
  availableCategories: string[] = [];
  selectedCategory: string = 'All';
  selectedPlaces: Set<string> = new Set();
  importSuccessMessage: string = '';

  trendingKeywords = [
    { label: 'Coaching Institutes', city: 'Kanpur', icon: 'bi-mortarboard-fill', emoji: '🎓', color: '#6366f1' },
    { label: 'Top Hospitals', city: 'Kanpur', icon: 'bi-hospital-fill', emoji: '🏥', color: '#ef4444' },
    { label: 'Real Estate Agents', city: 'Mumbai', icon: 'bi-buildings-fill', emoji: '🏢', color: '#3b82f6' },
    { label: 'Dental Clinics', city: 'Delhi', icon: 'bi-heart-pulse-fill', emoji: '🦷', color: '#06b6d4' },
    { label: 'Gyms & Fitness', city: 'Bangalore', icon: 'bi-lightning-charge-fill', emoji: '🏋️', color: '#f59e0b' },
    { label: 'Interior Designers', city: 'Pune', icon: 'bi-palette-fill', emoji: '🎨', color: '#ec4899' },
    { label: 'Chartered Accountants', city: 'Hyderabad', icon: 'bi-briefcase-fill', emoji: '💼', color: '#10b981' },
    { label: 'Digital Marketing Agencies', city: 'Ahmedabad', icon: 'bi-laptop-fill', emoji: '💻', color: '#8b5cf6' }
  ];

  constructor(
    private crmService: CrmService,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      if (params['q']) {
        this.searchQuery = params['q'];
        if (params['city']) {
          this.selectedCity = params['city'];
        }
        this.executeSearch();
      }
    });
  }

  applyTrending(keyword: { label: string; city: string }): void {
    this.searchQuery = keyword.label;
    this.selectedCity = keyword.city;
    this.executeSearch();
  }

  executeSearch(): void {
    const q = this.searchQuery.trim();
    if (!q) return;

    this.isLoading = true;
    this.importSuccessMessage = '';
    this.selectedPlaces.clear();
    this.selectedCategory = 'All';

    this.crmService.searchGoogleMaps(q, this.selectedCity.trim()).subscribe({
      next: (data) => {
        this.results = data || [];
        this.extractCategories();
        this.applyCategoryFilter();
        this.isLoading = false;
      },
      error: () => {
        this.results = [];
        this.filteredResults = [];
        this.availableCategories = [];
        this.isLoading = false;
      }
    });
  }

  extractCategories(): void {
    const set = new Set<string>();
    this.results.forEach(r => {
      if (r.category && r.category.trim()) {
        set.add(r.category.trim());
      }
    });
    this.availableCategories = Array.from(set).sort();
  }

  applyCategoryFilter(): void {
    if (this.selectedCategory === 'All') {
      this.filteredResults = this.results;
    } else {
      this.filteredResults = this.results.filter(r => r.category === this.selectedCategory);
    }
  }

  toggleSelectAll(event: any): void {
    if (event.target.checked) {
      this.filteredResults.filter(r => !r.is_already_lead).forEach(r => this.selectedPlaces.add(r.place_id));
    } else {
      this.selectedPlaces.clear();
    }
  }

  togglePlace(placeId: string): void {
    if (this.selectedPlaces.has(placeId)) {
      this.selectedPlaces.delete(placeId);
    } else {
      this.selectedPlaces.add(placeId);
    }
  }

  importSelected(): void {
    const toImport = this.filteredResults.filter(r => this.selectedPlaces.has(r.place_id));
    if (toImport.length === 0) return;

    this.crmService.importGoogleMapsPlaces(toImport).subscribe(res => {
      this.importSuccessMessage = `Successfully imported ${res.count} fresh business leads into your CRM pipeline!`;
      toImport.forEach(r => r.is_already_lead = true);
      this.selectedPlaces.clear();
    });
  }
}
