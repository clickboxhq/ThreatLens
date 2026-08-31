const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell,
  WidthType, BorderStyle, AlignmentType, PageBreak, TableOfContents, LevelFormat,
  ShadingType, PageOrientation, Header, Footer, PageNumber, NumberFormat
} = require("docx");

const SRC = "ThreatLens-Architecture.md";
const OUT = "ThreatLens-Architecture.docx";

const raw = fs.readFileSync(SRC, "utf8");
const lines = raw.split(/\r?\n/);

const PAGE_WIDTH = 12240, PAGE_HEIGHT = 15840, MARGIN = 1440;
const USABLE_WIDTH = PAGE_WIDTH - MARGIN * 2;

const FONT_BODY = "Calibri";
const FONT_MONO = "Consolas";

// ---------- inline parsing (bold **x**, inline code `x`) ----------
function parseInline(text, baseOpts = {}) {
  const runs = [];
  let i = 0;
  const re = /(\*\*(.+?)\*\*)|(\*([^*\n]+?)\*)|(`([^`]+?)`)/g;
  let lastIndex = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > lastIndex) {
      runs.push(new TextRun({ text: text.slice(lastIndex, m.index), font: FONT_BODY, ...baseOpts }));
    }
    if (m[1]) {
      runs.push(new TextRun({ text: m[2], bold: true, font: FONT_BODY, ...baseOpts }));
    } else if (m[3]) {
      runs.push(new TextRun({ text: m[4], italics: true, font: FONT_BODY, ...baseOpts }));
    } else if (m[5]) {
      runs.push(new TextRun({ text: m[6], font: FONT_MONO, size: (baseOpts.size || 21), shading: { type: ShadingType.CLEAR, fill: "EEEEEE" }, ...baseOpts }));
    }
    lastIndex = re.lastIndex;
  }
  if (lastIndex < text.length) {
    runs.push(new TextRun({ text: text.slice(lastIndex), font: FONT_BODY, ...baseOpts }));
  }
  if (runs.length === 0) runs.push(new TextRun({ text: "", font: FONT_BODY, ...baseOpts }));
  return runs;
}

function bodyPara(text, opts = {}) {
  return new Paragraph({
    children: parseInline(text),
    spacing: { after: 160, line: 276 },
    ...opts
  });
}

function headingPara(text, level, bookmark) {
  const clean = text.replace(/^#+\s*/, "");
  return new Paragraph({
    text: clean,
    heading: level,
    spacing: { before: 280, after: 140 }
  });
}

function hr() {
  return new Paragraph({
    children: [new PageBreak()]
  });
}

function bulletPara(text) {
  return new Paragraph({
    children: parseInline(text),
    numbering: { reference: "bullet-list", level: 0 },
    spacing: { after: 100, line: 276 }
  });
}

function orderedPara(text, num) {
  return new Paragraph({
    children: parseInline(text),
    numbering: { reference: "ordered-list", level: 0 },
    spacing: { after: 100, line: 276 }
  });
}

function codeParas(codeLines) {
  return codeLines.map(l => new Paragraph({
    children: [new TextRun({ text: l.length ? l : " ", font: FONT_MONO, size: 18 })],
    spacing: { after: 0, line: 240 },
    shading: { type: ShadingType.CLEAR, fill: "F5F5F5" }
  }));
}

function makeCell(text, opts = {}) {
  return new TableCell({
    width: { size: opts.width, type: WidthType.DXA },
    shading: opts.header ? { type: ShadingType.CLEAR, fill: "1F3864" } : undefined,
    margins: { top: 80, bottom: 80, left: 100, right: 100 },
    children: [new Paragraph({
      children: parseInline(text, opts.header ? { color: "FFFFFF", bold: true, size: 19 } : { size: 19 }),
      spacing: { after: 0 }
    })]
  });
}

function parseTable(headerCells, rows) {
  const n = headerCells.length;
  const colW = Math.floor(USABLE_WIDTH / n);
  const widths = new Array(n).fill(colW);
  widths[n - 1] = USABLE_WIDTH - colW * (n - 1);
  const headerRow = new TableRow({
    tableHeader: true,
    children: headerCells.map((c, idx) => makeCell(c, { header: true, width: widths[idx] }))
  });
  const bodyRows = rows.map(r => new TableRow({
    children: r.map((c, idx) => makeCell(c, { width: widths[idx] }))
  }));
  return new Table({
    width: { size: USABLE_WIDTH, type: WidthType.DXA },
    columnWidths: widths,
    rows: [headerRow, ...bodyRows]
  });
}

function splitRow(line) {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|")) s = s.slice(0, -1);
  return s.split("|").map(c => c.trim());
}

function isSeparatorRow(line) {
  return /^\s*\|?[\s:\-|]+\|?\s*$/.test(line) && line.includes("-");
}

// ---------- main pass ----------
const children = [];
let i = 0;
let sawTOCHeading = false;
let inTOCList = false;
let pendingBreakOnly = false; // true right after a page-break with no real content yet on the new page

// numbering config
const numbering = {
  config: [
    {
      reference: "bullet-list",
      levels: [
        { level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 460, hanging: 260 } } } }
      ]
    },
    {
      reference: "ordered-list",
      levels: [
        { level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 460, hanging: 260 } } } }
      ]
    }
  ]
};

while (i < lines.length) {
  const line = lines[i];
  const trimmed = line.trim();

  // Skip blank
  if (trimmed === "") { i++; continue; }

  // Code fence
  if (trimmed.startsWith("```")) {
    i++;
    const buf = [];
    while (i < lines.length && !lines[i].trim().startsWith("```")) {
      buf.push(lines[i]);
      i++;
    }
    i++; // consume closing fence
    children.push(...codeParas(buf));
    children.push(new Paragraph({ text: "", spacing: { after: 120 } }));
    pendingBreakOnly = false;
    continue;
  }

  // Horizontal rule -> page break (collapse consecutive breaks into one)
  if (/^-{3,}$/.test(trimmed)) {
    if (!pendingBreakOnly) {
      children.push(hr());
      pendingBreakOnly = true;
    }
    i++;
    continue;
  }

  // Headings
  let hm = trimmed.match(/^(#{1,4})\s+(.*)$/);
  if (hm) {
    const level = hm[1].length;
    const text = hm[2];
    if (text.trim().toLowerCase() === "table of contents") {
      children.push(new Paragraph({ text: "Table of Contents", heading: HeadingLevel.HEADING_1, spacing: { before: 280, after: 200 } }));
      children.push(new TableOfContents("Table of Contents", { hyperlink: true, headingStyleRange: "1-2" }));
      children.push(new Paragraph({ children: [new PageBreak()] }));
      sawTOCHeading = true;
      inTOCList = true;
      pendingBreakOnly = true;
      i++;
      continue;
    }
    const map = { 1: HeadingLevel.HEADING_1, 2: HeadingLevel.HEADING_2, 3: HeadingLevel.HEADING_3, 4: HeadingLevel.HEADING_4 };
    // First H1 in doc = Title
    if (level === 1 && children.length === 0) {
      children.push(new Paragraph({ text, heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER, spacing: { after: 120 } }));
      pendingBreakOnly = false;
      i++;
      continue;
    }
    children.push(headingPara(text, map[level]));
    pendingBreakOnly = false;
    i++;
    continue;
  }

  // If we're in the manual TOC numbered-list block right after the TOC field, skip authored "1. Foo" lines
  if (inTOCList) {
    if (/^\d+\.\s+/.test(trimmed)) { i++; continue; }
    if (trimmed === "---") { inTOCList = false; i++; continue; }
    inTOCList = false; // fallthrough, don't skip
  }

  // Bold-only metadata lines like **Document status:** ...
  // (handled as normal paragraph)

  // Table detection
  if (trimmed.startsWith("|") && i + 1 < lines.length && isSeparatorRow(lines[i + 1])) {
    const headerCells = splitRow(line);
    i += 2;
    const rows = [];
    while (i < lines.length && lines[i].trim().startsWith("|")) {
      rows.push(splitRow(lines[i]));
      i++;
    }
    children.push(parseTable(headerCells, rows));
    children.push(new Paragraph({ text: "", spacing: { after: 160 } }));
    pendingBreakOnly = false;
    continue;
  }

  // Bullet list
  if (/^-\s+/.test(trimmed)) {
    children.push(bulletPara(trimmed.replace(/^-\s+/, "")));
    pendingBreakOnly = false;
    i++;
    continue;
  }

  // Ordered list
  let om = trimmed.match(/^(\d+)\.\s+(.*)$/);
  if (om) {
    children.push(orderedPara(om[2], om[1]));
    pendingBreakOnly = false;
    i++;
    continue;
  }

  // Default paragraph
  children.push(bodyPara(trimmed));
  pendingBreakOnly = false;
  i++;
}

const doc = new Document({
  numbering,
  styles: {
    default: {
      document: { run: { font: FONT_BODY, size: 21 } } // 10.5pt
    },
    heading1: { run: { size: 30, bold: true, color: "1F3864", font: FONT_BODY }, paragraph: { spacing: { before: 360, after: 180 }, outlineLevel: 0 } },
    heading2: { run: { size: 25, bold: true, color: "2E5395", font: FONT_BODY }, paragraph: { spacing: { before: 260, after: 140 }, outlineLevel: 1 } },
    heading3: { run: { size: 23, bold: true, color: "3B6EA5", font: FONT_BODY }, paragraph: { spacing: { before: 200, after: 100 }, outlineLevel: 2 } },
    heading4: { run: { size: 21, bold: true, italics: true, color: "444444", font: FONT_BODY }, paragraph: { spacing: { before: 160, after: 80 }, outlineLevel: 3 } },
    title: { run: { size: 56, bold: true, color: "1F3864", font: FONT_BODY } }
  },
  sections: [
    {
      properties: {
        page: {
          size: { width: PAGE_WIDTH, height: PAGE_HEIGHT },
          margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN }
        }
      },
      headers: {
        default: new Header({
          children: [new Paragraph({ children: [new TextRun({ text: "SOCVerse — Software Architecture & Technical Design Specification", size: 16, color: "888888", font: FONT_BODY })], alignment: AlignmentType.CENTER })]
        })
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: "Page ", size: 16, color: "888888", font: FONT_BODY }),
              new TextRun({ children: [PageNumber.CURRENT], size: 16, color: "888888", font: FONT_BODY }),
              new TextRun({ text: " of ", size: 16, color: "888888", font: FONT_BODY }),
              new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: "888888", font: FONT_BODY })
            ]
          })]
        })
      },
      children
    }
  ]
});

Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync(OUT, buf);
  console.log("Wrote", OUT, buf.length, "bytes. Paragraph/table nodes:", children.length);
});
