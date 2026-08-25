import React, { useState, useMemo, useEffect } from "react";
import {
  Edit2,
  Trash2,
  QrCode,
  MapPin,
  ChevronLeft,
  ChevronRight,
  User,
  Server,
  Tag,
  Building2,
  CheckCircle2,
  Hash,
} from "lucide-react";
import { cn } from "../lib/utils";
import DeviceThumb from "./DeviceThumb";
import { Asset } from "../types";
import { formatSystemDisplayId, formatAssetCodeLabel, formatSelectedTypeLabel, looksLikeEmail, looksLikeUrl } from "../lib/assetDisplay";
import { SOFTWARE_LICENSE_CATEGORY } from "../lib/softwareLicense";
import { SHEET_COLUMNS } from "../lib/sheetColumns";

export type AssetViewMode = "table" | "card" | "grid";

interface AssetTableProps {
  assets: Asset[];
  onEdit: (asset: Asset) => void;
  onDelete: (id: number | string) => void;
  onViewQR: (asset: Asset) => void;
  onViewAsset: (asset: Asset) => void;
  role?: string;
  viewMode?: AssetViewMode;
  selectedAssetIds?: (string | number)[];
  onSelectionChange?: (ids: (string | number)[]) => void;
}

type SortField = 'id' | 'assetName' | 'location' | 'contactName' | 'status' | 'mainCategory';

const isCctvAsset = (asset: Asset) =>
  asset.assetType === "Camera" ||
  asset.assetType === "NVR" ||
  asset.subCategory === "CCTV / Security Device";

const displayAssetStatus = (status?: string) => (status === "Missing" ? "Lost" : status || "Available");

