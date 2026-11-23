const EventEmitter = require('events');

class ScoringQueue extends EventEmitter {
  constructor() {
    super();
    this.queue = [];
    this.queuedIds = new Set();
    this.isProcessing = false;
    this.totalProcessed = 0;
    this.concurrency = 5;
  }

  /**
   * Enqueue a single lead for asynchronous scoring
   */
  enqueue(tenantId, leadId, config = null) {
    if (!tenantId || !leadId) return;

    const jobKey = `${tenantId}::${leadId}`;
    if (this.queuedIds.has(jobKey)) {
      // Already queued for next tick
      return;
    }

    this.queuedIds.add(jobKey);
    this.queue.push({ tenantId, leadId, config, jobKey, enqueuedAt: Date.now() });

    // Trigger processing asynchronously without blocking caller
    setImmediate(() => {
      this.processNext();
    });
  }

  /**
   * Enqueue a batch of leads
   */
  enqueueBatch(tenantId, leadIds, config = null) {
    if (!tenantId || !Array.isArray(leadIds)) return;
    for (const leadId of leadIds) {
      this.enqueue(tenantId, leadId, config);
    }
  }

  /**
   * Worker loop: drain the queue in concurrent batches
   */
  async processNext() {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;
    const scoringService = require('./scoringService');

    try {
      while (this.queue.length > 0) {
        // Take a chunk up to concurrency limit
        const batch = this.queue.splice(0, this.concurrency);

        await Promise.all(
          batch.map(async (job) => {
            this.queuedIds.delete(job.jobKey);
            try {
              await scoringService.computeAndSaveLeadScore(job.tenantId, job.leadId, job.config);
              this.totalProcessed++;
            } catch (err) {
              console.error(`[ScoringQueue] Error computing score for lead [${job.leadId}]:`, err.message);
            }
          })
        );

        // Small yield to event loop
        if (this.queue.length > 0) {
          await new Promise(resolve => setTimeout(resolve, 20));
        }
      }
    } catch (err) {
      console.error('[ScoringQueue] Unexpected queue processing error:', err.message);
    } finally {
      this.isProcessing = false;
      if (this.queue.length > 0) {
        setImmediate(() => this.processNext());
      }
    }
  }

  getStats() {
    return {
      pending: this.queue.length,
      isProcessing: this.isProcessing,
      totalProcessed: this.totalProcessed
    };
  }

  getStatus() {
    return {
      pending_count: this.queue.length,
      in_flight: this.isProcessing ? 1 : 0,
      processed_total: this.totalProcessed
    };
  }
}

module.exports = new ScoringQueue();
