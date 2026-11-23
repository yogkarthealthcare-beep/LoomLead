import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CrmService, ApiKeyItem, WebhookSubscriptionItem, WebhookDeliveryItem } from '../../services/crm.service';

@Component({
  selector: 'app-integrations',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './integrations.component.html',
  styleUrls: []
})
export class IntegrationsComponent implements OnInit {
  activeTab: 'api_keys' | 'webhooks' | 'deliveries' | 'extension' = 'api_keys';

  // API Keys
  apiKeys: ApiKeyItem[] = [];
  showCreateKeyModal = false;
  showRawKeyModal = false;
  newKeyName = '';
  newKeyScopeRead = true;
  newKeyScopeWrite = true;
  justCreatedKey: ApiKeyItem | null = null;
  keyCopied = false;

  // Webhooks
  subscriptions: WebhookSubscriptionItem[] = [];
  showAddWebhookModal = false;
  newWebhookUrl = '';
  newWebhookDescription = '';
  selectedEvents: { [key: string]: boolean } = {
    'lead.created': true,
    'lead.stage_changed': true,
    'lead.won': true,
    'email.replied': true,
    'whatsapp.replied': true
  };
  supportedEvents = [
    { key: 'lead.created', label: 'Lead Created', desc: 'Triggered when a new lead is ingested or imported.' },
    { key: 'lead.stage_changed', label: 'Stage Changed', desc: 'Triggered when a lead moves across pipeline stages.' },
    { key: 'lead.won', label: 'Deal Won', desc: 'Triggered specifically when a lead reaches the Won stage.' },
    { key: 'email.replied', label: 'Email Replied', desc: 'Triggered when an outbound sequence email receives a reply.' },
    { key: 'whatsapp.replied', label: 'WhatsApp Replied', desc: 'Triggered when an inbound WhatsApp reply is received.' }
  ];
  revealedSecrets: { [key: string]: boolean } = {};

  // Deliveries
  deliveries: WebhookDeliveryItem[] = [];
  deliveryStatusFilter = 'All';
  deliveryEventFilter = 'All';
  selectedPayloadForModal: any = null;
  showPayloadModal = false;
  resendingDeliveryId: string | null = null;

  // Toasts
  toastMessage = '';
  toastType: 'success' | 'danger' | 'info' = 'success';

  // Constants
  publicApiBaseUrl = 'https://api.yogkart.com/loomlead/api/v1/public';
  copiedApiUrl = false;

  constructor(private crmService: CrmService) {}

  ngOnInit(): void {
    this.loadApiKeys();
    this.loadWebhookSubscriptions();
    this.loadDeliveries();
  }

  // =========================================================================
  // API KEYS ACTIONS
  // =========================================================================

  loadApiKeys(): void {
    this.crmService.getApiKeys().subscribe(keys => {
      this.apiKeys = keys;
    });
  }

  openCreateKeyModal(): void {
    this.newKeyName = '';
    this.newKeyScopeRead = true;
    this.newKeyScopeWrite = true;
    this.showCreateKeyModal = true;
  }

  submitCreateKey(): void {
    if (!this.newKeyName.trim()) {
      alert('Please enter a descriptive name for this API key.');
      return;
    }

    const scopes: string[] = [];
    if (this.newKeyScopeRead) scopes.push('leads:read');
    if (this.newKeyScopeWrite) scopes.push('leads:write');

    if (scopes.length === 0) {
      alert('Please select at least one permission scope.');
      return;
    }

    this.crmService.createApiKey(this.newKeyName.trim(), scopes).subscribe({
      next: (key) => {
        this.showCreateKeyModal = false;
        this.justCreatedKey = key;
        this.showRawKeyModal = true;
        this.keyCopied = false;
        this.loadApiKeys();
      },
      error: (err) => {
        alert(err.error?.message || 'Failed to create API key.');
      }
    });
  }

  copyRawKey(): void {
    if (this.justCreatedKey?.raw_key) {
      navigator.clipboard.writeText(this.justCreatedKey.raw_key);
      this.keyCopied = true;
      setTimeout(() => this.keyCopied = false, 3000);
    }
  }

  copyApiUrl(): void {
    navigator.clipboard.writeText(this.publicApiBaseUrl);
    this.copiedApiUrl = true;
    setTimeout(() => this.copiedApiUrl = false, 3000);
  }