export default function AssetTable({
  assets,
  onEdit,
  onDelete,
  onViewQR,
  onViewAsset,
  role,
  viewMode = "table",
  selectedAssetIds = [],
  onSelectionChange
}: AssetTableProps) {
  const showCheckboxes = role !== 'HR' && !!onSelectionChange && !!selectedAssetIds;
  const [sortField, setSortField] = useState<SortField>('id');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  useEffect(() => {
    setCurrentPage(1);
  }, [assets.length]);

  useEffect(() => {
    setCurrentPage(1);
    if (viewMode === "table") setPageSize(100);
  }, [viewMode]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedAssets = useMemo(() => {
    return [...assets].sort((a, b) => {
      let aVal: any = '';
      let bVal: any = '';

      if (sortField === 'id') {
        aVal = parseInt(String(a.id || 0), 10);
        bVal = parseInt(String(b.id || 0), 10);
      } else if (sortField === 'assetName') {
        aVal = (a.assetName || `${a.make || ''} ${a.model || ''}`).trim().toLowerCase();
        bVal = (b.assetName || `${b.make || ''} ${b.model || ''}`).trim().toLowerCase();
      } else if (sortField === 'location') {
        aVal = (a.location || '').trim().toLowerCase();
        bVal = (b.location || '').trim().toLowerCase();
      } else if (sortField === 'contactName') {
        aVal = (a.contactName || '').trim().toLowerCase();
        bVal = (b.contactName || '').trim().toLowerCase();
      } else if (sortField === 'status') {
        aVal = (a.status || 'Available').trim().toLowerCase();
        bVal = (b.status || 'Available').trim().toLowerCase();
      } else if (sortField === 'mainCategory') {
        aVal = (a.mainCategory || 'IT Assets').trim().toLowerCase();
        bVal = (b.mainCategory || 'IT Assets').trim().toLowerCase();
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [assets, sortField, sortDirection]);

  // Pagination slicing
  const totalItems = sortedAssets.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedAssets = sortedAssets.slice(startIndex, startIndex + pageSize);

  const handleSelectOne = (id: string | number) => {
    if (!onSelectionChange) return;
    if (selectedAssetIds.includes(id)) {
      onSelectionChange(selectedAssetIds.filter((item) => item !== id));
    } else {
      onSelectionChange([...selectedAssetIds, id]);
    }
  };

  const handleSelectAll = () => {
    if (!onSelectionChange) return;
    const allSelected = paginatedAssets.length > 0 && paginatedAssets.every((asset) => selectedAssetIds.includes(asset.id));
    if (allSelected) {
      const idsToRemove = paginatedAssets.map((asset) => asset.id);
      onSelectionChange(selectedAssetIds.filter((id) => !idsToRemove.includes(id)));
    } else {
      const idsToAdd = paginatedAssets.map((asset) => asset.id);
      const newSelection = Array.from(new Set([...selectedAssetIds, ...idsToAdd]));
      onSelectionChange(newSelection);
    }
  };

  if (assets.length === 0) {
    return (
      <div className="py-20 text-center text-neutral-500 font-semibold bg-white border border-slate-200 rounded-2xl shadow-sm">
        No assets found. Try adjusting your search or filters, or add a new asset.
      </div>
    );
  }

  const hideAssigneeColumn = assets.length > 0 && assets.every(isCctvAsset);

  const getStatusBadgeClass = (status?: string) => {
    const s = displayAssetStatus(status);
    switch (s) {
      case "Available":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "Assigned":
      case "In Use":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "Under Maintenance":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "Damaged":
      case "Lost":
        return "bg-rose-600 text-white border-rose-600 animate-pulse font-black shadow-xs";
      case "Scrap":
        return "bg-slate-800 text-white border-slate-900";
      case "Sold":
        return "bg-purple-50 text-purple-700 border-purple-200";
      default:
        return "bg-slate-50 text-slate-700 border-slate-200";
    }
  };

  // Accent color for VEMS-style cards, derived from status
  const getStatusAccent = (status?: string) => {
    const s = displayAssetStatus(status);
    switch (s) {
      case "Available":
        return "bg-emerald-500";
      case "Assigned":
      case "In Use":
        return "bg-blue-500";
      case "Under Maintenance":
        return "bg-amber-500";
      case "Damaged":
      case "Lost":
        return "bg-red-500";
      case "Scrap":
        return "bg-slate-400";
      case "Sold":
        return "bg-purple-500";
      default:
        return "bg-slate-400";
    }
  };

  const renderActions = (asset: Asset) => {
    if (role === 'HR') return null;
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onViewQR(asset);
          }}
          className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
        >
          <QrCode size={16} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit(asset);
          }}
          className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all"
          title="Edit Asset"
        >
          <Edit2 size={16} />
        </button>
        {role === 'IT Admin' && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (asset.id) onDelete(asset.id);
            }}
            className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
            title="Delete Asset"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>
    );
  };

  const handleCardClick = (asset: Asset) => (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('a')) return;
    onViewAsset(asset);
  };

  const PaginationFooter = totalPages > 1 ? (
    <div className="bg-slate-50 border border-slate-200 rounded-2xl mt-4 px-6 py-4 flex items-center justify-between gap-4 font-sans shadow-sm">
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-500">Page size:</span>
        <select
          value={pageSize}
          onChange={(e) => {
            setPageSize(Number(e.target.value));
            setCurrentPage(1);
          }}
          className="text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-slate-700 font-bold focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          {[10, 15, 25, 50, 100].map((sz) => (
            <option key={sz} value={sz}>{sz}</option>
          ))}
        </select>
        <span className="text-xs text-slate-500 ml-4">
          Showing <span className="font-bold text-slate-800">{startIndex + 1}</span> to{" "}
          <span className="font-bold text-slate-800">{Math.min(startIndex + pageSize, totalItems)}</span> of{" "}
          <span className="font-bold text-slate-800">{totalItems}</span> assets
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
          disabled={currentPage === 1}
          className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white"
        >
          <ChevronLeft size={16} />
        </button>
        {Array.from({ length: totalPages }).map((_, i) => {
          const pg = i + 1;
          const isCurrent = currentPage === pg;
          return (
            <button
              key={pg}
              onClick={() => setCurrentPage(pg)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                isCurrent
                  ? "bg-blue-600 text-white shadow-sm shadow-blue-500/10"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
              )}
            >
              {pg}
            </button>
          );
        })}
        <button
          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
          disabled={currentPage === totalPages}
          className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  ) : null;

  // VEMS-style detail row
  const DetailRow = ({ icon: Icon, label, value }: { icon: React.ComponentType<{ size?: number; className?: string }>; label: string; value: React.ReactNode }) => (
    <div className="flex items-center gap-2 text-xs">
      <Icon size={13} className="text-slate-400 shrink-0" />
      <span className="text-slate-400 font-bold w-20 shrink-0">{label}</span>
      <span className="text-slate-700 font-semibold truncate">{value || '—'}</span>
    </div>
  );

  // ===== CARD VIEW =====
  if (viewMode === "card") {
    return (
      <div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
          {paginatedAssets.map((asset, index) => {
            const code = formatAssetCodeLabel(asset);
            const name = asset.assetName || `${asset.make || ''} ${asset.model || ''}`.trim() || 'Unknown Asset';
            const assignee = isCctvAsset(asset) ? '' : (asset.contactName || '');

            return (
              <div
                key={`${asset.id}-${index}`}
                onClick={handleCardClick(asset)}
                className="relative bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden cursor-pointer hover:shadow-md hover:border-slate-300 transition-all group"
              >
                <div className={cn("absolute top-0 left-0 right-0 h-1", getStatusAccent(asset.status))} />
                <div className="p-3.5 sm:p-4 pt-4 sm:pt-4.5">
                  <div className="flex items-start justify-between gap-2.5 mb-2.5">
                    <div className="flex items-start gap-2.5 min-w-0">
                      {showCheckboxes && (
                        <div className="flex items-center self-center pr-1" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedAssetIds.includes(asset.id)}
                            onChange={() => handleSelectOne(asset.id)}
                            className="w-3.5 h-3.5 text-blue-600 bg-slate-50 border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
                          />
                        </div>
                      )}
                      <DeviceThumb
                        assetType={asset.assetType}
                        mainCategory={asset.mainCategory}
                        subCategory={asset.subCategory}
                        imageUrl={asset.imageUrl}
                        size="md"
                      />
                      <div className="min-w-0">
                        <p className="font-black text-slate-900 text-xs font-mono tracking-tight truncate">{code}</p>
                        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-tight truncate">{name}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 uppercase tracking-wider whitespace-nowrap">
                        {asset.mainCategory || 'IT Assets'}
                      </span>
                      <span className={cn(
                        "text-[8px] px-1.5 py-0.5 rounded-full font-black border uppercase tracking-wider whitespace-nowrap",
                        getStatusBadgeClass(asset.status)
                      )}>
                        {displayAssetStatus(asset.status)}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1 mb-2.5">
                    <span className="text-[8px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded-sm font-bold uppercase tracking-widest">
                      {formatSelectedTypeLabel(asset)}
                    </span>
                    {asset.condition && (
                      <span className="text-[8px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded-sm font-bold uppercase tracking-widest">
                        {asset.condition}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1.5 border-t border-slate-100 pt-2 text-[11px]">
                    {!hideAssigneeColumn && (
                      <DetailRow icon={User} label="Assigned" value={assignee || 'Unassigned'} />
                    )}
                    <DetailRow icon={Hash} label="Serial" value={asset.serialNumber} />
                    <DetailRow
                      icon={MapPin}
                      label="Location"
                      value={
                        <span>
                          {asset.location || '—'}
                          {asset.plantCode ? <span className="text-slate-400"> · {asset.plantCode}</span> : null}
                        </span>
                      }
                    />
                    <DetailRow icon={Building2} label="Department" value={asset.department} />
                    <DetailRow icon={Tag} label="Brand" value={asset.make} />
                    {asset.mainCategory !== SOFTWARE_LICENSE_CATEGORY && (
                      <DetailRow icon={Server} label="Model" value={asset.model} />
                    )}
                  </div>

                  {role !== 'HR' && (
                    <div className="flex items-center justify-end mt-2 pt-2 border-t border-slate-100">
                      {renderActions(asset)}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {PaginationFooter}
      </div>
    );
  }

  // ===== GRID VIEW (Next-Gen Cover Banner Cards matching Image 2) =====
  if (viewMode === "grid") {
    return (
      <div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5 sm:gap-4">
          {paginatedAssets.map((asset, index) => {
            const code = formatAssetCodeLabel(asset);
            const name = asset.assetName || `${asset.make || ''} ${asset.model || ''}`.trim() || 'Unknown Asset';
            const assignee = isCctvAsset(asset) ? '' : (asset.contactName || '');
            const statusLabel = displayAssetStatus(asset.status);

            return (
              <div
                key={`${asset.id}-${index}`}
                onClick={handleCardClick(asset)}
                className="group relative bg-white border border-slate-200/90 rounded-xl shadow-xs hover:shadow-lg hover:border-blue-200 hover:-translate-y-0.5 transition-all duration-200 overflow-hidden flex flex-col cursor-pointer"
              >
                {/* Top Cover Banner - Reduced Height for 100% Zoom Fit */}
                <div className="relative h-28 sm:h-32 w-full bg-slate-100 overflow-hidden shrink-0">
                  <DeviceThumb
                    assetType={asset.assetType}
                    mainCategory={asset.mainCategory}
                    subCategory={asset.subCategory}
                    imageUrl={asset.imageUrl}
                    size="cover"
                  />

                  {/* Top-Left Checkbox */}
                  {showCheckboxes && (
                    <div
                      className="absolute top-2 left-2 z-10 bg-white/90 backdrop-blur-md p-1 rounded-md shadow-xs border border-slate-200/50 flex items-center justify-center transition-transform active:scale-95"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={selectedAssetIds.includes(asset.id)}
                        onChange={() => handleSelectOne(asset.id)}
                        className="w-3.5 h-3.5 text-blue-600 bg-white border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
                      />
                    </div>
                  )}

                  {/* Top-Right Category Tag */}
                  <div className="absolute top-2 right-2 z-10 bg-slate-900/60 backdrop-blur-md text-white text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider">
                    {asset.mainCategory || 'IT Assets'}
                  </div>

                  {/* Bottom-Left Overlay Status Badge */}
                  <div className="absolute bottom-2 left-2 z-10">
                    <span
                      className={cn(
                        "text-[9px] px-2 py-0.5 rounded-md font-black uppercase tracking-wider shadow-sm backdrop-blur-md inline-flex items-center gap-1",
                        statusLabel === "Available"
                          ? "bg-emerald-600 text-white shadow-emerald-900/20"
                          : statusLabel === "Assigned" || statusLabel === "In Use"
                          ? "bg-blue-600 text-white shadow-blue-900/20"
                          : statusLabel === "Under Maintenance"
                          ? "bg-amber-500 text-white shadow-amber-900/20"
                          : statusLabel === "Damaged" || statusLabel === "Lost"
                          ? "bg-rose-600 text-white shadow-rose-900/40 animate-pulse ring-2 ring-white/60"
                          : "bg-slate-700 text-white shadow-slate-900/20"
                      )}
                    >
                      {(statusLabel === "Damaged" || statusLabel === "Lost") && (
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white"></span>
                        </span>
                      )}
                      {statusLabel}
                    </span>
                  </div>
                </div>

                {/* Card Body - Compact & Comfortable */}
                <div className="p-3 sm:p-3.5 flex flex-col gap-2 flex-1">
                  <div>
                    <p className="font-mono text-[10px] font-bold text-slate-400 tracking-wider truncate uppercase">
                      {code}
                    </p>
                    <h4 className="font-black text-slate-900 text-sm leading-snug group-hover:text-blue-600 transition-colors truncate mt-0.5">
                      {name}
                    </h4>
                  </div>

                  <div className="space-y-1.5 text-[11px] pt-0.5">
                    <div className="flex items-center gap-1.5 text-slate-600 font-semibold">
                      <MapPin size={13} className="text-slate-400 shrink-0" />
                      <span className="truncate">
                        {asset.location || '—'}
                        {asset.plantCode ? ` · ${asset.plantCode}` : ''}
                      </span>
                    </div>

                    {!hideAssigneeColumn && (
                      <div className="flex items-center gap-1.5 text-slate-600 font-semibold">
                        <User size={13} className="text-slate-400 shrink-0" />
                        <span className="truncate">{assignee || '—'}</span>
                      </div>
                    )}

                    <div className="flex items-center gap-1.5 text-slate-600 font-semibold">
                      <CheckCircle2 size={13} className="text-slate-400 shrink-0" />
                      <span className="truncate">{formatSelectedTypeLabel(asset)}</span>
                    </div>
                  </div>

                  {/* Card Footer Actions */}
                  <div className="flex items-center justify-between mt-auto pt-2 border-t border-slate-100">
                    <div className="text-[9px] font-mono text-slate-400 truncate max-w-[120px]">
                      {asset.serialNumber ? `#${asset.serialNumber}` : ''}
                    </div>

                    {role !== 'HR' && (
                      <div className="flex items-center gap-1">
                        {renderActions(asset)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {PaginationFooter}
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm flex flex-col min-h-0">
      <div className="overflow-auto max-h-[calc(100vh-220px)]">
        <table className="min-w-max text-left border-separate border-spacing-0 text-[11px]">
          <thead>
            <tr>
              {showCheckboxes && (
                <th className="sticky top-0 left-0 z-30 bg-[#eef2f6] border-b border-r border-slate-300 px-2 py-2 w-8 text-center" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={paginatedAssets.length > 0 && paginatedAssets.every((asset) => selectedAssetIds.includes(asset.id))}
                    onChange={handleSelectAll}
                    className="w-3.5 h-3.5 text-blue-600 border-slate-300 rounded cursor-pointer"
                  />
                </th>
              )}
              {SHEET_COLUMNS.map((column, colIndex) => (
                <th
                  key={column.header}
                  className={`sticky top-0 z-20 bg-[#eef2f6] border-b border-r border-slate-300 px-2 py-2 font-black text-slate-700 whitespace-nowrap ${
                    colIndex === 0 && !showCheckboxes ? "left-0 z-30" : ""
                  }`}
                >
                  {column.header}
                </th>
              ))}
              {role !== 'HR' && (
                <th className="sticky top-0 right-0 z-20 bg-[#eef2f6] border-b border-l border-slate-300 px-2 py-2 font-black text-slate-700 whitespace-nowrap">
                  Ops
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {paginatedAssets.map((asset, index) => {
              const handleRowClick = (e: React.MouseEvent) => {
                const target = e.target as HTMLElement;
                if (target.closest("button") || target.closest("a") || target.closest("input")) return;
                onViewAsset(asset);
              };
              return (
                <tr
                  key={`${asset.id}-${index}`}
                  className="hover:bg-[#e8f0fe] cursor-pointer"
                  onClick={handleRowClick}
                >
                  {showCheckboxes && (
                    <td className="sticky left-0 z-10 bg-white border-b border-r border-slate-200 px-2 py-1 text-center" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedAssetIds.includes(asset.id)}
                        onChange={() => handleSelectOne(asset.id)}
                        className="w-3.5 h-3.5 text-blue-600 border-slate-300 rounded cursor-pointer"
                      />
                    </td>
                  )}
                  {SHEET_COLUMNS.map((column) => {
                    const value = column.get(asset);
                    return (
                      <td
                        key={column.header}
                        title={value}
                        className="border-b border-r border-slate-200 px-2 py-1 text-slate-800 whitespace-nowrap max-w-[240px] overflow-hidden text-ellipsis bg-white"
                      >
                        {value}
                      </td>
                    );
                  })}
                  {role !== "HR" && (
                    <td className="sticky right-0 bg-white border-b border-l border-slate-200 px-2 py-1" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button type="button" onClick={() => onViewQR(asset)} className="p-1 text-slate-400 hover:text-blue-600" title="QR">
                          <QrCode size={14} />
                        </button>
                        <button type="button" onClick={() => onEdit(asset)} className="p-1 text-slate-400 hover:text-slate-900" title="Edit">
                          <Edit2 size={14} />
                        </button>
                        {role === "IT Admin" && (
                          <button type="button" onClick={() => asset.id && onDelete(asset.id)} className="p-1 text-slate-400 hover:text-red-500" title="Delete">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex items-center justify-between gap-4 font-sans">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Page size:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-slate-700 font-bold focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {[10, 15, 25, 50, 100].map((sz) => (
                <option key={sz} value={sz}>{sz}</option>
              ))}
            </select>
            <span className="text-xs text-slate-500 ml-4">
              Showing <span className="font-bold text-slate-800">{startIndex + 1}</span> to{" "}
              <span className="font-bold text-slate-800">{Math.min(startIndex + pageSize, totalItems)}</span> of{" "}
              <span className="font-bold text-slate-800">{totalItems}</span> assets
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white"
            >
              <ChevronLeft size={16} />
            </button>
            {Array.from({ length: totalPages }).map((_, i) => {
              const pg = i + 1;
              const isCurrent = currentPage === pg;
              return (
                <button
                  key={pg}
                  onClick={() => setCurrentPage(pg)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                    isCurrent
                      ? "bg-blue-600 text-white shadow-sm shadow-blue-500/10"
                      : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                  )}
                >
                  {pg}
                </button>
              );
            })}
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
