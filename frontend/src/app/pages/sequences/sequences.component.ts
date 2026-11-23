import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import {
  CrmService,
  Sequence,
  SequenceStep,
  SequenceSender,
  EnrollmentItem,
  SequenceLogItem,
  Lead
} from '../../services/crm.service';

@Component({
  selector: 'app-sequences',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './sequences.component.html'
})
export class SequencesComponent implements OnInit {
  sequences: Sequence[] = [];
  selectedSequence: Sequence | null = null;
  isLoading: boolean = false;
  activeTab: 'builder' | 'enrollments' | 'logs' = 'builder';

  // Enrollments & Logs for selected sequence
  enrollments: EnrollmentItem[] = [];
  messageLogs: SequenceLogItem[] = [];

  // Sender Accounts
  senders: SequenceSender[] = [];
  showSendersModal: boolean = false;
  newSender: { email: string; display_name: string; daily_cap: number } = {
    email: '',
    display_name: '',
    daily_cap: 50
  };

  // Create / Edit Sequence Modal
  showSequenceModal: boolean = false;
  isEditingSequence: boolean = false;
  sequenceForm: Partial<Sequence> = {
    name: '',
    daily_limit: 100,
    send_window_start: '09:00',
    send_window_end: '18:00',
    timezone: 'Asia/Kolkata',
    status: 'active'
  };

  // Add / Edit Step Modal
  showStepModal: boolean = false;
  isEditingStep: boolean = false;
  stepForm: SequenceStep = {
    step_order: 1,
    day_offset: 1,
    minute_offset: null,
    channel: 'email',
    subject: '',
    body_content: ''
  };

  // Enroll Leads Modal
  showEnrollModal: boolean = false;
  availableLeads: Lead[] = [];
  selectedLeadIds: Set<string> = new Set();
  enrollImmediate: boolean = true;

  // Toast
  toastMessage: string = '';
  toastType: 'success' | 'danger' = 'success';

  constructor(private crmService: CrmService) {}

  ngOnInit(): void {
    this.loadSequences();
    this.loadSenders();
  }

  loadSequences(): void {
    this.isLoading = true;
    this.crmService.getSequences().subscribe({
      next: (list) => {
        this.sequences = list;
        if (list.length > 0 && !this.selectedSequence) {
          this.selectSequence(list[0]);
        } else if (this.selectedSequence) {
          // Refresh selected sequence
          const found = list.find(s => s.id === this.selectedSequence?.id);
          if (found) this.selectSequence(found);
        }
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      }
    });
  }

  selectSequence(seq: Sequence): void {
    this.crmService.getSequence(seq.id).subscribe({
      next: (fullSeq) => {
        if (fullSeq) {
          this.selectedSequence = fullSeq;
          if (this.activeTab === 'enrollments') {
            this.loadEnrollments();
          } else if (this.activeTab === 'logs') {
            this.loadLogs();
          }
        }
      }
    });
  }

  loadSenders(): void {
    this.crmService.getSequenceSenders().subscribe({
      next: (data) => this.senders = data
    });
  }

  loadEnrollments(): void {
    if (!this.selectedSequence) return;
    this.crmService.getSequenceEnrollments(this.selectedSequence.id).subscribe({
      next: (items) => this.enrollments = items
    });
  }

  loadLogs(): void {
    if (!this.selectedSequence) return;
    this.crmService.getSequenceLogs(this.selectedSequence.id).subscribe({
      next: (items) => this.messageLogs = items
    });
  }

  setTab(tab: 'builder' | 'enrollments' | 'logs'): void {
    this.activeTab = tab;
    if (tab === 'enrollments') this.loadEnrollments();
    if (tab === 'logs') this.loadLogs();
  }

  // Sequence CRUD Modal
  openCreateSequenceModal(): void {
    this.isEditingSequence = false;
    this.sequenceForm = {
      name: '',
      daily_limit: 100,
      send_window_start: '09:00',
      send_window_end: '18:00',
      timezone: 'Asia/Kolkata',
      status: 'active'
    };
    this.showSequenceModal = true;
  }

  openEditSequenceModal(): void {
    if (!this.selectedSequence) return;
    this.isEditingSequence = true;
    this.sequenceForm = {
      name: this.selectedSequence.name,
      daily_limit: this.selectedSequence.daily_limit,
      send_window_start: this.selectedSequence.send_window_start,
      send_window_end: this.selectedSequence.send_window_end,
      timezone: this.selectedSequence.timezone,
      status: this.selectedSequence.status
    };
    this.showSequenceModal = true;
  }

  saveSequence(): void {
    if (!this.sequenceForm.name?.trim()) {
      this.showToast('Please enter a sequence name.', 'danger');
      return;
    }

    if (this.isEditingSequence && this.selectedSequence) {
      this.crmService.updateSequence(this.selectedSequence.id, this.sequenceForm).subscribe({
        next: (updated) => {
          this.showSequenceModal = false;
          this.showToast('Sequence updated successfully.', 'success');
          this.loadSequences();
        },
        error: (err) => this.showToast(err.error?.message || 'Update failed', 'danger')
      });
    } else {
      this.crmService.createSequence(this.sequenceForm).subscribe({
        next: (created) => {
          this.showSequenceModal = false;
          this.showToast(`Sequence "${created.name}" created successfully.`, 'success');
          this.loadSequences();
        },
        error: (err) => this.showToast(err.error?.message || 'Creation failed', 'danger')
      });
    }
  }

