import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, tap } from 'rxjs';

export interface UserSession {
  id: string;
  name: string;
  email: string;
  role: string;
  is_demo?: boolean;
  tenant_id: string;
  company?: string;
  industry?: string;
  currency?: string;
  plan?: string;
  plan_name?: string;
  subscription_status?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = 'https://api.yogkart.com/loomlead/api/v1';

  private currentUserSubject = new BehaviorSubject<UserSession | null>(this.getStoredUser());
  public currentUser$ = this.currentUserSubject.asObservable();

  // Demo locked modal state
  private demoModalSubject = new BehaviorSubject<{ isOpen: boolean; featureName: string }>({ isOpen: false, featureName: '' });
  public demoModal$ = this.demoModalSubject.asObservable();

  constructor(
    private http: HttpClient,
    private router: Router
  ) {}

  private getStoredUser(): UserSession | null {
    try {
      const data = localStorage.getItem('loomlead_user');
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  public get currentUserValue(): UserSession | null {
    return this.currentUserSubject.value;
  }

  public get demoModalValue(): { isOpen: boolean; featureName: string } {
    return this.demoModalSubject.value;
  }

  public getToken(): string | null {
    return localStorage.getItem('loomlead_token');
  }

  public isAuthenticated(): boolean {
    return !!this.getToken() && !!this.currentUserValue;
  }

  public isDemo(): boolean {
    const user = this.currentUserValue;
    return !!(user && (user.role === 'demo' || user.is_demo));
  }

  public isSuperAdmin(): boolean {
    const user = this.currentUserValue;
    return !!(user && user.role === 'superadmin');
  }

  login(credentials: { email: string; password: string }): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/auth/login`, credentials).pipe(
      tap(res => {
        if (res.success && res.token && res.user) {
          localStorage.setItem('loomlead_token', res.token);
          localStorage.setItem('loomlead_user', JSON.stringify(res.user));
          this.currentUserSubject.next(res.user);
        }
      })
    );
  }

  register(data: {
    name: string;
    email: string;
    password: string;
    company_name: string;
    phone?: string;
    industry?: string;
  }): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/auth/register`, data).pipe(
      tap(res => {
        if (res.success && res.token && res.user) {
          const userSession: UserSession = {
            ...res.user,
            company: res.tenant?.company_name || data.company_name,
            plan: 'free',
            plan_name: 'Free Trial Plan'
          };
          localStorage.setItem('loomlead_token', res.token);
          localStorage.setItem('loomlead_user', JSON.stringify(userSession));
          this.currentUserSubject.next(userSession);
        }
      })
    );
  }

  loginDemo(): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/auth/demo`, {}).pipe(
      tap(res => {
        if (res.success && res.token && res.user) {
          localStorage.setItem('loomlead_token', res.token);
          localStorage.setItem('loomlead_user', JSON.stringify(res.user));
          this.currentUserSubject.next(res.user);
        }
      })
    );
  }

  logout(): void {
    localStorage.removeItem('loomlead_token');
    localStorage.removeItem('loomlead_user');
    this.currentUserSubject.next(null);
    this.router.navigate(['/login']);
  }

  // Demo Restriction Modal Helpers
  triggerDemoLock(featureName: string): void {
    this.demoModalSubject.next({ isOpen: true, featureName });
  }

  closeDemoLock(): void {
    this.demoModalSubject.next({ isOpen: false, featureName: '' });
  }
}
