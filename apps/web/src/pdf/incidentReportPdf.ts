import type { jsPDF } from 'jspdf';
import type { IncidentReport } from '../api/types';

// §2.14/§2.19: a real downloadable PDF artifact, not just a browser print-to-PDF of the
// ReportPage DOM — laid out directly with jsPDF's text/line primitives (no headless-Chrome or
// html-to-canvas dependency) so the API container's Docker footprint and this app's client
// bundle both stay small, consistent with this codebase's avoidance of heavy libraries
// elsewhere (no charting library either — see SkillRadarChart's hand-rolled SVG).

const MARGIN = 15;
const PAGE_WIDTH = 210; // A4 mm
const PAGE_HEIGHT = 297;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const LINE_HEIGHT = 5;

interface Cursor {
  y: number;
}

function ensureSpace(doc: jsPDF, cursor: Cursor, needed: number): void {
  if (cursor.y + needed > PAGE_HEIGHT - MARGIN) {
    doc.addPage();
    cursor.y = MARGIN;
  }
}

function writeHeading(doc: jsPDF, cursor: Cursor, text: string): void {
  ensureSpace(doc, cursor, 10);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text(text, MARGIN, cursor.y);
  cursor.y += 8;
}

function writeParagraph(doc: jsPDF, cursor: Cursor, text: string, options: { fontSize?: number; color?: [number, number, number] } = {}): void {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(options.fontSize ?? 10.5);
  doc.setTextColor(...(options.color ?? [30, 41, 59]));
  const lines: string[] = doc.splitTextToSize(text, CONTENT_WIDTH);
  for (const line of lines) {
    ensureSpace(doc, cursor, LINE_HEIGHT);
    doc.text(line, MARGIN, cursor.y);
    cursor.y += LINE_HEIGHT;
  }
}

function writeBullet(doc: jsPDF, cursor: Cursor, text: string, subtext?: string): void {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  doc.setTextColor(30, 41, 59);
  const lines: string[] = doc.splitTextToSize(text, CONTENT_WIDTH - 5);
  lines.forEach((line, i) => {
    ensureSpace(doc, cursor, LINE_HEIGHT);
    doc.text(i === 0 ? `• ${line}` : `  ${line}`, MARGIN, cursor.y);
    cursor.y += LINE_HEIGHT;
  });
  if (subtext) {
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    const subLines: string[] = doc.splitTextToSize(subtext, CONTENT_WIDTH - 5);
    for (const line of subLines) {
      ensureSpace(doc, cursor, LINE_HEIGHT - 1);
      doc.text(line, MARGIN + 3, cursor.y);
      cursor.y += LINE_HEIGHT - 1;
    }
  }
  cursor.y += 1.5;
}

export async function generateIncidentReportPdf(report: IncidentReport): Promise<jsPDF> {
  const { jsPDF: JsPdfCtor } = await import('jspdf');
  const doc = new JsPdfCtor({ unit: 'mm', format: 'a4' });
  const cursor: Cursor = { y: MARGIN };

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.setTextColor(15, 23, 42);
  const titleLines: string[] = doc.splitTextToSize(`Incident Report: ${report.incident.title}`, CONTENT_WIDTH);
  for (const line of titleLines) {
    doc.text(line, MARGIN, cursor.y);
    cursor.y += 8;
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(100, 116, 139);
  const opened = new Date(report.incident.createdAt).toLocaleString();
  const closed = report.incident.closedAt ? new Date(report.incident.closedAt).toLocaleString() : '—';
  doc.text(`Opened ${opened}  ·  Closed ${closed}`, MARGIN, cursor.y);
  cursor.y += 9;

  writeHeading(doc, cursor, 'Verdict & Score');
  const summaryBits = [`Verdict: ${report.incident.verdict ?? '—'}`];
  if (report.score) {
    summaryBits.push(`Score: ${report.score.overallPercent}%`);
    summaryBits.push(`Verdict Correct: ${report.score.verdictCorrect ? 'Yes' : 'No'}`);
  }
  writeParagraph(doc, cursor, summaryBits.join('    ·    '));
  cursor.y += 4;

  writeHeading(doc, cursor, 'MITRE Techniques');
  if (report.incident.techniques.length === 0) {
    writeParagraph(doc, cursor, 'None tagged.', { color: [100, 116, 139] });
  } else {
    for (const t of report.incident.techniques) {
      writeBullet(doc, cursor, `${t.techniqueId} — ${t.name}`);
    }
  }
  cursor.y += 4;

  writeHeading(doc, cursor, 'Summary');
  writeParagraph(doc, cursor, report.incident.summary || '—');
  cursor.y += 4;

  writeHeading(doc, cursor, `Evidence Collection (${report.evidence.length})`);
  if (report.evidence.length === 0) {
    writeParagraph(doc, cursor, 'No evidence pinned.', { color: [100, 116, 139] });
  } else {
    for (const e of report.evidence) {
      writeBullet(doc, cursor, e.summary, `Justification: ${e.justification}`);
    }
  }
  cursor.y += 4;

  writeHeading(doc, cursor, 'Analyst Notes');
  if (report.notes.length === 0) {
    writeParagraph(doc, cursor, 'No notes recorded.', { color: [100, 116, 139] });
  } else {
    for (const n of report.notes) {
      writeBullet(doc, cursor, n.body);
    }
  }
  cursor.y += 4;

  writeHeading(doc, cursor, 'Timeline');
  if (report.timeline.length === 0) {
    writeParagraph(doc, cursor, 'No timeline items.', { color: [100, 116, 139] });
  } else {
    for (const item of report.timeline) {
      const time = new Date(item.occurredAt).toLocaleString();
      writeBullet(doc, cursor, `${item.entityLabel} — ${item.summary}`, `${time}  ·  ${item.source.join(' + ')}`);
    }
  }

  return doc;
}

export function incidentReportPdfFilename(report: IncidentReport): string {
  const slug = report.incident.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  return `incident-report-${slug || report.incident.id}.pdf`;
}
