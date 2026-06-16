import React, { useMemo } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Asset } from "../types";
import { Printer, X } from "lucide-react";
import { buildScanUrl } from "../lib/scanId";

interface QRCodeDisplayProps {
  asset: Asset;
  onClose: () => void;
}

export default function QRCodeDisplay({ asset, onClose }: QRCodeDisplayProps) {
  const qrValue = useMemo(() => buildScanUrl(asset), [asset]);

  const qrSize = useMemo(() => {
    if (typeof window === "undefined") return 180;
    return Math.min(200, Math.max(140, Math.floor(window.innerWidth * 0.45)));
  }, []);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex flex-col items-stretch w-full">
      <div
        id="printable-inner-qr"
        className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-4 sm:p-5 mx-auto w-full"
      >
        <div id="qr-box" className="bg-white p-2 sm:p-3 rounded-lg border border-slate-100 shadow-sm">
          <QRCodeSVG
            value={qrValue}
            size={qrSize}
            level="H"
            includeMargin={false}
            className="qr-svg-print"
          />
        </div>
      </div>

      <div className="mt-4 flex gap-2 sm:gap-3 w-full no-print shrink-0">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 py-2.5 px-4 bg-white hover:bg-slate-50 text-slate-700 font-bold text-sm rounded-xl border border-slate-200 transition-colors flex items-center justify-center gap-1.5"
        >
          <X size={16} strokeWidth={2.5} />
          Close
        </button>
        <button
          type="button"
          onClick={handlePrint}
          className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          <Printer size={16} strokeWidth={2.5} />
          Print
        </button>
      </div>

      <style>{`
        @media print {
          @page {
            margin: 0;
            size: auto;
          }
          body * {
            visibility: hidden;
          }
          html, body {
            background-color: white !important;
            height: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          #printable-inner-qr, #printable-inner-qr * {
            visibility: visible;
          }
          #printable-inner-qr {
            position: fixed !important;
            left: 50% !important;
            top: 50% !important;
            transform: translate(-50%, -50%) !important;
            margin: 0 !important;
            padding: 8px !important;
            border: none !important;
            background: white !important;
          }
          #qr-box {
            padding: 4px !important;
            border: 1px solid #e2e8f0 !important;
            border-radius: 6px !important;
          }
          .qr-svg-print {
            width: 4cm !important;
            height: 4cm !important;
          }
          .no-print {
            display: none !important;
          }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>
    </div>
  );
}
