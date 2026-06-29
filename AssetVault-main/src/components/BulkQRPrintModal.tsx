import React, { useMemo } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Printer, X } from 'lucide-react';
import { Asset } from '../types';
import { buildScanUrl } from '../lib/scanId';
import { formatSystemDisplayId } from '../lib/assetDisplay';

interface BulkQRPrintModalProps {
  assets: Asset[];
  onClose: () => void;
}

export default function BulkQRPrintModal({ assets, onClose }: BulkQRPrintModalProps) {
  // Generate URLs and Display IDs for all assets
  const qrItems = useMemo(() => {
    return assets.map((asset) => {
      const qrValue = buildScanUrl(asset);
      const displayId = (asset.assetCode || '').trim() || formatSystemDisplayId(asset);
      return {
        id: asset.id,
        qrValue,
        displayId,
      };
    });
  }, [assets]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      <div className="fixed inset-0 bg-slate-900/80 z-[130] flex items-center justify-center p-4 overflow-y-auto no-print">
        <div
          className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <div>
              <h3 className="text-lg font-black text-slate-900">Bulk QR Print Preview</h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Ready to print {assets.length} QR code labels.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-xl transition-all text-slate-400 hover:text-slate-600"
            >
              <X size={20} strokeWidth={2.5} />
            </button>
          </div>

          {/* Preview Body */}
          <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
              Label Sheet Layout Preview (Cut guides enabled for print)
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {qrItems.map((item) => (
                <div
                  key={item.id}
                  className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center gap-3 transition-all hover:border-slate-300"
                >
                  <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 flex items-center justify-center">
                    <QRCodeSVG
                      value={item.qrValue}
                      size={110}
                      level="H"
                      includeMargin={false}
                    />
                  </div>
                  <span className="text-xs font-black text-slate-700 font-mono tracking-tight bg-slate-100 px-2 py-0.5 rounded border border-slate-200/50 w-full text-center truncate">
                    {item.displayId}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 transition-colors uppercase tracking-wider"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-xl transition-colors flex items-center gap-2 shadow-lg shadow-blue-600/20 uppercase tracking-wider"
            >
              <Printer size={15} strokeWidth={2.5} />
              Print Labels
            </button>
          </div>
        </div>
      </div>

      {/* Styles for printing only the grid */}
      <style>{`
        /* Container for print view rendering */
        #printable-bulk-qr-grid {
          display: none;
        }

        @media print {
          @page {
            margin: 15mm 10mm 15mm 10mm;
            size: portrait;
          }
          
          /* Hide standard elements */
          body * {
            visibility: hidden;
            background-color: transparent !important;
            box-shadow: none !important;
          }
          
          html, body {
            background-color: white !important;
            height: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          /* Force printing background colors and adjust exact color rendering */
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* Show only the print grid */
          #printable-bulk-qr-grid, #printable-bulk-qr-grid * {
            visibility: visible;
          }

          #printable-bulk-qr-grid {
            display: grid !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            height: auto !important;
            grid-template-columns: repeat(3, 1fr) !important;
            gap: 20px !important;
            padding: 5px !important;
            background: white !important;
          }

          .bulk-qr-card-print {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            justify-content: center !important;
            border: 1px dashed #94a3b8 !important; /* Cut guides */
            border-radius: 8px !important;
            padding: 15px !important;
            background: white !important;
            text-align: center !important;
          }

          .bulk-qr-svg-wrapper {
            padding: 4px !important;
            background: white !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
          }

          .bulk-qr-svg-print {
            width: 3.5cm !important;
            height: 3.5cm !important;
          }

          .bulk-qr-label-print {
            font-size: 9pt !important;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace !important;
            font-weight: 800 !important;
            margin-top: 10px !important;
            text-align: center !important;
            word-break: break-all !important;
            color: #0f172a !important;
            background-color: #f1f5f9 !important;
            padding: 3px 10px !important;
            border-radius: 4px !important;
            border: 1px solid #cbd5e1 !important;
            max-width: 90% !important;
          }

          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Hidden print container that is active only during print operations */}
      <div id="printable-bulk-qr-grid">
        {qrItems.map((item) => (
          <div key={item.id} className="bulk-qr-card-print">
            <div className="bulk-qr-svg-wrapper">
              <QRCodeSVG
                value={item.qrValue}
                size={140}
                level="H"
                includeMargin={false}
                className="bulk-qr-svg-print"
              />
            </div>
            <div className="bulk-qr-label-print">
              {item.displayId}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