  deleteCurrentSequence(): void {
    if (!this.selectedSequence) return;
    if (confirm(`Are you sure you want to delete sequence "${this.selectedSequence.name}"? All steps and enrollments will be removed.`)) {
      this.crmService.deleteSequence(this.selectedSequence.id).subscribe({
        next: () => {
          this.showToast('Sequence deleted.', 'success');
          this.selectedSequence = null;
          this.loadSequences();
        }
      });
    }
  }

  // Step Management
  openAddStepModal(): void {
    const nextOrder = (this.selectedSequence?.steps?.length || 0) + 1;
    const defaultDay = nextOrder === 1 ? 1 : (nextOrder === 2 ? 3 : 5);
    this.isEditingStep = false;
    this.stepForm = {
      step_order: nextOrder,
      day_offset: defaultDay,
      minute_offset: null,
      channel: 'email',
      subject: `Follow-up regarding {{company}}`,
      body_content: `Hi {{name}},\n\n{{icebreaker}}\n\nWould you be open to a 5-minute chat this week?\n\nBest regards,\nLoomLead Team`
    };
    this.showStepModal = true;
  }

  openEditStepModal(step: SequenceStep): void {
    this.isEditingStep = true;
    this.stepForm = { ...step };
    this.showStepModal = true;
  }

  saveStep(): void {
    if (!this.selectedSequence) return;
    if (!this.stepForm.body_content.trim()) {
      this.showToast('Step message content is required.', 'danger');
      return;
    }

    if (this.isEditingStep && this.stepForm.id) {
      this.crmService.updateSequenceStep(this.selectedSequence.id, this.stepForm.id, this.stepForm).subscribe({
        next: () => {
          this.showStepModal = false;
          this.showToast('Sequence step updated.', 'success');
          this.selectSequence(this.selectedSequence!);
        }
      });
    } else {
      this.crmService.addSequenceStep(this.selectedSequence.id, this.stepForm).subscribe({
        next: () => {
          this.showStepModal = false;
          this.showToast('Step added to sequence.', 'success');
          this.selectSequence(this.selectedSequence!);
        }
      });
    }
  }

  deleteStep(stepId?: string): void {
    if (!this.selectedSequence || !stepId) return;
    if (confirm('Delete this step from sequence?')) {
      this.crmService.deleteSequenceStep(this.selectedSequence.id, stepId).subscribe({
        next: () => {
          this.showToast('Step removed.', 'success');
          this.selectSequence(this.selectedSequence!);
        }
      });
    }
  }

  insertVariable(varTag: string): void {
    this.stepForm.body_content += ` {{${varTag}}}`;
  }

  // Senders Modal
  addSenderAccount(): void {
    if (!this.newSender.email.trim()) {
      this.showToast('Enter valid sender email address.', 'danger');
      return;
    }
    this.crmService.addSequenceSender(this.newSender).subscribe({
      next: (sender) => {
        this.senders.push(sender);
        this.newSender = { email: '', display_name: '', daily_cap: 50 };
        this.showToast('Sender account added for rotation.', 'success');
      }
    });
  }

  removeSenderAccount(id: string): void {
    if (confirm('Remove sender account?')) {
      this.crmService.deleteSequenceSender(id).subscribe({
        next: () => {
          this.senders = this.senders.filter(s => s.id !== id);
          this.showToast('Sender removed.', 'success');
        }
      });
    }
  }

  // Enroll Leads
  openEnrollLeadsModal(): void {
    if (!this.selectedSequence) return;
    this.crmService.getLeads().subscribe({
      next: (leads) => {
        this.availableLeads = leads;
        this.selectedLeadIds.clear();
        this.showEnrollModal = true;
      }
    });
  }

  toggleLeadSelection(leadId: string): void {
    if (this.selectedLeadIds.has(leadId)) {
      this.selectedLeadIds.delete(leadId);
    } else {
      this.selectedLeadIds.add(leadId);
    }
  }

  toggleSelectAllLeads(event: any): void {
    if (event.target.checked) {
      this.availableLeads.forEach(l => this.selectedLeadIds.add(l.id));
    } else {
      this.selectedLeadIds.clear();
    }
  }

  submitEnrollment(): void {
    if (!this.selectedSequence) return;
    if (this.selectedLeadIds.size === 0) {
      this.showToast('Select at least one lead to enroll.', 'danger');
      return;
    }

    const leadIds = Array.from(this.selectedLeadIds);
    this.crmService.enrollInSequence(this.selectedSequence.id, {
      lead_ids: leadIds,
      immediate: this.enrollImmediate
    }).subscribe({
      next: (res) => {
        this.showEnrollModal = false;
        this.showToast(res.message || `Enrolled ${res.enrolledCount} leads.`, 'success');
        this.selectSequence(this.selectedSequence!);
        if (this.activeTab === 'enrollments') this.loadEnrollments();
      },
      error: (err) => this.showToast(err.error?.message || 'Enrollment failed', 'danger')
    });
  }

  // Trigger Worker Run Now
  triggerWorkerNow(): void {
    this.isLoading = true;
    this.crmService.triggerSequenceWorker().subscribe({
      next: (res) => {
        this.isLoading = false;
        const summary = res.summary || {};
        this.showToast(`Worker processed: ${summary.processed || 0} enrollments, ${summary.sent || 0} sent, ${summary.completed || 0} completed.`, 'success');
        if (this.selectedSequence) this.selectSequence(this.selectedSequence);
      },
      error: () => {
        this.isLoading = false;
        this.showToast('Worker execution failed.', 'danger');
      }
    });
  }

  showToast(message: string, type: 'success' | 'danger' = 'success'): void {
    this.toastMessage = message;
    this.toastType = type;
    setTimeout(() => {
      this.toastMessage = '';
    }, 4500);
  }
}
