
export interface TemplateBranch {
  id: string;
  label: string;
  raw?: unknown;
}

export interface TemplateOffer {
  offerId: string;
  title: string;
  branches: TemplateBranch[];
  raw?: unknown;
  /** The offer's active period as UTC-midnight days; null = open on that side. */
  startDate?: Date | null;
  endDate?: Date | null;
}

export function branchLabel(name: string | undefined, city: string | undefined): string {
  const n = (name ?? '').trim();
  const c = (city ?? '').trim();
  return n && c ? `${n} — ${c}` : n || c;
}

export interface TemplateLabels {
  sheetName: string;
  listsSheetName: string;
  membershipId: string;
  mobileNumber: string;
  badgeNumber: string;
  transactionType: string;
  offer: string;
  branch: string;
  transactionDate: string;
  startDate: string;
  endDate: string;
  totalInvoiceAmount: string;
  totalAmountPaid: string;
  currency: string;
  discountAmount: string;
  listsOfferHeader: string;
  listsRefHeader: string;
  listsStartHeader: string;
  listsEndHeader: string;
  membershipIdPrompt: string;
  mobileNumberPrompt: string;
  badgeNumberPrompt: string;
  transactionDatePrompt: string;
  startDatePrompt: string;
  endDatePrompt: string;
  dateInvalidTitle: string;
  dateInvalidMessage: string;
  noBranches: string;
  invalidValueTitle: string;
  invalidValueMessage: string;
}

const VALIDATED_ROWS = 500;
const TRANSACTION_TYPES = ['SINGLE', 'COLLECTIVE'];
const SHEET_LISTS = 'Lists';
const EMPTY_LIST_NAME = 'NOBRANCH';
const EMPTY_LIST_CELL = 'B1000';
const OFFER_DATES_NAME = 'OfferDates';
/** Very hidden: per-row offer period, so each validation rule stays under Excel's
 *  255-character formula limit. A = start, B = end, same row as the main sheet. */
const DATES_SHEET = '_dates';
/** Excel's last date (9999-12-31) — the upper bound when an offer has no end. */
const MAX_EXCEL_DATE = 2958465;

/** exceljs can only give a 'date' rule fixed dates as bounds, and it merges per-cell
 *  rules into ranges anchored on the wrong row. So the date rules — type 'date' is what
 *  makes Excel show its calendar picker — are written straight into the sheet XML. */
async function addValidationRules(buffer: ArrayBuffer, rules: string[]): Promise<ArrayBuffer> {
  if (!rules.length) return buffer;
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(buffer);
  const path = 'xl/worksheets/sheet1.xml'; // the main sheet is always added first
  const xml = await zip.file(path)!.async('string');
  const withRules = xml
    .replace(/<dataValidations count="(\d+)">/, (_m, n: string) => `<dataValidations count="${Number(n) + rules.length}">`)
    .replace('</dataValidations>', `${rules.join('')}</dataValidations>`);
  zip.file(path, withRules);
  return zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' });
}

function xmlEscape(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Excel caps an input-message title at 32 characters and silently drops longer ones. */
function promptAttrs(title: string, prompt: string): string {
  return `showInputMessage="1" promptTitle="${xmlEscape(title.slice(0, 32))}" prompt="${xmlEscape(prompt)}"`;
}

/** One rule for a whole range. Its formulas are written for the range's first row;
 *  Excel shifts the relative ($-less) row references for every row below. */
function dateRule(
  sqref: string,
  min: string,
  max: string,
  title: string,
  prompt: string,
  labels: TemplateLabels,
): string {
  return (
    `<dataValidation type="date" operator="between" allowBlank="1" ${promptAttrs(title, prompt)} ` +
    `showErrorMessage="1" errorStyle="stop" ` +
    `errorTitle="${xmlEscape(labels.dateInvalidTitle)}" error="${xmlEscape(labels.dateInvalidMessage)}" sqref="${sqref}">` +
    `<formula1>${xmlEscape(min)}</formula1><formula2>${xmlEscape(max)}</formula2></dataValidation>`
  );
}

/** Tooltip only: no type means any value is accepted. */
function promptRule(sqref: string, title: string, prompt: string): string {
  return `<dataValidation allowBlank="1" ${promptAttrs(title, prompt)} sqref="${sqref}"/>`;
}

export const REF_SHEET = '_ref';
export const REF_COL = {
  offerId: 1,
  offerTitle: 2,
  offerJson: 3,
  branchId: 4,
  branchLabel: 5,
  branchJson: 6,
} as const;

const FILL_REQUIRED = 'FFFFF2CC'; // amber: required for this row's type and still empty
const FILL_UNUSED = 'FFEDEDED'; // grey: this row's type does not use the column
const TEXT_UNUSED = 'FF9E9E9E';

/** Colours each row once its Transaction Type (column A) is picked: amber where a field
 *  the type needs is still empty, grey where the type does not use the column.
 *  Rule formulas are written for row 2 and shift down, like the validation rules. */
function highlightByTransactionType(sheet: import('exceljs').Worksheet, last: number): void {
  const required = (ref: string, when: string) =>
    sheet.addConditionalFormatting({
      ref,
      rules: [
        {
          type: 'expression',
          priority: 1,
          formulae: [`AND(${when},ISBLANK(${ref.split(':')[0]}))`],
          style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: FILL_REQUIRED } } },
        },
      ],
    });
  const unused = (ref: string, when: string) =>
    sheet.addConditionalFormatting({
      ref,
      rules: [
        {
          type: 'expression',
          priority: 2,
          formulae: [when],
          style: {
            fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: FILL_UNUSED } },
            font: { color: { argb: TEXT_UNUSED } },
          },
        },
      ],
    });

  const single = '$A2="SINGLE"';
  const collective = '$A2="COLLECTIVE"';
  const anyType = '$A2<>""';

  required(`B2:B${last}`, single); // membership ID
  required(`G2:G${last}`, single); // transaction date
  required(`H2:I${last}`, collective); // start + end date
  required(`E2:E${last}`, anyType); // offer
  required(`J2:M${last}`, anyType); // amounts + currency

  unused(`B2:D${last}`, collective); // membership ID, badge number, mobile
  unused(`G2:G${last}`, collective);
  unused(`H2:I${last}`, single);
}

