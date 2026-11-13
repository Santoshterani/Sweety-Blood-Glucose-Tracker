const PDFDocument = require('pdfkit');

const TEAL = '#0B6E64';
const ORANGE = '#C2570C';
const INDIGO = '#5B4FD0';
const INK = '#14211F';
const MUTED = '#55645F';
const LINE = '#CBD5D1';
const TINT = '#E3F3F0';
const PANEL = '#F7FAF9';

const TITLES = {
  daily: 'Daily report',
  weekly: 'Weekly report',
  monthly: 'Monthly report',
  yearly: 'Yearly report',
  'month-to-date': 'Month-to-date report',
  custom: 'Custom range report',
};

const CHART_TITLES = { slot: 'Each reading', day: 'Average per day', week: 'Average per week', month: 'Average per month' };
const FIRST_COLUMN = { slot: 'Time slot', day: 'Day', week: 'Week', month: 'Month' };

const fmtDate = (dateStr) =>
  new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${dateStr}T00:00:00Z`)
  );

const periodText = (report) =>
  report.from === report.to ? fmtDate(report.from) : `${fmtDate(report.from)} – ${fmtDate(report.to)}`;

const dash = (v) => (v === null || v === undefined || v === '' ? '–' : String(v));

/**
 * Draws the report as an A4 PDF and resolves with a Buffer.
 * Everything comes from the same report object the API returns, so the PDF always matches the screen.
 */
function renderReportPdf({ profile, report, generatedOn }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 40,
      info: { Title: `Sweety ${TITLES[report.type]}`, Author: 'Sweety' },
    });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const left = 40;
    const width = doc.page.width - 80; // 515
    const bottomLimit = doc.page.height - 84;

    // ---------- header ----------
    doc.roundedRect(left, 40, 30, 30, 7).fill(TEAL);
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(18).text('S', left, 47, { width: 30, align: 'center' });
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(20).text('Sweety', left + 40, 40, { lineBreak: false });
    doc.fillColor(MUTED).font('Helvetica').fontSize(10).text('Blood glucose report', left + 40, 62, { lineBreak: false });

    doc.fillColor(INK).font('Helvetica-Bold').fontSize(15).text(TITLES[report.type], left, 42, { width, align: 'right' });
    doc.fillColor(MUTED).font('Helvetica').fontSize(10.5).text(periodText(report), left, 62, { width, align: 'right' });
    doc.moveTo(left, 84).lineTo(left + width, 84).lineWidth(2).strokeColor(TEAL).stroke();

    // ---------- patient details ----------
    let y = 98;
    const sexAge = [profile.age !== null ? `${profile.age} years` : null, profile.sex].filter(Boolean).join(' / ');
    const details = [
      ['Patient', profile.name],
      ['Age / sex', sexAge],
      ['Diabetes type', profile.diabetesType],
      ['Doctor', profile.doctorName],
      ['Target range', `${profile.targetLow} – ${profile.targetHigh} mg/dl`],
      ['Medication', profile.medication],
    ];
    doc.roundedRect(left, y, width, 82, 8).fill(PANEL);
    details.forEach(([label, value], i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = left + 14 + col * (width / 2);
      const rowY = y + 12 + row * 22;
      doc.fillColor(MUTED).font('Helvetica').fontSize(9.5).text(label, x, rowY, { width: 78, lineBreak: false });
      doc.fillColor(INK).font('Helvetica-Bold').fontSize(10.5).text(dash(value), x + 80, rowY - 1, { width: width / 2 - 100, ellipsis: true, lineBreak: false });
    });
    y += 98;

    // ---------- summary ----------
    const stats = [
      ['Highest', report.highest, 'mg/dl'],
      ['Lowest', report.lowest, 'mg/dl'],
      ['Average', report.average === null ? null : report.average.toFixed(1), 'mg/dl'],
      ['Readings', report.count, ''],
    ];
    const boxW = (width - 3 * 12) / 4;
    stats.forEach(([label, value, unit], i) => {
      const x = left + i * (boxW + 12);
      doc.roundedRect(x, y, boxW, 58, 8).lineWidth(1).strokeColor(LINE).stroke();
      doc.fillColor(MUTED).font('Helvetica').fontSize(9.5).text(label, x + 12, y + 9, { lineBreak: false });
      doc.fillColor(INK).font('Helvetica-Bold').fontSize(21).text(dash(value), x + 12, y + 22, { lineBreak: false });
      if (unit) doc.fillColor(MUTED).font('Helvetica').fontSize(8.5).text(unit, x + 12, y + 46, { lineBreak: false });
    });
    y += 76;

    // ---------- empty state ----------
    if (report.count === 0) {
      doc.roundedRect(left, y, width, 90, 8).dash(4, { space: 3 }).lineWidth(1).strokeColor(MUTED).stroke().undash();
      doc.fillColor(INK).font('Helvetica-Bold').fontSize(13).text('No readings in this period', left, y + 30, { width, align: 'center' });
      doc.fillColor(MUTED).font('Helvetica').fontSize(10).text('Log a reading, or pick a different range, to fill this report.', left, y + 50, { width, align: 'center' });
      drawFooter(doc, generatedOn);
      doc.end();
      return;
    }

    // ---------- chart ----------
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(12).text(CHART_TITLES[report.bucketBy], left, y);
    doc.fillColor(MUTED).font('Helvetica').fontSize(8.5).text(`Shaded band = target range ${profile.targetLow}–${profile.targetHigh} mg/dl`, left, y + 3, { width, align: 'right' });
    y += 20;

    const plotLeft = left + 30;
    const plotW = width - 30;
    const plotTop = y + 6;
    const plotH = 120;
    const tallest = Math.max(...report.buckets.map((b) => b.avg), profile.targetHigh);
    const vmax = Math.max(240, Math.ceil(tallest / 60) * 60);
    const yOf = (v) => plotTop + plotH - (v / vmax) * plotH;

    doc.rect(plotLeft, yOf(profile.targetHigh), plotW, yOf(profile.targetLow) - yOf(profile.targetHigh)).fill(TINT);
    for (let v = 0; v <= vmax; v += vmax / 4) {
      doc.moveTo(plotLeft, yOf(v)).lineTo(plotLeft + plotW, yOf(v)).lineWidth(0.5).strokeColor(LINE).stroke();
      doc.fillColor(MUTED).font('Helvetica').fontSize(8).text(String(Math.round(v)), left, yOf(v) - 4, { width: 24, align: 'right', lineBreak: false });
    }

    const n = report.buckets.length;
    const slotW = plotW / n;
    const barW = Math.min(40, slotW * 0.62);
    const labelEvery = Math.max(1, Math.ceil(n / 14));
    report.buckets.forEach((b, i) => {
      const cx = plotLeft + slotW * i + slotW / 2;
      const top = yOf(b.avg);
      const color = b.avg > profile.targetHigh ? ORANGE : b.avg < profile.targetLow ? INDIGO : TEAL;
      doc.rect(cx - barW / 2, top, barW, plotTop + plotH - top).fill(color);
      if (n <= 12) {
        doc.fillColor(INK).font('Helvetica-Bold').fontSize(8.5).text(String(Math.round(b.avg)), cx - 20, top - 11, { width: 40, align: 'center', lineBreak: false });
      }
      if (i % labelEvery === 0) {
        doc.fillColor(MUTED).font('Helvetica').fontSize(8).text(b.label, cx - slotW / 2 - 4, plotTop + plotH + 5, { width: slotW + 8, align: 'center', lineBreak: false });
      }
    });
    y = plotTop + plotH + 28;

    // ---------- legend ----------
    [[TEAL, 'In range'], [ORANGE, 'Above range'], [INDIGO, 'Below range']].forEach(([color, text], i) => {
      const x = left + i * 100;
      doc.rect(x, y + 1, 9, 9).fill(color);
      doc.fillColor(MUTED).font('Helvetica').fontSize(8.5).text(text, x + 14, y + 1, { lineBreak: false });
    });
    y += 26;

    // ---------- table ----------
    const columns = [
      { title: FIRST_COLUMN[report.bucketBy], w: 215, get: (b) => b.name },
      { title: 'Readings', w: 75, get: (b) => b.count },
      { title: 'Lowest', w: 75, get: (b) => b.low },
      { title: 'Average', w: 75, get: (b) => b.avg.toFixed(1), bold: true },
      { title: 'Highest', w: 75, get: (b) => b.high },
    ];
    const rowH = 21;

    const drawHeader = () => {
      doc.rect(left, y, width, rowH).fill(TINT);
      let x = left;
      columns.forEach((c) => {
        doc.fillColor(INK).font('Helvetica-Bold').fontSize(9.5).text(c.title, x + 10, y + 6, { width: c.w - 14, lineBreak: false });
        x += c.w;
      });
      doc.moveTo(left, y + rowH).lineTo(left + width, y + rowH).lineWidth(1.2).strokeColor(TEAL).stroke();
      y += rowH;
    };

    doc.fillColor(INK).font('Helvetica-Bold').fontSize(12).text(
      { slot: 'Readings', day: 'Day by day', week: 'Week by week', month: 'Month by month' }[report.bucketBy],
      left,
      y
    );
    y += 20;
    drawHeader();

    report.buckets.forEach((b) => {
      if (y + rowH > bottomLimit) {
        doc.addPage();
        y = 40;
        drawHeader();
      }
      let x = left;
      columns.forEach((c) => {
        doc.fillColor(INK).font(c.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(10).text(String(c.get(b)), x + 10, y + 6, { width: c.w - 14, lineBreak: false, ellipsis: true });
        x += c.w;
      });
      doc.moveTo(left, y + rowH).lineTo(left + width, y + rowH).lineWidth(0.5).strokeColor(LINE).stroke();
      y += rowH;
    });

    const detailRows = report.bucketBy === 'slot' ? [] : report.buckets.flatMap((bucket) => bucket.readings || []);
    if (detailRows.length) {
      const detailRowH = 22;
      const detailColumns = [
        { title: 'Date', w: 125, get: (reading) => fmtDate(reading.date) },
        { title: 'Time slot', w: 180, get: (reading) => reading.slotLabel },
        { title: 'Glucose (mg/dl)', w: 100, get: (reading) => String(reading.value) },
        {
          title: 'Status',
          w: 110,
          get: (reading) =>
            reading.value < profile.targetLow ? 'Below range' : reading.value > profile.targetHigh ? 'Above range' : 'In range',
        },
      ];

      const drawDetailHeader = (continued = false) => {
        doc.fillColor(INK).font('Helvetica-Bold').fontSize(12).text(
          continued ? 'Individual readings (continued)' : `Individual readings (${detailRows.length})`,
          left,
          y
        );
        y += 20;
        doc.rect(left, y, width, rowH).fill(TINT);
        let x = left;
        detailColumns.forEach((column) => {
          doc.fillColor(INK).font('Helvetica-Bold').fontSize(9.5).text(column.title, x + 10, y + 6, {
            width: column.w - 14,
            lineBreak: false,
          });
          x += column.w;
        });
        doc.moveTo(left, y + rowH).lineTo(left + width, y + rowH).lineWidth(1.2).strokeColor(TEAL).stroke();
        y += rowH;
      };

      if (y + 20 + rowH + detailRowH > bottomLimit) {
        doc.addPage();
        y = 40;
      }
      drawDetailHeader();

      detailRows.forEach((reading, index) => {
        if (y + detailRowH > bottomLimit) {
          doc.addPage();
          y = 40;
          drawDetailHeader(true);
        }
        if (index % 2 === 1) doc.rect(left, y, width, detailRowH).fill(PANEL);
        let x = left;
        detailColumns.forEach((column) => {
          const text = column.get(reading);
          const color =
            column.title === 'Status'
              ? text === 'Above range'
                ? ORANGE
                : text === 'Below range'
                  ? INDIGO
                  : TEAL
              : INK;
          doc.fillColor(color).font(column.title === 'Glucose (mg/dl)' ? 'Helvetica-Bold' : 'Helvetica').fontSize(9.5).text(
            text,
            x + 10,
            y + 6,
            { width: column.w - 14, lineBreak: false, ellipsis: true }
          );
          x += column.w;
        });
        doc.moveTo(left, y + detailRowH).lineTo(left + width, y + detailRowH).lineWidth(0.5).strokeColor(LINE).stroke();
        y += detailRowH;
      });
    }

    drawFooter(doc, generatedOn);
    doc.end();
  });
}

function drawFooter(doc, generatedOn) {
  const y = doc.page.height - 66;
  doc.moveTo(40, y - 8).lineTo(doc.page.width - 40, y - 8).lineWidth(0.5).strokeColor(LINE).stroke();
  doc.fillColor(MUTED).font('Helvetica').fontSize(8.5).text(
    `Generated by Sweety on ${fmtDate(generatedOn)}. For information only, not medical advice.`,
    40,
    y,
    { width: doc.page.width - 80, lineBreak: false }
  );
}

module.exports = { renderReportPdf };
