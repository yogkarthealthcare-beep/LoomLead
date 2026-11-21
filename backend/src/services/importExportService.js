const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const mammoth = require('mammoth');
const csv = require('csv-parser');
const fs = require('fs');
const db = require('../config/db');

/**
 * Service for Multi-Format Data Import (Excel, CSV, Word, PDF)
 * and Export (Excel, PDF)
 */
class ImportExportService {
  /**
   * Parse CSV File
   */
  async parseCSV(filePath) {
    return new Promise((resolve, reject) => {
      const results = [];
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', () => resolve(results))
        .on('error', (err) => reject(err));
    });
  }

  /**
   * Parse Excel File (.xlsx)
   */
  async parseExcel(filePath) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const worksheet = workbook.worksheets[0];
    const rows = [];
    const headers = [];

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) {
        row.eachCell((cell) => headers.push(cell.text.trim()));
      } else {
        const rowData = {};
        row.eachCell((cell, colNumber) => {
          const header = headers[colNumber - 1] || `col_${colNumber}`;
          rowData[header] = cell.text;
        });
        rows.push(rowData);
      }
    });

    return rows;
  }

  /**
   * Extract text and contact details from Word (.docx) files
   */
  async parseWord(filePath) {
    const result = await mammoth.extractRawText({ path: filePath });
    const text = result.value;
    const lines = text.split('\n').filter((l) => l.trim().length > 0);

    const leads = [];
    // Heuristic: identify phone numbers and emails in docx text
    const phoneRegex = /(\+?\d{1,4}[-.\s]?)?(\(?\d{3}\)?[-.\s]?)?[\d]{3}[-.\s]?[\d]{4}/g;
    const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi;

    lines.forEach((line) => {
      const phones = line.match(phoneRegex);
      const emails = line.match(emailRegex);
      if (phones || emails) {
        leads.push({
          name: line.substring(0, 30).trim(),
          phone: phones ? phones[0].trim() : '',
          email: emails ? emails[0].trim() : '',
          raw_line: line,
        });
      }
    });

    return leads;
  }

  /**
   * Export Leads to Excel (.xlsx) buffer
   */
  async exportLeadsToExcel(tenantId, leads) {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('LoomLead Contacts');

    sheet.columns = [
      { header: 'ID', key: 'id', width: 36 },
      { header: 'Name', key: 'name', width: 25 },
      { header: 'Phone', key: 'phone', width: 18 },
      { header: 'Email', key: 'email', width: 25 },
      { header: 'Company', key: 'company_name', width: 25 },
      { header: 'Source', key: 'source', width: 18 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Score', key: 'score', width: 12 },
      { header: 'Budget Value', key: 'budget_value', width: 15 },
      { header: 'Created Date', key: 'created_at', width: 20 },
    ];

    // Style Header Row
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E40AF' }, // Blue
    };

    leads.forEach((l) => sheet.addRow(l));
    return await workbook.xlsx.writeBuffer();
  }

  /**
   * Export Leads to PDF report buffer
   */
  async exportLeadsToPDF(tenantId, companyName, leads) {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const buffers = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      // Header
      doc.fontSize(20).fillColor('#1E3A8A').text('LoomLead CRM - Contacts Report', { align: 'center' });
      doc.fontSize(12).fillColor('#64748B').text(`Company: ${companyName || 'Apex Realty Group'} | Generated: ${new Date().toLocaleDateString()}`, { align: 'center' });
      doc.moveDown(2);

      // Table Header
      doc.fontSize(10).fillColor('#000000').font('Helvetica-Bold');
      doc.text('Name', 40, doc.y, { width: 120 });
      doc.text('Phone', 160, doc.y, { width: 100 });
      doc.text('Company', 270, doc.y, { width: 120 });
      doc.text('Score', 400, doc.y, { width: 60 });
      doc.text('Status', 470, doc.y, { width: 70 });
      doc.moveDown();

      doc.moveTo(40, doc.y).lineTo(550, doc.y).strokeColor('#CBD5E1').stroke();
      doc.moveDown(0.5);

      // Table Rows
      doc.font('Helvetica');
      leads.slice(0, 35).forEach((lead) => {
        const y = doc.y;
        if (y > 750) {
          doc.addPage();
        }
        doc.text(lead.name || 'N/A', 40, doc.y, { width: 120 });
        doc.text(lead.phone || 'N/A', 160, y, { width: 100 });
        doc.text(lead.company_name || '-', 270, y, { width: 120 });
        doc.text(lead.score || 'Warm', 400, y, { width: 60 });
        doc.text(lead.status || 'New', 470, y, { width: 70 });
        doc.moveDown(0.8);
      });

      doc.end();
    });
  }
}

module.exports = new ImportExportService();