function aliasFor(index: number): string {
  return `BRANCHES_${index + 1}`;
}

export function uniqueTitles(offers: TemplateOffer[]): string[] {
  const seen = new Map<string, number>();
  return offers.map((o) => {
    const base = (o.title || '').trim() || o.offerId;
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base} (${count + 1})`;
  });
}

function columnLetter(index: number): string {
  let n = index;
  let out = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

export async function buildRedemptionTemplate(
  offers: TemplateOffer[],
  labels: TemplateLabels,
): Promise<Blob> {
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.created = new Date();
  // The _dates helpers ship without cached results; make Excel compute them on open.
  workbook.calcProperties.fullCalcOnLoad = true;

  const sheet = workbook.addWorksheet(labels.sheetName);
  const lists = workbook.addWorksheet(SHEET_LISTS);
  const ref = workbook.addWorksheet(REF_SHEET, { state: 'veryHidden' });
  const dates = workbook.addWorksheet(DATES_SHEET, { state: 'veryHidden' });
  const mainRef = `'${labels.sheetName.replace(/'/g, "''")}'`;

  sheet.columns = [
    // Type first: it decides which of the other columns the row needs.
    { header: labels.transactionType, key: 'transactionType', width: 20 },
    { header: labels.membershipId, key: 'membershipId', width: 18 },
    { header: labels.badgeNumber, key: 'badgeNumber', width: 18 },
    { header: labels.mobileNumber, key: 'mobileNumber', width: 18 },
    { header: labels.offer, key: 'offer', width: 38 },
    { header: labels.branch, key: 'branch', width: 34 },
    { header: labels.transactionDate, key: 'transactionDate', width: 20 },
    { header: labels.startDate, key: 'startDate', width: 20 },
    { header: labels.endDate, key: 'endDate', width: 20 },
    { header: labels.totalInvoiceAmount, key: 'totalInvoiceAmount', width: 26 },
    { header: labels.totalAmountPaid, key: 'totalAmountPaid', width: 20 },
    { header: labels.currency, key: 'currency', width: 12 },
    { header: labels.discountAmount, key: 'discountAmount', width: 18 },
  ];

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.alignment = { vertical: 'middle', horizontal: 'left' };
  headerRow.height = 22;
  headerRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0033A0' } };
  });
  sheet.views = [{ state: 'frozen', ySplit: 1 }];

  const titles = uniqueTitles(offers);

  // Lists: A offer, B branch-list alias, C start, D end, E gap, F.. one branch column per offer.
  lists.getCell('A1').value = labels.listsOfferHeader;
  lists.getCell('B1').value = labels.listsRefHeader;
  lists.getCell('C1').value = labels.listsStartHeader;
  lists.getCell('D1').value = labels.listsEndHeader;
  lists.getRow(1).font = { bold: true };
  lists.getColumn(1).width = 38;
  lists.getColumn(2).width = 12;
  lists.getColumn(3).width = 14;
  lists.getColumn(4).width = 14;

  titles.forEach((title, i) => {
    lists.getCell(`A${i + 2}`).value = title;
    lists.getCell(`B${i + 2}`).value = aliasFor(i);
    for (const [col, day] of [['C', offers[i].startDate], ['D', offers[i].endDate]] as const) {
      if (!day) continue;
      const cell = lists.getCell(`${col}${i + 2}`);
      cell.value = day;
      cell.numFmt = 'yyyy-mm-dd';
    }
  });

  const FIRST_BRANCH_COL = 6;
  offers.forEach((offer, i) => {
    const colIndex = FIRST_BRANCH_COL + i;
    const letter = columnLetter(colIndex);
    const alias = aliasFor(i);

    lists.getColumn(colIndex).width = 34;
    lists.getCell(`${letter}1`).value = alias;
    lists.getRow(1).getCell(colIndex).font = { bold: true };

    const values = offer.branches.length
      ? offer.branches.map((b) => b.label)
      : [labels.noBranches];
    values.forEach((branch, r) => {
      lists.getCell(`${letter}${r + 2}`).value = branch;
    });

    workbook.definedNames.add(`${SHEET_LISTS}!$${letter}$2:$${letter}$${values.length + 1}`, alias);
  });

  if (titles.length) {
    workbook.definedNames.add(`${SHEET_LISTS}!$A$2:$A$${titles.length + 1}`, 'OfferList');
    workbook.definedNames.add(`${SHEET_LISTS}!$A$2:$D$${titles.length + 1}`, OFFER_DATES_NAME);
  }

  lists.getCell(EMPTY_LIST_CELL).value = '';
  workbook.definedNames.add(`${SHEET_LISTS}!$B$1000`, EMPTY_LIST_NAME);

  ref.getRow(1).values = ['offerId', 'offerTitle', 'offerJson', 'branchId', 'branchLabel', 'branchJson'];
  let refRow = 2;
  offers.forEach((offer, i) => {
    const shownTitle = titles[i];
    const offerJson = offer.raw ? JSON.stringify(offer.raw) : '';

    if (!offer.branches.length) {
      const row = ref.getRow(refRow++);
      row.getCell(REF_COL.offerId).value = offer.offerId;
      row.getCell(REF_COL.offerTitle).value = shownTitle;
      row.getCell(REF_COL.offerJson).value = offerJson;
      return;
    }

    for (const branch of offer.branches) {
      const row = ref.getRow(refRow++);
      row.getCell(REF_COL.offerId).value = offer.offerId;
      row.getCell(REF_COL.offerTitle).value = shownTitle;
      row.getCell(REF_COL.offerJson).value = offerJson;
      row.getCell(REF_COL.branchId).value = branch.id;
      row.getCell(REF_COL.branchLabel).value = branch.label;
      row.getCell(REF_COL.branchJson).value = branch.raw ? JSON.stringify(branch.raw) : '';
    }
  });

  const errorText = {
    showErrorMessage: true,
    errorStyle: 'stop' as const,
    errorTitle: labels.invalidValueTitle,
    error: labels.invalidValueMessage,
  };

  for (let row = 2; row <= VALIDATED_ROWS + 1; row++) {
    sheet.getCell(`A${row}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`"${TRANSACTION_TYPES.join(',')}"`],
      ...errorText,
    };

    if (titles.length) {
      sheet.getCell(`E${row}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['OfferList'],
        ...errorText,
      };

      sheet.getCell(`F${row}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [
          `INDIRECT(IFERROR(VLOOKUP($E${row},${SHEET_LISTS}!$A$2:$B$${titles.length + 1},2,FALSE),"${EMPTY_LIST_NAME}"))`,
        ],
        ...errorText,
      };
    }

    for (const col of ['G', 'H', 'I']) {
      sheet.getCell(`${col}${row}`).numFmt = 'yyyy-mm-dd';
    }
    // Text, so a badge keeps its leading zeros.
    sheet.getCell(`C${row}`).numFmt = '@';

    if (titles.length) {
      // The row's offer period, looked up from Lists. 1/(1/x) turns a blank (0) into an
      // error, so an offer with no start/end — or no offer picked yet — falls back to
      // "unbounded" instead of rejecting every date.
      dates.getCell(`A${row}`).value = {
        formula: `IFERROR(1/(1/VLOOKUP(${mainRef}!$E${row},${OFFER_DATES_NAME},3,FALSE)),1)`,
      };
      dates.getCell(`B${row}`).value = {
        formula: `IFERROR(1/(1/VLOOKUP(${mainRef}!$E${row},${OFFER_DATES_NAME},4,FALSE)),${MAX_EXCEL_DATE})`,
      };
    }
  }

  const last = VALIDATED_ROWS + 1;
  const offerStart = `'${DATES_SHEET}'!$A2`;
  const offerEnd = `'${DATES_SHEET}'!$B2`;
  const rules = [
    promptRule(`B2:B${last}`, labels.membershipId, labels.membershipIdPrompt),
    promptRule(`C2:C${last}`, labels.badgeNumber, labels.badgeNumberPrompt),
    promptRule(`D2:D${last}`, labels.mobileNumber, labels.mobileNumberPrompt),
    ...(titles.length
      ? [
          // G: SINGLE only; H/I: COLLECTIVE only — all within the row's offer period.
          dateRule(`G2:G${last}`, offerStart, offerEnd, labels.transactionDate, labels.transactionDatePrompt, labels),
          dateRule(`H2:H${last}`, offerStart, offerEnd, labels.startDate, labels.startDatePrompt, labels),
          // End date also may not precede the row's start date.
          dateRule(`I2:I${last}`, `MAX(${offerStart},N($H2))`, offerEnd, labels.endDate, labels.endDatePrompt, labels),
        ]
      : []),
  ];

  highlightByTransactionType(sheet, last);
  const buffer = await addValidationRules(await workbook.xlsx.writeBuffer(), rules);
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
