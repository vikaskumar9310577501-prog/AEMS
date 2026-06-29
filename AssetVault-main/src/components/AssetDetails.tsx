import { X, Cpu, Monitor, ShieldCheck, User, Info, Edit2, Trash2, Settings, Link as LinkIcon, ExternalLink, ChevronDown, History, RotateCcw } from "lucide-react";
import { Asset, type AssetFormData } from "../types";
import { useNavigate } from "react-router-dom";
import { useState, useEffect, useMemo } from "react";
import { toast } from "react-hot-toast";
import { useEmployees } from "../hooks/useEmployees";
import { useApp } from "../context/AppProvider";
import { motion } from "motion/react";
import { ReactNode, useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";
import { buildScanUrl } from "../lib/scanId";
import DeviceThumb from "./DeviceThumb";
import { getDocumentViewUrl } from "../lib/fileUrls";
import { looksLikeEmail, looksLikeUrl, looksLikeDate, formatSelectedTypeLabel } from "../lib/assetDisplay";
import { formatStoredDateTime, isDateFieldLabel } from "../lib/formatDisplayDate";
import { SOFTWARE_LICENSE_CATEGORY } from "../lib/softwareLicense";

const displayAssetStatus = (status?: string) => (status === "Missing" ? "Lost" : status || "Available");

interface AssetDetailsProps {
  asset: Asset;
  layout?: "modal" | "page";
  onClose?: () => void;
  onEdit: (asset: Asset) => void;
  onDelete: (id: number) => void;
  role?: string;
}

export default function AssetDetails({
  asset,
  layout = "modal",
  onClose,
  onEdit,
  onDelete,
  role,
}: AssetDetailsProps) {
  const navigate = useNavigate();
  const scanUrl = buildScanUrl(asset);
  const isPage = layout === "page";

  const { handleSubmit, deassignAsset, fetchAssets, user } = useApp();
  const { employees } = useEmployees({ autoLoad: true });
  
  const [showDropdown, setShowDropdown] = useState(false);
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [deassigning, setDeassigning] = useState(false);

  const [history, setHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const loadHistory = useCallback(() => {
    if (!asset.id) return;
    setHistoryLoading(true);
    fetch(`${import.meta.env.VITE_API_BASE_URL || ""}/api/assets/${encodeURIComponent(asset.id)}/history`)
      .then(r => r.json())
      .then(data => {
        setHistory(data.history || []);
      })
      .catch(() => setHistory([]))
      .finally(() => setHistoryLoading(false));
  }, [asset.id]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const isAssignedAsset = !!(
    asset.employeeId?.trim() ||
    asset.contactName?.trim() ||
    asset.contactEmail?.trim()
  );

  const currentHolderSince = useMemo(() => {
    if (!isAssignedAsset) return "";
    const active = history.find((ev) => ev.action === "Assign" || ev.action === "Transfer");
    return asset.assignedDate || active?.assignedDate || active?.date || "";
  }, [asset.assignedDate, history, isAssignedAsset]);

  const durationBetween = useCallback((start?: string, end?: string) => {
    const startTime = Date.parse(String(start || ""));
    if (Number.isNaN(startTime)) return "";
    const endTime = end ? Date.parse(end) : Date.now();
    if (Number.isNaN(endTime)) return "";
    const days = Math.max(0, Math.ceil((endTime - startTime) / (24 * 60 * 60 * 1000)));
    if (days <= 1) return "1 day";
    if (days < 30) return `${days} days`;
    const months = Math.floor(days / 30);
    const remDays = days % 30;
    return remDays ? `${months} mo ${remDays} days` : `${months} mo`;
  }, []);

  const displayAssignedDate = useMemo(() => {
    if (asset.assignedDate?.trim()) return asset.assignedDate;
    if (history.length > 0) {
      const assignEvent = history.find(
        (ev) => ev.action === "Assign" || ev.action === "Transfer" || ev.assignedDate || ev.date
      );
      return assignEvent?.assignedDate || assignEvent?.date || "";
    }
    if (asset.employeeId?.trim() || asset.contactName?.trim()) {
      return asset.updatedDate || asset.createdDate || "";
    }
    return "";
  }, [asset.assignedDate, asset.employeeId, asset.contactName, asset.updatedDate, asset.createdDate, history]);

  const isMissingOrDamaged =
    asset.status?.toLowerCase() === "missing" ||
    asset.status?.toLowerCase() === "lost" ||
    asset.status?.toLowerCase() === "damaged" ||
    (asset.status?.toLowerCase() === "available" && !!asset.employeeId);

  const handleDeassign = async () => {
    if (!isAssignedAsset || deassigning) return;
    if (!window.confirm("Deassign this asset from the current employee and mark it available?")) return;
    setDeassigning(true);
    try {
      await deassignAsset(asset, {
        updatedBy: user?.email || user?.role || "System",
        remarks: "Asset returned / deassigned from asset detail",
      });
      toast.success("Asset deassigned");
      await fetchAssets({ silent: true, force: true });
      loadHistory();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to deassign asset");
    } finally {
      setDeassigning(false);
    }
  };

  const handleReassignSubmit = async () => {
    if (!selectedEmployeeId) {
      toast.error("Please select an employee");
      return;
    }
    const emp = employees.find((e) => e.employeeId === selectedEmployeeId);
    if (!emp) return;

    if (asset.employeeId && asset.employeeId !== selectedEmployeeId) {
      toast.error("Asset already assigned");
      return;
    }

    const updatedAssetFormData: AssetFormData = {
      ...asset,
      employeeId: emp.employeeId,
      contactName: emp.name,
      contactEmail: emp.email,
      contactMobile: emp.phone || "",
      department: emp.department || "",
      status: "Assigned",
    };

    try {
      await handleSubmit(updatedAssetFormData, asset);
      setShowReassignModal(false);
      if (onClose) onClose();
    } catch (err) {
      // Handled by handleSubmit
    }
  };
  const isSoftwareCategory = (asset.mainCategory || "") === SOFTWARE_LICENSE_CATEGORY;
  const isCctvDevice =
    asset.assetType === "Camera" ||
    asset.assetType === "NVR" ||
    asset.subCategory === "CCTV / Security Device";
  const cctvLocationName =
    asset.dynamicDetails?.location_name?.trim() || asset.hostName?.trim() || "";

  const openScanPage = useCallback(() => {
    window.open(scanUrl, "_blank", "noopener,noreferrer");
  }, [scanUrl]);

  const Section = ({ title, children, icon: Icon }: { title: string; children: ReactNode; icon: typeof Info }) => (
    <div className="space-y-4">
      <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
        <Icon className="text-blue-500" size={18} />
        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">{title}</h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>
    </div>
  );

  const sanitizeFieldDisplay = (label: string, value?: string): string => {
    const v = (value || "").trim();
    if (!v) return "—";
    const labelLower = label.toLowerCase();
    const isEmailField = labelLower.includes("email");
    const isMobileField = labelLower.includes("mobile");
    const isHardwareField =
      labelLower.includes("cpu") ||
      labelLower.includes("ram") ||
      labelLower.includes("storage") ||
      labelLower.includes("windows") ||
      labelLower.includes("mac");
    if (isHardwareField && (looksLikeEmail(v) || looksLikeUrl(v) || looksLikeDate(v))) {
      return "— (re-save asset to fix mapping)";
    }
    if (isEmailField && looksLikeUrl(v)) {
      return "— (document URL in email field — re-save asset)";
    }
    if (isMobileField && (looksLikeUrl(v) || looksLikeEmail(v))) {
      return "— (re-save asset to fix mapping)";
    }
    if (isDateFieldLabel(label) || looksLikeDate(v)) {
      return formatStoredDateTime(v);
    }
    return v;
  };

  const Field = ({ label, value, color = "text-slate-900" }: { label: string; value?: string; color?: string }) => (
    <div className="space-y-1">
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
      <p className={`text-sm font-black ${color}`}>{sanitizeFieldDisplay(label, value)}</p>
    </div>
  );

  const header = (
    <div className={`p-6 bg-slate-50 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start gap-4 ${isPage ? "rounded-t-2xl" : ""}`}>
      <div className="flex gap-4 sm:gap-6">
        <DeviceThumb
          assetType={asset.assetType}
          mainCategory={asset.mainCategory}
          subCategory={asset.subCategory}
          imageUrl={asset.imageUrl}
          size="md"
          className={isPage ? "w-20 h-20" : "w-14 h-14"}
        />
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded uppercase font-mono">
              #{String(asset.id || 0).padStart(3, "0")}
            </span>
            {(asset.uniqueCode || asset.assetCode) && (
              <span className="text-[10px] font-black text-slate-400 bg-slate-200 px-2 py-0.5 rounded uppercase font-mono">
                {asset.uniqueCode || asset.assetCode}
              </span>
            )}
            {asset.status && (
              <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded uppercase">
                {displayAssetStatus(asset.status)}
              </span>
            )}
          </div>
          <h2 className="text-xl lg:text-2xl font-black text-slate-900 mt-1 uppercase tracking-tight">
            {asset.assetName || `${asset.make} ${asset.model}`}
          </h2>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            {asset.mainCategory || "IT Assets"} · {formatSelectedTypeLabel(asset)}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 items-center w-full sm:w-auto">
        <div className="flex gap-2 border-slate-200 sm:border-r sm:pr-4 items-center">
          <button
            type="button"
            onClick={() => onEdit(asset)}
            className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-2"
            title="Edit Asset"
          >
            <Edit2 size={18} />
            <span className="text-[10px] font-black uppercase">Edit</span>
          </button>
          {role === "IT Admin" && (
            <button
              type="button"
              onClick={() => asset.id != null && onDelete(asset.id as number)}
              className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-2"
              title="Delete Asset"
            >
              <Trash2 size={18} />
              <span className="text-[10px] font-black uppercase">Delete</span>
            </button>
          )}
          {isMissingOrDamaged && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowDropdown(!showDropdown)}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm transition-all"
              >
                Recovered Actions <ChevronDown size={12} />
              </button>
              {showDropdown && (
                <div className="absolute right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-50 py-1 min-w-[120px] font-sans">
                  <button
                    type="button"
                    onClick={() => {
                      setShowDropdown(false);
                      void handleDeassign();
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-slate-50 text-xs font-bold text-slate-700 uppercase tracking-wider"
                  >
                    Deassign
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowDropdown(false);
                      setShowReassignModal(true);
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-slate-50 text-xs font-bold text-slate-700 uppercase tracking-wider"
                  >
                    Reassign
                  </button>
                </div>
              )}
            </div>
          )}
          {isAssignedAsset && !isMissingOrDamaged && role !== "User" && (
            <button
              type="button"
              onClick={() => void handleDeassign()}
              disabled={deassigning}
              className="p-2 text-slate-500 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
              title="Deassign asset"
            >
              <RotateCcw size={18} />
              <span className="text-[10px] font-black uppercase">
                {deassigning ? "Returning" : "Deassign"}
              </span>
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={openScanPage}
          className="group p-3 bg-white rounded-xl border border-slate-200 shadow-sm hover:border-blue-400 transition-all text-left"
          title="Open QR scan page"
        >
          <QRCodeSVG value={scanUrl} size={isPage ? 96 : 80} level="H" className="pointer-events-none" />
          <span className="mt-1 flex items-center justify-center gap-1 text-[8px] font-bold text-blue-600 uppercase tracking-wider opacity-80 group-hover:opacity-100">
            <ExternalLink size={10} /> Open scan
          </span>
        </button>
        {!isPage && onClose && (
          <button type="button" onClick={onClose} className="p-2 hover:bg-slate-200 rounded-lg transition-colors">
            <X size={20} />
          </button>
        )}
      </div>
    </div>
  );

  const body = (
    <div className={`flex-1 overflow-y-auto p-6 lg:p-8 space-y-8 ${isPage ? "" : ""}`}>
      <div className="flex items-center justify-between p-4 bg-blue-50 border border-blue-100 rounded-xl">
        <p className="text-xs font-bold text-blue-800">Tap the QR code to open the scan page (PDF).</p>
        <button
          type="button"
          onClick={openScanPage}
          className="text-xs font-black uppercase text-blue-600 hover:text-blue-800 flex items-center gap-1 shrink-0"
        >
          Open scan <ExternalLink size={12} />
        </button>
      </div>

      <Section title="General Information" icon={Info}>
        <Field label="Location" value={asset.location} />
        <Field label="Plant Name" value={asset.plantCode} />
        {!isCctvDevice && <Field label="Employee Department" value={asset.department} />}
        <Field label="Main Category" value={asset.mainCategory || "IT Assets"} color="text-indigo-600" />
        <Field label="Asset Type" value={formatSelectedTypeLabel(asset)} color="text-blue-600" />
        <Field
          label={
            asset.mainCategory === "Software / License Assets"
              ? "License Key"
              : (asset.mainCategory || "IT Assets") === "Vehicle Assets"
              ? "Chassis / Engine No."
              : "Serial Number"
          }
          value={asset.serialNumber}
        />
        <Field label="Condition" value={asset.condition || "Good"} color="text-amber-600" />
        <Field label="Status" value={displayAssetStatus(asset.status)} color="text-emerald-600 font-bold" />
        {asset.accountAssetCode && (
          <Field label="Account Asset Code" value={asset.accountAssetCode} />
        )}
      </Section>

      {(asset.mainCategory || "IT Assets") === "IT Assets" && (
          <Section title="Network & Tech Specifications" icon={Cpu}>
            {["Laptop", "Desktop"].includes(asset.assetType) && (
              <>
                <Field label="CPU" value={asset.cpu} />
                <Field label="RAM" value={asset.ram} />
                <Field label="Storage (SSD)" value={asset.ssd} />
                <Field label="Windows Version" value={asset.windowsVersion} />
              </>
            )}
            <Field label="IP Address" value={asset.ipAddress} color="text-green-600 font-mono" />
            {isCctvDevice ? (
              cctvLocationName ? (
                <Field label="Location Name" value={cctvLocationName} />
              ) : null
            ) : (
              <Field label="Host Name" value={asset.hostName} color="text-purple-600 font-mono" />
            )}
            {asset.macAddress?.trim() && (
              <div className={["Laptop", "Desktop"].includes(asset.assetType) ? "" : "sm:col-span-2"}>
                <Field label="MAC Address" value={asset.macAddress} color="text-slate-500 font-mono" />
              </div>
            )}
          </Section>
        )}

      <Section title="Purchase & Vendor" icon={ShieldCheck}>
        <Field label="Vendor Name" value={asset.vendorName} />
        <Field label="PO Number" value={asset.invoiceNumber || "—"} />
        <Field label="Purchase Date" value={asset.purchaseDate || "—"} />
        <Field label="Purchase Cost" value={asset.purchaseCost ? `₹${asset.purchaseCost}` : "—"} />
        <Field label="Warranty Start" value={asset.warrantyStartDate} />
        <Field label="Warranty Exp" value={asset.warrantyEndDate} color="text-red-500" />
      </Section>

      {!isSoftwareCategory && asset.maintenanceRequired === "Yes" && (
        <Section title="Maintenance Logs" icon={Settings}>
          <Field label="Maintenance Status" value="Required" color="text-amber-500" />
          <Field label="Last Maintenance Date" value={asset.lastMaintenanceDate || "—"} />
          <Field label="Next Maintenance Date" value={asset.nextMaintenanceDate || "—"} color="text-red-500" />
        </Section>
      )}

      {!isSoftwareCategory && asset.amcVendor && (
        <Section title="AMC Details" icon={ShieldCheck}>
          <Field label="Asset ID" value={asset.assetCode || String(asset.id)} />
          <Field label="Asset Name" value={asset.assetName || `${asset.make} ${asset.model}`} />
          <Field label="AMC Vendor" value={asset.amcVendor} />
          <Field label="AMC Cost" value={asset.amcCost ? `₹${asset.amcCost}` : "—"} />
          <Field label="AMC Start Date" value={asset.amcStartDate} />
          <Field label="AMC End Date" value={asset.amcEndDate} color="text-red-500" />
        </Section>
      )}

      {(asset.mainCategory || "IT Assets") === "IT Assets" &&
        asset.assetType === "Desktop" &&
        (asset.monitorSerial ||
          asset.monitorAssetCode ||
          asset.keyboardSerial ||
          asset.keyboardAssetCode ||
          asset.mouseSerial ||
          asset.mouseAssetCode) && (
          <Section title="Peripherals" icon={Monitor}>
            <Field label="Monitor Serial" value={asset.monitorSerial} />
            <Field label="Monitor Asset Code" value={asset.monitorAssetCode} />
            <Field label="Keyboard Serial" value={asset.keyboardSerial} />
            <Field label="Keyboard Asset Code" value={asset.keyboardAssetCode} />
            <Field label="Mouse Serial" value={asset.mouseSerial} />
            <Field label="Mouse Asset Code" value={asset.mouseAssetCode} />
          </Section>
        )}

      <Section title="Remarks & Audit" icon={Settings}>
        <div className="sm:col-span-2">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Remarks</p>
          <p className="text-sm text-slate-700 whitespace-pre-wrap mb-4">{asset.additionalItems || "—"}</p>
        </div>
        <Field label="Created By" value={asset.createdBy || "—"} />
        <Field label="Created Date" value={asset.createdDate || "—"} />
        <Field label="Updated By" value={asset.updatedBy || "—"} />
        <Field label="Updated Date" value={asset.updatedDate || "—"} />
      </Section>

      {role !== "User" && (
        <Section title="Attached Document" icon={LinkIcon}>
          <div className="sm:col-span-2">
            {asset.documentUrl ? (
              <a
                href={getDocumentViewUrl(asset.documentUrl)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:text-blue-700 font-bold underline flex items-center gap-2"
              >
                <LinkIcon size={14} /> Open Document (PDF)
              </a>
            ) : (
              <p className="text-sm text-slate-400 font-medium italic">No document attached.</p>
            )}
          </div>
        </Section>
      )}

      {asset.dynamicDetails && Object.keys(asset.dynamicDetails).some(k => !!asset.dynamicDetails![k] && String(asset.dynamicDetails![k]).trim() !== '') && (
        <Section title="Type-specific details" icon={Info}>
          {Object.entries(asset.dynamicDetails)
            .filter(([_, value]) => !!value && String(value).trim() !== '')
            .map(([fieldKey, value]) => (
            <div key={fieldKey}>
              <Field
                label={fieldKey.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                value={value as string}
                color="text-slate-800"
              />
            </div>
          ))}
        </Section>
      )}

      {!isCctvDevice && (
        <Section title="User Assignment" icon={User}>
          <Field label="Assignee Full Name" value={asset.contactName} color="text-slate-900" />
          <Field label="Assigned Date" value={displayAssignedDate} color="text-slate-900" />
          {isAssignedAsset && currentHolderSince && (
            <Field label="Current Duration" value={durationBetween(currentHolderSince)} color="text-blue-700" />
          )}
          <div>
            <Field label="Employee ID" value={asset.employeeId || "—"} />
            {asset.employeeId?.trim() && isPage && (
              <button
                type="button"
                onClick={() => navigate(`/employees/${encodeURIComponent(asset.employeeId!)}`)}
                className="mt-2 text-xs font-black uppercase text-blue-600 hover:text-blue-800"
              >
                Open employee profile →
              </button>
            )}
          </div>
          <Field label="Email Address" value={asset.contactEmail} />
          <Field label="Mobile Number" value={asset.contactMobile} />
          {isAssignedAsset && role !== "User" && (
            <div className="sm:col-span-2 pt-2">
              <button
                type="button"
                onClick={() => void handleDeassign()}
                disabled={deassigning}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-amber-200 bg-amber-50 text-xs font-black uppercase text-amber-800 hover:bg-amber-100 disabled:opacity-50"
              >
                <RotateCcw size={14} /> {deassigning ? "Deassigning..." : "Deassign from employee"}
              </button>
            </div>
          )}
        </Section>
      )}

      <div className="space-y-4 border-t border-slate-100 pt-6">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
          <History className="text-blue-500" size={18} />
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Asset Lifecycle History</h3>
        </div>
        {historyLoading ? (
          <p className="text-xs text-slate-400 animate-pulse">Loading asset timeline...</p>
        ) : history.length === 0 ? (
          <p className="text-xs text-slate-400 italic font-medium">No history timeline events registered for this asset.</p>
        ) : (
          <ol className="relative border-l-2 border-blue-200 ml-3 pl-4 space-y-4 pb-2 mt-4">
            {history.map((ev, i) => (
              <li key={i} className="ml-6 relative">
                <span className="absolute -left-[23px] top-1 w-3.5 h-3.5 rounded-full bg-blue-500 border-2 border-white flex items-center justify-center shadow-sm" />
                <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wide">
                  Assigned Date: {formatStoredDateTime(ev.assignedDate || ev.date)}
                </p>
                <p className="text-sm font-bold text-slate-800">
                  {ev.action || 'Assign'}
                </p>
                <p className="text-[11px] font-bold text-slate-400 mt-0.5">
                  Duration: {durationBetween(ev.assignmentStartDate || ev.assignedDate || ev.date, ev.returnedDate) || '—'}
                  {!ev.returnedDate && ev.action !== 'Return' ? ' so far' : ''}
                </p>
                <p className="text-xs text-slate-500 mt-0.5 font-medium flex flex-wrap items-center gap-1">
                  {ev.action === 'Return' ? (
                    <>
                      <span>Returned by</span>
                      {ev.previous?.employeeId ? (
                        <button
                          type="button"
                          onClick={() => {
                            if (onClose) onClose();
                            navigate(`/employees/${encodeURIComponent(ev.previous.employeeId!)}`);
                          }}
                          className="font-semibold text-blue-600 hover:underline inline text-xs"
                        >
                          {ev.previous?.contactName || 'Custodian'}
                        </button>
                      ) : (
                        <span className="font-semibold text-slate-700">{ev.previous?.contactName || ev.fromEmployeeName || ev.employeeName || 'Previous'}</span>
                      )}
                      <span>(Assigned by: {ev.assignedBy || 'System'})</span>
                    </>
                  ) : ev.action === 'Transfer' ? (
                    <>
                      <span>Transferred from</span>
                      {ev.previous?.employeeId ? (
                        <button
                          type="button"
                          onClick={() => {
                            if (onClose) onClose();
                            navigate(`/employees/${encodeURIComponent(ev.previous.employeeId!)}`);
                          }}
                          className="font-semibold text-blue-600 hover:underline inline text-xs"
                        >
                          {ev.previous?.contactName || 'Previous'}
                        </button>
                      ) : (
                        <span className="font-semibold text-slate-700">{ev.previous?.contactName || 'Previous'}</span>
                      )}
                      <span>to</span>
                      {ev.next?.employeeId ? (
                        <button
                          type="button"
                          onClick={() => {
                            if (onClose) onClose();
                            navigate(`/employees/${encodeURIComponent(ev.next.employeeId!)}`);
                          }}
                          className="font-semibold text-blue-600 hover:underline inline text-xs"
                        >
                          {ev.next?.contactName || 'New'}
                        </button>
                      ) : (
                        <span className="font-semibold text-slate-700">{ev.next?.contactName || 'New'}</span>
                      )}
                      <span>(By: {ev.assignedBy || 'System'})</span>
                    </>
                  ) : (
                    <>
                      <span>Assigned to</span>
                      {ev.next?.employeeId || ev.employeeId ? (
                        <button
                          type="button"
                          onClick={() => {
                            if (onClose) onClose();
                            navigate(`/employees/${encodeURIComponent(ev.next?.employeeId || ev.employeeId!)}`);
                          }}
                          className="font-semibold text-blue-600 hover:underline inline text-xs"
                        >
                          {ev.next?.contactName || ev.employeeName || ev.contactName || 'Unassigned'}
                        </button>
                      ) : (
                        <span className="font-semibold text-slate-700">{ev.next?.contactName || ev.employeeName || ev.contactName || 'Unassigned'}</span>
                      )}
                      <span>(Assigned by: {ev.assignedBy || 'System'})</span>
                    </>
                  )}
                </p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );

  const card = (
    <div
      className={`bg-white flex flex-col overflow-hidden ${
        isPage
          ? "rounded-2xl border border-slate-200 shadow-sm w-full"
          : "w-full max-w-2xl rounded-2xl shadow-2xl max-h-[90vh]"
      }`}
    >
      {header}
      {body}
    </div>
  );

  if (isPage) {
    return (
      <>
        {card}
        {showReassignModal && (
          <div className="fixed inset-0 bg-slate-900/50 z-[70] flex items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 relative">
              <h3 className="text-lg font-black text-slate-900 mb-4 font-sans">Reassign Asset</h3>
              <p className="text-xs text-slate-500 mb-4 font-sans font-medium">Select an employee to reassign this asset to.</p>
              <div className="space-y-4">
                <select
                  value={selectedEmployeeId}
                  onChange={(e) => setSelectedEmployeeId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/30 font-sans text-slate-700"
                >
                  <option value="">Select Employee...</option>
                  {employees.map((emp) => (
                    <option key={emp.employeeId} value={emp.employeeId}>
                      {emp.employeeId} - {emp.name} ({emp.department})
                    </option>
                  ))}
                </select>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowReassignModal(false)}
                    className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold uppercase tracking-wider font-sans"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleReassignSubmit}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider font-sans shadow-sm"
                  >
                    Assign
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          onClick={(e) => e.stopPropagation()}
        >
          {card}
        </motion.div>
      </motion.div>
      {showReassignModal && (
        <div className="fixed inset-0 bg-slate-900/50 z-[70] flex items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 relative">
            <h3 className="text-lg font-black text-slate-900 mb-4 font-sans">Reassign Asset</h3>
            <p className="text-xs text-slate-500 mb-4 font-sans font-medium">Select an employee to reassign this asset to.</p>
            <div className="space-y-4">
              <select
                value={selectedEmployeeId}
                onChange={(e) => setSelectedEmployeeId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/30 font-sans text-slate-700"
              >
                <option value="">Select Employee...</option>
                {employees.map((emp) => (
                  <option key={emp.employeeId} value={emp.employeeId}>
                    {emp.employeeId} - {emp.name} ({emp.department})
                  </option>
                ))}
              </select>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowReassignModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold uppercase tracking-wider font-sans"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleReassignSubmit}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider font-sans shadow-sm"
                >
                  Assign
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
