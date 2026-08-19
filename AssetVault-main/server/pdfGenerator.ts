import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { MappedAsset } from "./assetHelpers.js";
import { getScanUrl, isDesktopAsset, formatPeripheralLine } from "./assetHelpers.js";
import { normalizeWarrantyDate } from "../src/lib/warrantyDate.js";
import { APP_NAME } from "../src/lib/constants.js";
import { formatStoredDateTime } from "../src/lib/formatDisplayDate.js";
import { toAppFileViewUrl } from "./driveUrls.js";

function assetDisplayName(asset: MappedAsset): string {
  const name = String(asset.assetName || "").trim();
  if (name) return name;
  const makeModel = `${asset.make || ""} ${asset.model || ""}`.trim();
  if (makeModel) return makeModel;
  return String(asset.assetType || "Asset").trim();
}

/** pdf-lib StandardFonts only support WinAnsi — strip unsupported chars */
function pdfSafeText(value: unknown, maxLen = 200): string {
  const s = String(value ?? "").trim();
  if (!s) return "";
  return s
    .replace(/\u2014|\u2013/g, "-")
    .replace(/\u2192/g, "->")
    .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, "?")
    .slice(0, maxLen);
}

function formatPdfDate(value: unknown): string {
  return formatStoredDateTime(String(value ?? ""));
}