  revokeKey(key: ApiKeyItem): void {
    if (confirm(`Are you sure you want to revoke API Key "${key.name}"? Any integrated apps or Chrome extensions using this key will immediately lose access.`)) {
      this.crmService.revokeApiKey(key.id).subscribe(() => {
        this.showToast(`API Key "${key.name}" revoked successfully.`);
        this.loadApiKeys();
      });
    }
  }

  // =========================================================================
  // WEBHOOK SUBSCRIPTIONS ACTIONS
  // =========================================================================

  loadWebhookSubscriptions(): void {
    this.crmService.getWebhookSubscriptions().subscribe(subs => {
      this.subscriptions = subs;
    });
  }

  openAddWebhookModal(): void {
    this.newWebhookUrl = '';
    this.newWebhookDescription = '';
    this.selectedEvents = {
      'lead.created': true,
      'lead.stage_changed': true,
      'lead.won': true,
      'email.replied': true,
      'whatsapp.replied': true
    };
    this.showAddWebhookModal = true;
  }

  submitAddWebhook(): void {
    if (!this.newWebhookUrl.trim()) {
      alert('Please enter a target Webhook URL.');
      return;
    }

    const events = Object.keys(this.selectedEvents).filter(e => this.selectedEvents[e]);
    if (events.length === 0) {
      alert('Please select at least one trigger event.');
      return;
    }

    this.crmService.createWebhookSubscription({
      url: this.newWebhookUrl.trim(),
      events,
      description: this.newWebhookDescription.trim()
    }).subscribe({
      next: () => {
        this.showAddWebhookModal = false;
        this.showToast('Webhook endpoint registered successfully.');
        this.loadWebhookSubscriptions();
      },
      error: (err) => {
        alert(err.error?.message || 'Failed to register webhook.');
      }
    });
  }

  toggleSecret(id: string): void {
    this.revealedSecrets[id] = !this.revealedSecrets[id];
  }

  copySecret(secret: string): void {
    navigator.clipboard.writeText(secret);
    this.showToast('Signing secret copied to clipboard.');
  }

  toggleWebhookActive(sub: WebhookSubscriptionItem): void {
    this.crmService.toggleWebhookSubscription(sub.id, !sub.is_active).subscribe(() => {
      sub.is_active = !sub.is_active;
      this.showToast(`Webhook endpoint ${sub.is_active ? 'activated' : 'paused'}.`);
    });
  }

  deleteWebhook(sub: WebhookSubscriptionItem): void {
    if (confirm(`Delete webhook endpoint ${sub.url}?`)) {
      this.crmService.deleteWebhookSubscription(sub.id).subscribe(() => {
        this.showToast('Webhook endpoint deleted.');
        this.loadWebhookSubscriptions();
      });
    }
  }

  triggerTestWebhook(eventName: string = 'lead.created'): void {
    this.crmService.triggerTestWebhook(eventName).subscribe({
      next: (res) => {
        this.showToast(res.message || 'Test webhook event dispatched.');
        setTimeout(() => this.loadDeliveries(), 1000);
      },
      error: () => {
        alert('Failed to dispatch test webhook.');
      }
    });
  }

  // =========================================================================
  // WEBHOOK DELIVERIES & RESEND
  // =========================================================================

  loadDeliveries(): void {
    this.crmService.getWebhookDeliveries(this.deliveryStatusFilter, this.deliveryEventFilter).subscribe(deliveries => {
      this.deliveries = deliveries;
    });
  }

  resendDelivery(delivery: WebhookDeliveryItem): void {
    this.resendingDeliveryId = delivery.id;
    this.crmService.resendWebhookDelivery(delivery.id).subscribe({
      next: () => {
        this.resendingDeliveryId = null;
        this.showToast('Webhook redelivery executed.');
        this.loadDeliveries();
      },
      error: (err) => {
        this.resendingDeliveryId = null;
        alert(err.error?.message || 'Failed to resend delivery.');
      }
    });
  }

  viewPayload(delivery: WebhookDeliveryItem): void {
    this.selectedPayloadForModal = delivery;
    this.showPayloadModal = true;
  }

  showToast(msg: string, type: 'success' | 'danger' | 'info' = 'success'): void {
    this.toastMessage = msg;
    this.toastType = type;
    setTimeout(() => {
      this.toastMessage = '';
    }, 4000);
  }
}
