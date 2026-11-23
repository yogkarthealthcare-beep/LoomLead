/**
 * LoomLead CRM - One-Time Duplicate Lead Merge Script
 *
 * Scans existing leads for duplicate phone numbers (E.164) and domains,
 * merges enrichment data into the canonical (earliest) lead record,
 * appends distinct acquisition sources, updates last_seen_at, and soft-deletes duplicates.
 *
 * Usage:
 *   Dry-run mode (Default, safe - prints what would be merged without writing):
 *     node scripts/mergeDuplicates.js --dry-run
 *
 *   Live execution mode (Executes merges and updates in PostgreSQL):
 *     node scripts/mergeDuplicates.js --execute
 */

require('dotenv').config();
const db = require('../src/config/db');
const hygieneService = require('../src/services/hygieneService');

const isExecute = process.argv.includes('--execute');
const isDryRun = !isExecute;

async function runMergeDuplicates() {
  console.log('=====================================================');
  console.log(`🧹 LoomLead Lead Deduplication & Merge Utility`);
  console.log(`Mode: ${isDryRun ? '🔍 DRY RUN (Simulated, no changes applied)' : '⚡ LIVE EXECUTION (Writing to database)'}`);
  console.log('=====================================================\n');

  try {
    // 1. Fetch all active leads
    const leadsRes = await db.query(
      `SELECT id, tenant_id, name, phone, email, company_name, address, city,
              category, source, sources, budget_value, notes, normalized_phone,
              normalized_domain, last_seen_at, created_at, updated_at
       FROM leads
       WHERE is_deleted = FALSE
       ORDER BY tenant_id, created_at ASC, id ASC`
    );

    const leads = leadsRes.rows;
    console.log(`📊 Total active leads loaded from database: ${leads.length}`);

    if (leads.length === 0) {
      console.log('No leads found to process.');
      process.exit(0);
    }

    // 2. Ensure all leads have normalized_phone and normalized_domain
    let backfilledCount = 0;
    for (const lead of leads) {
      const nPhone = hygieneService.normalizePhone(lead.phone);
      const emailDomain = lead.email && lead.email.includes('@') ? lead.email.split('@')[1] : null;
      const genericDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com'];
      const rawDomain = !genericDomains.includes(emailDomain?.toLowerCase()) ? emailDomain : null;
      const nDomain = hygieneService.normalizeDomain(rawDomain);

      let needsUpdate = false;
      if (lead.normalized_phone !== nPhone) {
        lead.normalized_phone = nPhone;
        needsUpdate = true;
      }
      if (lead.normalized_domain !== nDomain) {
        lead.normalized_domain = nDomain;
        needsUpdate = true;
      }

      if (needsUpdate) {
        backfilledCount++;
        if (isExecute) {
          await db.query(
            `UPDATE leads SET normalized_phone = $1, normalized_domain = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
            [nPhone, nDomain, lead.id]
          );
        }
      }
    }

    console.log(`🔧 Normalization check complete: ${backfilledCount} leads updated with normalized phone/domain.\n`);

    // 3. Find duplicate groups by (tenant_id, normalized_phone)
    const phoneGroups = new Map();
    for (const lead of leads) {
      if (!lead.normalized_phone) continue;
      const key = `${lead.tenant_id}::phone::${lead.normalized_phone}`;
      if (!phoneGroups.has(key)) phoneGroups.set(key, []);
      phoneGroups.get(key).push(lead);
    }

    // 4. Find duplicate groups by (tenant_id, normalized_domain)
    const domainGroups = new Map();
    for (const lead of leads) {
      if (!lead.normalized_domain) continue;
      const key = `${lead.tenant_id}::domain::${lead.normalized_domain}`;
      if (!domainGroups.has(key)) domainGroups.set(key, []);
      domainGroups.get(key).push(lead);
    }

    // Collect distinct duplicate clusters
    const duplicateClusters = [];
    const processedLeadIds = new Set();

    for (const [key, group] of phoneGroups.entries()) {
      if (group.length > 1) {
        duplicateClusters.push({ type: 'phone', key, leads: group });
        group.forEach(l => processedLeadIds.add(l.id));
      }
    }

    for (const [key, group] of domainGroups.entries()) {
      if (group.length > 1) {
        // Only add if not already fully merged in phone cluster
        const unhandled = group.filter(l => !processedLeadIds.has(l.id));
        if (group.length > 1 && unhandled.length > 0) {
          duplicateClusters.push({ type: 'domain', key, leads: group });
          group.forEach(l => processedLeadIds.add(l.id));
        }
      }
    }

    console.log(`🔎 Total duplicate clusters identified: ${duplicateClusters.length}\n`);

    if (duplicateClusters.length === 0) {
      console.log('✅ No duplicate leads found! All records are unique.');
      process.exit(0);
    }

    // 5. Merge duplicates
    let totalMergedLeads = 0;
    for (let i = 0; i < duplicateClusters.length; i++) {
      const cluster = duplicateClusters[i];
      // Sort to guarantee primary is the oldest created record
      const sorted = [...cluster.leads].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      const primary = sorted[0];
      const duplicates = sorted.slice(1);

      console.log(`Cluster #${i + 1} (${cluster.type.toUpperCase()}: ${cluster.key}):`);
      console.log(`  🌟 Primary Lead: [${primary.id}] "${primary.name}" | Phone: ${primary.phone} | Company: ${primary.company_name || 'N/A'}`);

      // Sources collection
      const combinedSources = new Set(Array.isArray(primary.sources) ? primary.sources : []);
      if (primary.source) combinedSources.add(primary.source);

      // Latest timestamp calculation
      let latestTime = new Date(primary.last_seen_at || primary.updated_at || primary.created_at || Date.now());

      // Fields to enrich if primary is empty
      const enrichedFields = {
        name: primary.name,
        company_name: primary.company_name,
        email: primary.email,
        address: primary.address,
        city: primary.city,
        category: primary.category,
        budget_value: primary.budget_value || 0
      };

      for (const dup of duplicates) {
        console.log(`  🔗 Duplicate Lead: [${dup.id}] "${dup.name}" | Phone: ${dup.phone} | Company: ${dup.company_name || 'N/A'}`);

        // Enrich empty fields
        if ((!enrichedFields.name || enrichedFields.name === 'Unknown') && dup.name && dup.name !== 'Unknown') {
          enrichedFields.name = dup.name;
        }
        if (!enrichedFields.company_name && dup.company_name) enrichedFields.company_name = dup.company_name;
        if (!enrichedFields.email && dup.email) enrichedFields.email = dup.email;
        if (!enrichedFields.address && dup.address) enrichedFields.address = dup.address;
        if (!enrichedFields.city && dup.city) enrichedFields.city = dup.city;
        if (!enrichedFields.category && dup.category) enrichedFields.category = dup.category;
        if ((!enrichedFields.budget_value || enrichedFields.budget_value == 0) && dup.budget_value) {
          enrichedFields.budget_value = dup.budget_value;
        }

        // Add sources
        if (dup.source) combinedSources.add(dup.source);
        if (Array.isArray(dup.sources)) {
          dup.sources.forEach(s => combinedSources.add(s));
        }

        // Compare last seen
        const dupTime = new Date(dup.last_seen_at || dup.updated_at || dup.created_at || 0);
        if (dupTime > latestTime) {
          latestTime = dupTime;
        }

        totalMergedLeads++;
      }

      const finalSourcesArray = Array.from(combinedSources);

      if (isExecute) {
        // 1. Update primary lead
        await db.query(
          `UPDATE leads
           SET name = COALESCE($1, name),
               company_name = COALESCE($2, company_name),
               email = COALESCE($3, email),
               address = COALESCE($4, address),
               city = COALESCE($5, city),
               category = COALESCE($6, category),
               budget_value = GREATEST(budget_value, $7),
               sources = $8,
               last_seen_at = $9,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $10`,
          [
            enrichedFields.name,
            enrichedFields.company_name,
            enrichedFields.email,
            enrichedFields.address,
            enrichedFields.city,
            enrichedFields.category,
            enrichedFields.budget_value,
            finalSourcesArray,
            latestTime,
            primary.id
          ]
        );

        // 2. Soft-delete duplicate leads
        const duplicateIds = duplicates.map(d => d.id);
        await db.query(
          `UPDATE leads
           SET is_deleted = TRUE,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ANY($1::uuid[])`,
          [duplicateIds]
        );

        console.log(`  ✅ Successfully merged into Primary [${primary.id}] and marked ${duplicateIds.length} duplicate(s) as deleted.`);
      } else {
        console.log(`  [DRY-RUN] Would enrich primary with sources: [${finalSourcesArray.join(', ')}], latest seen: ${latestTime.toISOString()}`);
        console.log(`  [DRY-RUN] Would soft-delete ${duplicates.length} duplicate lead(s).`);
      }
      console.log('');
    }

    console.log('=====================================================');
    console.log(`🎉 SUMMARY`);
    console.log(`Total duplicate clusters: ${duplicateClusters.length}`);
    console.log(`Total redundant duplicate leads merged: ${totalMergedLeads}`);
    if (isDryRun) {
      console.log(`\n💡 To execute this merge against the live database, run:`);
      console.log(`   node scripts/mergeDuplicates.js --execute`);
    } else {
      console.log(`\n✅ Database updated successfully.`);
    }
    console.log('=====================================================');

  } catch (err) {
    console.error('❌ Error during duplicate merge script:', err);
  } finally {
    await db.pool.end();
  }
}

runMergeDuplicates();
