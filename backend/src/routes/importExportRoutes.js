const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
const importExportService = require('../services/importExportService');
const hygieneService = require('../services/hygieneService');
const db = require('../config/db');
const { authenticateToken } = require('../middleware/authMiddleware');
const { checkPlanLimit } = require('../middleware/planGatingMiddleware');

// Import leads from CSV / Excel / Word
router.post('/import', authenticateToken, checkPlanLimit('import_export'), upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'File is required for upload.' });
  }

  try {
    let rows = [];
    const originalName = req.file.originalname.toLowerCase();

    if (originalName.endsWith('.csv')) {
      rows = await importExportService.parseCSV(req.file.path);
    } else if (originalName.endsWith('.xlsx') || originalName.endsWith('.xls')) {
      rows = await importExportService.parseExcel(req.file.path);
    } else if (originalName.endsWith('.docx')) {
      rows = await importExportService.parseWord(req.file.path);
    } else {
      return res.status(400).json({ success: false, message: 'Unsupported file format. Please upload CSV, Excel (.xlsx), or Word (.docx).' });
    }

    res.json({
      success: true,
      total_rows: rows.length,
      preview: rows.slice(0, 10),
      detected_columns: rows.length > 0 ? Object.keys(rows[0]) : [],
    });
  } catch (err) {
    console.error('File import parsing error:', err);
    res.status(500).json({ success: false, message: `Import error: ${err.message}` });
  }
});

// Commit and save parsed rows into database with Deduplication & Normalization
router.post('/import/commit', authenticateToken, checkPlanLimit('import_export'), async (req, res) => {
  const { leads, stage_id } = req.body;
  if (!Array.isArray(leads) || leads.length === 0) {
    return res.status(400).json({ success: false, message: 'Leads array is required.' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    let createdCount = 0;
    let mergedCount = 0;

    for (const item of leads) {
      if (!item.name && !item.phone && !item.FullName && !item.Mobile) continue;

      const leadData = {
        name: item.name || item.FullName || item.ClientName || 'New Lead',
        phone: item.phone || item.Phone || item.Mobile || item.Contact || '',
        email: item.email || item.Email || null,
        company_name: item.company_name || item.Company || item.Business || item.name,
        category: item.category || item.Category || 'Business & Commercial',
        address: item.address || item.Address || null,
        city: item.city || item.City || 'India',
        source: item.source || 'File Import',
        status: item.status || 'New',
        score: item.score || 'Warm',
        budget_value: parseFloat(item.budget_value || item.BudgetValue || 0) || 0,
        notes: item.notes || item.Notes || null,
        website: item.website || item.Website || null
      };

      const result = await hygieneService.upsertLead(client, req.tenantId, leadData, stage_id, req.user.id);
      if (result.merged) {
        mergedCount++;
      } else {
        createdCount++;
      }
    }

    await client.query('COMMIT');
    res.json({
      success: true,
      total_processed: leads.length,
      created: createdCount,
      merged: mergedCount,
      message: `Import complete: ${createdCount} new leads created, ${mergedCount} duplicates merged and enriched.`
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Import commit error:', err);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
});

// Export Leads to Excel
router.get('/export/excel', authenticateToken, checkPlanLimit('import_export'), async (req, res) => {
  try {
    const leadsRes = await db.query(
      `SELECT id, name, phone, email, company_name, source, status, score, budget_value, TO_CHAR(created_at, 'YYYY-MM-DD') as created_at
       FROM leads WHERE tenant_id = $1 AND is_deleted = FALSE ORDER BY created_at DESC`,
      [req.tenantId]
    );

    const buffer = await importExportService.exportLeadsToExcel(req.tenantId, leadsRes.rows);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=loomlead_contacts.xlsx');
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Export Leads to PDF
router.get('/export/pdf', authenticateToken, checkPlanLimit('import_export'), async (req, res) => {
  try {
    const leadsRes = await db.query(
      `SELECT name, phone, company_name, score, status FROM leads WHERE tenant_id = $1 AND is_deleted = FALSE ORDER BY created_at DESC`,
      [req.tenantId]
    );

    const tenantRes = await db.query(`SELECT company_name FROM tenants WHERE id = $1`, [req.tenantId]);
    const companyName = tenantRes.rows[0]?.company_name || 'Apex Realty Group';

    const pdfBuffer = await importExportService.exportLeadsToPDF(req.tenantId, companyName, leadsRes.rows);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=loomlead_contacts.pdf');
    res.send(pdfBuffer);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
