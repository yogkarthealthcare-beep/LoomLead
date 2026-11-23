import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CrmService } from './services/crm.service';
import { AuthService } from './services/auth.service';

interface ChatMessage {
  sender: 'user' | 'agent';
  text: string;
  timestamp: string;
  suggestions?: string[];
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  public title: string = 'LoomLead CRM';
  public isSidebarOpen: boolean = false;
  public isAiChatOpen: boolean = false;
  public aiPromptInput: string = '';
  public globalSearchText: string = '';

  public chatMessages: ChatMessage[] = [
    {
      sender: 'agent',
      text: 'Namaste! Main aapka LoomLead AI Assistant hoon. Aap mujhse bol sakte hain: "Hot leads dikhao", "Google Maps scraper open karo", ya "Rahul ko call karne ka task banao".',
      timestamp: 'Just now',
      suggestions: [
        'Hot leads dikhao',
        'Google Maps lead scraper open karo',
        'Rahul ko call karne ka task banao',
        'Aaj ka revenue summary batao'
      ]
    }
  ];

  constructor(
    private crmService: CrmService, 
    public authService: AuthService,
    public router: Router
  ) {
    this.router.events.subscribe(() => {
      this.closeSidebar();
    });
  }

  /**
   * Checks if current active route is login / register
   */
  public isLoginPage(): boolean {
    return this.router.url.includes('/login');
  }

  /**
   * Toggles the mobile drawer sidebar
   */
  public toggleSidebar(): void {
    this.isSidebarOpen = !this.isSidebarOpen;
  }

  /**
   * Closes the mobile drawer sidebar
   */
  public closeSidebar(): void {
    this.isSidebarOpen = false;
  }

  /**
   * Auto-closes sidebar on mobile when navigating
   */
  public onNavLinkClick(): void {
    if (window.innerWidth < 992) {
      this.closeSidebar();
    }
  }

  public onGlobalSearch(): void {
    if (!this.globalSearchText.trim()) return;
    if (this.authService.isDemo()) {
      this.authService.triggerDemoLock('Global Google Maps Search');
      return;
    }
    this.router.navigate(['/google-maps-leads'], { queryParams: { q: this.globalSearchText.trim() } });
    this.globalSearchText = '';
  }

  public toggleAiChat(): void {
    this.isAiChatOpen = !this.isAiChatOpen;
  }

  public sendAiPrompt(customText?: string): void {
    const textToSend = customText || this.aiPromptInput;
    if (!textToSend || textToSend.trim() === '') return;

    // Push user message
    this.chatMessages.push({
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });

    this.aiPromptInput = '';

    // Query AI Copilot Service
    this.crmService.askAICopilot(textToSend).subscribe(res => {
      this.chatMessages.push({
        sender: 'agent',
        text: res.message,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        suggestions: res.suggestions
      });

      // Execute autonomous action if returned
      if (res.action) {
        if (res.action.type === 'NAVIGATE') {
          this.router.navigate([res.action.route]);
        } else if (res.action.type === 'FILTER_LEADS') {
          this.router.navigate(['/leads']);
        }
      }
    });
  }

  public logout(): void {
    this.authService.logout();
  }
}