function drawPdfHeader(
  page: ReturnType<PDFDocument["addPage"]>,
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  fontBold: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  asset: MappedAsset
) {
  const headerTop = 842;
  const redHeight = 38;
  const whiteHeight = 34;
  const redY = headerTop - redHeight;
  const whiteY = redY - whiteHeight;

  page.drawRectangle({ x: 0, y: redY, width: 595, height: redHeight, color: rgb(0.72, 0.11, 0.11) });
  page.drawText(pdfSafeText(APP_NAME), {
    x: 40,
    y: redY + 14,
    size: 13,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  page.drawRectangle({ x: 0, y: whiteY, width: 595, height: whiteHeight, color: rgb(1, 1, 1) });
  page.drawLine({ start: { x: 0, y: whiteY + whiteHeight }, end: { x: 595, y: whiteY + whiteHeight }, thickness: 1, color: rgb(0.72, 0.11, 0.11) });
  page.drawLine({ start: { x: 0, y: whiteY }, end: { x: 595, y: whiteY }, thickness: 0.5, color: rgb(0.85, 0.85, 0.85) });

  page.drawText(pdfSafeText(assetDisplayName(asset)), {
    x: 40,
    y: whiteY + 16,
    size: 14,
    font: fontBold,
    color: rgb(0.35, 0.02, 0.02),
  });

  const metaLine = [asset.assetType, asset.assetCode].filter(Boolean).join(" · ");
  if (metaLine) {
    page.drawText(pdfSafeText(metaLine), {
      x: 40,
      y: whiteY + 4,
      size: 8,
      font,
      color: rgb(0.45, 0.45, 0.45),
    });
  }
}

function formatPeripheralPdfLine(
  code?: string,
  serial?: string,
  make?: string,
  model?: string,
  connectivity?: string
): string {
  return [
    formatPeripheralLine(code, serial),
    make ? `Brand: ${make}` : "",
    model ? `Model: ${model}` : "",
    connectivity ? `Connectivity: ${connectivity}` : "",
  ].filter(Boolean).join(" | ");
}

async function drawPeripheralDetailsPage(
  pdfDoc: PDFDocument,
  asset: MappedAsset,
  baseUrl: string,
  type: string,
  serial: string,
  code: string,
  make = "",
  model = "",
  connectivity = ""
) {
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const scanUrl = `${baseUrl.replace(/\/$/, "")}/scan/${encodeURIComponent(code || serial)}`;

  const page = pdfDoc.addPage([595, 842]);
  const headerTop = 842;
  const bandHeight = 38;
  const whiteHeight = 30;
  const blueY = headerTop - bandHeight;
  const whiteY = blueY - whiteHeight;
  page.drawRectangle({ x: 0, y: blueY, width: 595, height: bandHeight, color: rgb(0.05, 0.35, 0.65) });
  page.drawText(pdfSafeText(APP_NAME), { x: 40, y: blueY + 14, size: 13, font: fontBold, color: rgb(1, 1, 1) });
  page.drawRectangle({ x: 0, y: whiteY, width: 595, height: whiteHeight, color: rgb(1, 1, 1) });
  page.drawText(pdfSafeText(`${type} Asset`), { x: 40, y: whiteY + 10, size: 13, font: fontBold, color: rgb(0.05, 0.25, 0.55) });

  let y = whiteY - 18;

  const lines: [string, string][] = [
    ["Peripheral Type", type],
    ["Asset Code", code || "—"],
    ["Serial Number", serial || "—"],
    ["Parent Desktop Code", asset.assetCode || asset.uniqueCode || "—"],
    ["Parent Desktop Serial", asset.serialNumber || "—"],
    ["Assigned To", asset.contactName || "—"],
    ["Assigned Date", formatPdfDate(asset.assignedDate) || "—"],
    ["Location", asset.location || "—"],
    ["Plant", asset.plantCode || "—"],
    ["Employee Department", asset.department || "—"],
  ];

  lines.splice(3, 0, ["Brand", make || "-"], ["Model Number", model || "-"], ["Connectivity", connectivity || "-"]);

  for (const [label, value] of lines) {
    const safe = pdfSafeText(value);
    page.drawText(`${pdfSafeText(label)}`, { x: 40, y, size: 9, font: fontBold, color: rgb(0.35, 0.35, 0.4) });
    page.drawText(safe || "—", { x: 200, y, size: 10, font, color: rgb(0.1, 0.1, 0.15) });
    y -= 22;
    if (y < 140) break;
  }

  page.drawText(pdfSafeText(scanUrl, 180), {
    x: 40,
    y: 70,
    size: 8,
    font,
    color: rgb(0.1, 0.3, 0.7),
  });
}

async function drawDetailsPage(
  pdfDoc: PDFDocument,
  asset: MappedAsset,
  baseUrl: string,
  scanUrl: string
) {
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const page = pdfDoc.addPage([595, 842]);
  drawPdfHeader(page, font, fontBold, asset);

  const drawSection = (title: string, startY: number) => {
    page.drawRectangle({ x: 36, y: startY - 14, width: 523, height: 22, color: rgb(0.94, 0.96, 0.98) });
    page.drawText(pdfSafeText(title), { x: 44, y: startY - 8, size: 9, font: fontBold, color: rgb(0.2, 0.35, 0.55) });
    return startY - 28;
  };

  const drawRow = (label: string, value: string | number | undefined, yPos: number) => {
    if (/^asset\s*id$/i.test(String(label || "").trim())) return yPos;
    const safe = pdfSafeText(value);
    if (!safe || safe === "—") return yPos;
    page.drawText(`${pdfSafeText(label)}`, { x: 44, y: yPos, size: 9, font: fontBold, color: rgb(0.4, 0.4, 0.45) });
    page.drawText(safe, { x: 190, y: yPos, size: 10, font, color: rgb(0.08, 0.08, 0.12) });
    return yPos - 17;
  };

  let y = drawSection("Asset Identity", 730);
  y = drawRow("Asset Code", asset.assetCode, y);
  y = drawRow("Unique Code", asset.uniqueCode, y);
  y = drawRow("Serial Number", asset.serialNumber, y);
  y = drawRow("Type / Category", `${asset.assetType} (${asset.mainCategory || "IT Assets"})`, y);
  y = drawRow("Make / Model", `${asset.make} ${asset.model}`.trim(), y);
  y = drawRow("Vendor", asset.vendorName, y);

  y = drawSection("Location & Assignment", y - 6);
  y = drawRow("Location", asset.location, y);
  y = drawRow("Plant", asset.plantCode, y);
  y = drawRow("Employee Department", asset.department, y);
  y = drawRow("Assigned To", asset.contactName || asset.employeeId, y);
  y = drawRow("Employee ID", asset.employeeId, y);
  y = drawRow("Assigned Date", formatPdfDate(asset.assignedDate), y);
  y = drawRow("Email", asset.contactEmail, y);
  y = drawRow("Mobile", asset.contactMobile, y);

  const isItDevice = (asset.mainCategory || "IT Assets") === "IT Assets";
  const isComputer = isItDevice && ["Laptop", "Desktop"].includes(asset.assetType);

  if (isItDevice) {
    y = drawSection("IT Specifications", y - 6);
    if (isComputer) {
      const ramStorage = `${asset.ram || ""} / ${asset.ssd || ""}`.trim();
      if (ramStorage && ramStorage !== "/") y = drawRow("RAM / Storage", ramStorage, y);
      const cpuOs = `${asset.cpu || ""} / ${asset.windowsVersion || ""}`.trim();
      if (cpuOs && cpuOs !== "/") y = drawRow("CPU / OS", cpuOs, y);
    }
    y = drawRow("IP Address", asset.ipAddress, y);
    y = drawRow("Host Name", asset.hostName, y);
    y = drawRow("MAC Address", asset.macAddress, y);
  } else if (asset.dynamicDetails && Object.keys(asset.dynamicDetails).length > 0) {
    let hasDynamicContent = false;
    for (const [key, value] of Object.entries(asset.dynamicDetails)) {
      if (String(value || "").trim()) {
        hasDynamicContent = true;
        break;
      }
    }
    if (hasDynamicContent) {
      y = drawSection("Specifications", y - 6);
      for (const [key, value] of Object.entries(asset.dynamicDetails)) {
        const valStr = String(value || "").trim();
        if (valStr && valStr !== "—") {
          const label = key
            .replace(/_/g, " ")
            .replace(/([A-Z])/g, " $1")
            .replace(/\b\w/g, (char) => char.toUpperCase())
            .replace(/\s+/g, " ")
            .trim();
          y = drawRow(label, valStr, y);
        }
      }
    }
  }

  if (isDesktopAsset(asset)) {
    y = drawSection("Peripherals", y - 6);
    y = drawRow(
      "Monitor",
      formatPeripheralPdfLine(asset.monitorAssetCode, asset.monitorSerial, asset.monitorMake, asset.monitorModel),
      y
    );
    y = drawRow(
      "Keyboard",
      formatPeripheralPdfLine(
        asset.keyboardAssetCode,
        asset.keyboardSerial,
        asset.keyboardMake,
        asset.keyboardModel,
        asset.keyboardConnectivity
      ),
      y
    );
    y = drawRow(
      "Mouse",
      formatPeripheralPdfLine(
        asset.mouseAssetCode,
        asset.mouseSerial,
        asset.mouseMake,
        asset.mouseModel,
        asset.mouseConnectivity
      ),
      y
    );
    y = drawRow(
      "UPS",
      formatPeripheralPdfLine(asset.upsAssetCode, asset.upsSerial, asset.upsMake, asset.upsModel),
      y
    );
  }

  const warrantyStart = formatPdfDate(normalizeWarrantyDate(asset.warrantyStartDate));
  const warrantyEnd = formatPdfDate(normalizeWarrantyDate(asset.warrantyEndDate));
  const warrantyText = [warrantyStart, warrantyEnd].filter((v) => v && v !== "—").join(" to ") || "";
  if (warrantyText) {
    y = drawSection("Warranty", y - 6);
    y = drawRow("Period", warrantyText, y);
  }

  if (asset.additionalItems?.trim()) {
    y = drawRow("Remarks", asset.additionalItems, y - 6);
  }

  // Drive links — never embed files; show view URLs only
  y = drawSection("Attachment Links", Math.max(y - 6, 150));
  const docLink = toAppFileViewUrl(asset.documentUrl || "", baseUrl);
  const rawPhotoLink = toAppFileViewUrl(asset.imageUrl || "", baseUrl);
  const photoLink = rawPhotoLink && rawPhotoLink !== docLink ? rawPhotoLink : "";
  y = drawRow("Asset Photo Link", photoLink || "—", y);
  y = drawRow("Asset Document Link", docLink || "—", y);

  // Footer live-record link
  page.drawRectangle({ x: 36, y: 36, width: 523, height: 110, color: rgb(0.97, 0.98, 1), borderColor: rgb(0.85, 0.88, 0.92), borderWidth: 1 });
  page.drawText("Live asset record", { x: 48, y: 118, size: 9, font: fontBold, color: rgb(0.3, 0.3, 0.35) });
  page.drawText(pdfSafeText(scanUrl, 180), { x: 48, y: 100, size: 8, font, color: rgb(0.1, 0.3, 0.65) });
}

export async function generateAssetPdf(
  asset: MappedAsset,
  baseUrl: string,
  scanId?: string
): Promise<Uint8Array> {
  const matchKey = scanId ? decodeURIComponent(scanId).toLowerCase().trim() : "";

  let peripheralType: "Monitor" | "Keyboard" | "Mouse" | "UPS" | null = null;
  let peripheralSerial = "";
  let peripheralCode = "";
  let peripheralMake = "";
  let peripheralModel = "";
  let peripheralConnectivity = "";

  if (matchKey && isDesktopAsset(asset)) {
    if (
      (asset.monitorSerial && asset.monitorSerial.toLowerCase().trim() === matchKey) ||
      (asset.monitorAssetCode && asset.monitorAssetCode.toLowerCase().trim() === matchKey)
    ) {
      peripheralType = "Monitor";
      peripheralSerial = asset.monitorSerial;
      peripheralCode = asset.monitorAssetCode;
      peripheralMake = asset.monitorMake;
      peripheralModel = asset.monitorModel;
    } else if (
      (asset.keyboardSerial && asset.keyboardSerial.toLowerCase().trim() === matchKey) ||
      (asset.keyboardAssetCode && asset.keyboardAssetCode.toLowerCase().trim() === matchKey)
    ) {
      peripheralType = "Keyboard";
      peripheralSerial = asset.keyboardSerial;
      peripheralCode = asset.keyboardAssetCode;
      peripheralMake = asset.keyboardMake;
      peripheralModel = asset.keyboardModel;
      peripheralConnectivity = asset.keyboardConnectivity;
    } else if (
      (asset.mouseSerial && asset.mouseSerial.toLowerCase().trim() === matchKey) ||
      (asset.mouseAssetCode && asset.mouseAssetCode.toLowerCase().trim() === matchKey)
    ) {
      peripheralType = "Mouse";
      peripheralSerial = asset.mouseSerial;
      peripheralCode = asset.mouseAssetCode;
      peripheralMake = asset.mouseMake;
      peripheralModel = asset.mouseModel;
      peripheralConnectivity = asset.mouseConnectivity;
    } else if (
      (asset.upsSerial && asset.upsSerial.toLowerCase().trim() === matchKey) ||
      (asset.upsAssetCode && asset.upsAssetCode.toLowerCase().trim() === matchKey)
    ) {
      peripheralType = "UPS";
      peripheralSerial = asset.upsSerial;
      peripheralCode = asset.upsAssetCode;
      peripheralMake = asset.upsMake;
      peripheralModel = asset.upsModel;
    }
  }

  const pdfDoc = await PDFDocument.create();

  if (peripheralType) {
    await drawPeripheralDetailsPage(
      pdfDoc,
      asset,
      baseUrl,
      peripheralType,
      peripheralSerial,
      peripheralCode,
      peripheralMake,
      peripheralModel,
      peripheralConnectivity
    );
  } else {
    const scanUrl = getScanUrl(baseUrl, asset);
    await drawDetailsPage(pdfDoc, asset, baseUrl, scanUrl);
  }

  const bytes = await pdfDoc.save();
  if (bytes.length < 5 || bytes[0] !== 0x25) {
    throw new Error("Generated PDF is invalid");
  }
  return bytes;
}
