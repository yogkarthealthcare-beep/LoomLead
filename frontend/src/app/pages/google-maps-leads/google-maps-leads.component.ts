import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { CrmService, GooglePlaceResult } from '../../services/crm.service';

@Component({
  selector: 'app-google-maps-leads',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './google-maps-leads.component.html'
})
export class GoogleMapsLeadsComponent implements OnInit {
  searchQuery: string = 'Interior Designers';
  selectedCity: string = 'Mumbai';
  isLoading: boolean = false;
  results: GooglePlaceResult[] = [];
  selectedPlaces: Set<string> = new Set();
  importSuccessMessage: string = '';

  trendingKeywords = [
    { label: 'Real Estate Agents', city: 'Mumbai' },
    { label: 'Dental Clinics', city: 'Delhi' },
    { label: 'Gyms & Fitness', city: 'Bangalore' },
    { label: 'Interior Designers', city: 'Pune' },
    { label: 'Chartered Accountants', city: 'Hyderabad' },
    { label: 'Cosmetic Clinics', city: 'Gurgaon' },
    { label: 'Digital Marketing Agencies', city: 'Ahmedabad' }
  ];

  constructor(private crmService: CrmService) {}

  ngOnInit(): void {
    this.executeSearch();
  }

  applyTrending(keyword: { label: string; city: string }): void {
    this.searchQuery = keyword.label;
    this.selectedCity = keyword.city;
    this.executeSearch();
  }

  executeSearch(): void {
    this.isLoading = true;
    this.importSuccessMessage = '';
    this.selectedPlaces.clear();

    this.crmService.searchGoogleMaps(this.searchQuery, this.selectedCity).subscribe({
      next: (data) => {
        this.results = data;
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      }
    });
  }

  toggleSelectAll(event: any): void {
    if (event.target.checked) {
      this.results.filter(r => !r.is_already_lead).forEach(r => this.selectedPlaces.add(r.place_id));
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
    const toImport = this.results.filter(r => this.selectedPlaces.has(r.place_id));
    if (toImport.length === 0) return;

    this.crmService.importGoogleMapsPlaces(toImport).subscribe(res => {
      this.importSuccessMessage = `Successfully imported ${res.count} fresh business leads into your CRM pipeline!`;
      toImport.forEach(r => r.is_already_lead = true);
      this.selectedPlaces.clear();
    });
  }
}
