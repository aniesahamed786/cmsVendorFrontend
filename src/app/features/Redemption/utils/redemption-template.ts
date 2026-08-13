
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
  transactionType: string;
  offer: string;
  branch: string;
  transactionDate: string;
  totalInvoiceAmount: string;
  totalAmountPaid: string;
  currency: string;
  discountAmount: string;
  listsOfferHeader: string;
  listsRefHeader: string;
  noBranches: string;
  invalidValueTitle: string;
  invalidValueMessage: string;
}

const VALIDATED_ROWS = 500;
const TRANSACTION_TYPES = ['SINGLE', 'COLLECTIVE'];
const SHEET_LISTS = 'Lists';
const EMPTY_LIST_NAME = 'NOBRANCH';
const EMPTY_LIST_CELL = 'B1000';
export const REF_SHEET = '_ref';
export const REF_COL = {
  offerId: 1,
  offerTitle: 2,
  offerJson: 3,
  branchId: 4,
  branchLabel: 5,
  branchJson: 6,
} as const;

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

  const sheet = workbook.addWorksheet(labels.sheetName);
  const lists = workbook.addWorksheet(SHEET_LISTS);
  const ref = workbook.addWorksheet(REF_SHEET, { state: 'veryHidden' });

  sheet.columns = [
    { header: labels.membershipId, key: 'membershipId', width: 18 },
    { header: labels.mobileNumber, key: 'mobileNumber', width: 18 },
    { header: labels.transactionType, key: 'transactionType', width: 20 },
    { header: labels.offer, key: 'offer', width: 38 },
    { header: labels.branch, key: 'branch', width: 34 },
    { header: labels.transactionDate, key: 'transactionDate', width: 20 },
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

  lists.getCell('A1').value = labels.listsOfferHeader;
  lists.getCell('B1').value = labels.listsRefHeader;
  lists.getRow(1).font = { bold: true };
  lists.getColumn(1).width = 38;
  lists.getColumn(2).width = 12;

  titles.forEach((title, i) => {
    lists.getCell(`A${i + 2}`).value = title;
    lists.getCell(`B${i + 2}`).value = aliasFor(i);
  });

  const FIRST_BRANCH_COL = 4;
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
    sheet.getCell(`C${row}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`"${TRANSACTION_TYPES.join(',')}"`],
      ...errorText,
    };

    if (titles.length) {
      sheet.getCell(`D${row}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['OfferList'],
        ...errorText,
      };

      sheet.getCell(`E${row}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [
          `INDIRECT(IFERROR(VLOOKUP($D${row},${SHEET_LISTS}!$A$2:$B$${titles.length + 1},2,FALSE),"${EMPTY_LIST_NAME}"))`,
        ],
        ...errorText,
      };
    }

    sheet.getCell(`F${row}`).numFmt = 'yyyy-mm-dd';
    for (const col of ['G', 'H', 'J']) {
      sheet.getCell(`${col}${row}`).numFmt = '0.00';
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
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
