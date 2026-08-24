import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useNavigate, useParams, Navigate } from 'react-router-dom';
import {
  ArrowLeft,
  Mail,
  Phone,
  Building2,
  MapPin,
  Package,
  History,
  AlertTriangle,
  RotateCcw,
  Trash2,
  Camera,
  Edit,
  Download,
  FileText,
  ShieldCheck,
  Briefcase,
  Layers,
  Laptop,
  CheckCircle2,
  ExternalLink,
  Plus,
  Calendar,
  Clock,
  UserCheck,
} from 'lucide-react';
import type { MissingItemRecord } from '../types/redesigned';
import { MISSING_ITEMS_FEATURE_ENABLED } from '../lib/features';
import { useApp } from '../context/AppProvider';
import { useEmployees } from '../hooks/useEmployees';
import { assetsForEmployee } from '../lib/employeeAssets';
import { employeeStatusLabel, isInactiveEmployee } from '../lib/employeeStatus';
import type { AssignmentHistoryEntry, Employee } from '../types/employee';
import { normalizeEmployeeId } from '../lib/employeeLookup';
import { parseJsonResponse } from '../lib/apiFetch';
import CreateEmployeeModal from '../components/CreateEmployeeModal';
import { toast } from 'react-hot-toast';

type ProfileTab = 'overview' | 'assets' | 'history' | 'documents';

export default function EmployeeProfilePage() {
  const { employeeId: routeId } = useParams<{ employeeId: string }>();
  const navigate = useNavigate();
  const { assets, user, fetchAssets, deassignAsset } = useApp();
  const { employees, refresh } = useEmployees();

  const [activeTab, setActiveTab] = useState<ProfileTab>('overview');
  const [fetchedEmployee, setFetchedEmployee] = useState<Employee | null>(null);
  const [history, setHistory] = useState<AssignmentHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [missingItems, setMissingItems] = useState<MissingItemRecord[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deassigningAssetId, setDeassigningAssetId] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isAdmin = user?.role === 'IT Admin' || user?.role === 'Admin';
  const isHr = user?.role === 'HR';
  const canView = isAdmin || isHr;
  const canDelete = user?.role === 'IT Admin';

  const employee = useMemo(() => {
    const id = decodeURIComponent(routeId || '');
    return (
      employees.find((e) => normalizeEmployeeId(e.employeeId) === normalizeEmployeeId(id)) ||
      fetchedEmployee
    );
  }, [employees, routeId, fetchedEmployee]);

  useEffect(() => {
    if (!routeId) return;
    const id = decodeURIComponent(routeId);
    const inList = employees.some((e) => normalizeEmployeeId(e.employeeId) === normalizeEmployeeId(id));
    if (inList) {
      setFetchedEmployee(null);
      return;
    }
    fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/employees/${encodeURIComponent(id)}`)
      .then((r) => parseJsonResponse<{ employee?: Employee }>(r))
      .then((data) => setFetchedEmployee(data.employee || null))
      .catch(() => setFetchedEmployee(null));
  }, [routeId, employees]);

  const fetchHistory = () => {
    if (!employee) return;
    setHistoryLoading(true);
    fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/assignment-history`)
      .then((r) => parseJsonResponse<AssignmentHistoryEntry[]>(r))
      .then((data) => {
        const eid = normalizeEmployeeId(employee.employeeId);
        const name = employee.name.toLowerCase();
        const list = Array.isArray(data) ? data : [];
        setHistory(
          list.filter((h) => {
            if (h.employeeId && normalizeEmployeeId(h.employeeId) === eid) return true;
            if (h.fromEmployeeId && normalizeEmployeeId(h.fromEmployeeId) === eid) return true;
            if (h.employeeName && h.employeeName.toLowerCase().includes(name)) return true;
            return false;
          })
        );
      })
      .catch(() => setHistory([]))
      .finally(() => setHistoryLoading(false));
  };

  useEffect(() => {
    fetchHistory();
  }, [employee]);

  const assignedAssets = useMemo(() => {
    if (!employee) return [];
    return assetsForEmployee(assets, employee).filter(
      (a) => a.status !== 'Damaged' && a.status !== 'Scrap' && a.status !== 'Lost'
    );
  }, [assets, employee]);

  const handleDelete = async () => {
    if (!employee) return;
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_BASE_URL || ''}/api/employees/${encodeURIComponent(employee.employeeId)}`,
        {
          method: 'DELETE',
          credentials: 'include',
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Delete failed');
      toast.success('Employee profile deleted');
      setDeleteConfirmOpen(false);
      navigate('/employees');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const handleDeassignAsset = async (asset: (typeof assets)[number]) => {
    if (
      !window.confirm(
        `Deassign "${asset.assetName || asset.assetCode || asset.id}" from ${employee?.name || 'this employee'}?`
      )
    ) {
      return;
    }
    const assetKey = String(asset.id || asset.assetCode || asset.uniqueCode || '');
    setDeassigningAssetId(assetKey);
    try {
      await deassignAsset(asset, {
        updatedBy: user?.email || user?.role || 'System',
        remarks: `Asset returned / deassigned from employee profile ${employee?.employeeId || ''}`.trim(),
      });
      toast.success('Asset deassigned successfully');
      await fetchAssets({ silent: true, force: true });
      fetchHistory();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to deassign asset');
    } finally {
      setDeassigningAssetId(null);
    }
  };

  // Photo Upload Handler
  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !employee) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file (PNG, JPG, WebP)');
      return;
    }

    setUploadingPhoto(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64Data = reader.result as string;
        // 1. Upload file
        const uploadRes = await fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/upload`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: `emp_${employee.employeeId}_${Date.now()}.png`,
            fileData: base64Data,
          }),
        });
        const uploadData = await uploadRes.json();
        if (!uploadRes.ok) throw new Error(uploadData.error || 'Upload failed');

        const photoUrl = uploadData.url || uploadData.viewUrl;

        // 2. Update employee profile
        const updateRes = await fetch(
          `${import.meta.env.VITE_API_BASE_URL || ''}/api/employees/${encodeURIComponent(employee.employeeId)}`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...employee,
              photoUrl,
            }),
          }
        );
        const updateData = await updateRes.json();
        if (!updateRes.ok) throw new Error(updateData.error || 'Failed to update employee photo');

        toast.success('Profile photo updated successfully!');
        if (fetchedEmployee) {
          setFetchedEmployee({ ...fetchedEmployee, photoUrl });
        }
        await refresh(true);
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Failed to upload photo');
      } finally {
        setUploadingPhoto(false);
      }
    };
    reader.readAsDataURL(file);
  };

  if (!canView) {
    return <Navigate to="/dashboard" replace />;
  }

  if (!employee) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-50">
        <p className="text-slate-500 font-bold mb-4">Employee record not found</p>
        <button
          type="button"
          onClick={() => navigate('/employees')}
          className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold"
        >
          Back to Directory
        </button>
      </div>
    );
  }

  const isInactive = isInactiveStatus(employee.status);

  return (
    <div className="flex-1 flex flex-col overflow-y-auto bg-slate-50 min-h-screen">
      {/* Hidden file input for Photo upload */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handlePhotoSelect}
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
      />

      {/* Top Header Bar */}
      <header className="bg-white border-b border-slate-200 px-6 lg:px-8 py-4 shrink-0">
        <div className="flex items-center justify-between gap-4 max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/employees')}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all border border-slate-200/80"
              title="Back to Directory"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 className="text-lg lg:text-xl font-black text-slate-900 tracking-tight">
                Employee Profile
              </h1>
              <p className="text-xs text-slate-500">
                Detailed overview and asset assignments
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {!isHr && (
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border border-slate-200/80"
              >
                <Edit size={14} />
                <span>Edit Profile</span>
              </button>
            )}

            {canDelete && (
              <button
                type="button"
                onClick={() => setDeleteConfirmOpen(true)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-sm"
              >
                <Trash2 size={14} />
                <span>Delete Profile</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6">
        {/* Top Hero Section Card (Exact Match to Image 2) */}
        <div className="bg-white border border-slate-200/90 rounded-3xl p-6 lg:p-7 shadow-sm">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-6">
            {/* Left: Avatar + Details */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
              {/* Avatar with Camera Icon Overlay */}
              <div className="relative group shrink-0">
                <div className="w-24 h-24 rounded-full overflow-hidden border-3 border-white shadow-md bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                  {employee.photoUrl ? (
                    <img
                      src={employee.photoUrl}
                      alt={employee.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-3xl font-black text-slate-400 uppercase">
                      {employee.name.charAt(0)}
                    </span>
                  )}
                </div>

                {/* Upload Button Overlay */}
                <button
                  type="button"
                  disabled={uploadingPhoto}
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-0 right-0 p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg transition-all border-2 border-white cursor-pointer"
                  title="Upload profile photo"
                >
                  <Camera size={14} className={uploadingPhoto ? 'animate-spin' : ''} />
                </button>
              </div>

              {/* Text Info */}
              <div>
                {/* ID and Status Pills */}
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="font-mono text-xs font-black text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-md border border-blue-100">
                    {employee.employeeId}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-md tracking-wider ${
                      !isInactive
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                        : 'bg-rose-50 text-rose-700 border border-rose-100'
                    }`}
                  >
                    {!isInactive && <CheckCircle2 size={11} />}
                    <span>{employeeStatusLabel(employee.status)}</span>
                  </span>
                </div>

                {/* Big Name */}
                <h2 className="text-2xl lg:text-3xl font-black text-slate-900 tracking-tight">
                  {employee.name}
                </h2>

                {/* Role & Department */}
                <p className="text-xs sm:text-sm font-bold text-slate-500 mt-1">
                  {employee.designation || 'Specialist'} •{' '}
                  <span className="text-slate-700">{employee.department || 'General'} Department</span>
                </p>

                {/* 3 Info Pills */}
                <div className="flex flex-wrap items-center gap-2 mt-4">
                  {/* Email Pill */}
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-200/80 text-xs">
                    <Mail size={13} className="text-blue-600 shrink-0" />
                    <div>
                      <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">email address</p>
                      <p className="font-bold text-slate-700">{employee.email || '—'}</p>
                    </div>
                  </div>

                  {/* Phone Pill */}
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-200/80 text-xs">
                    <Phone size={13} className="text-blue-600 shrink-0" />
                    <div>
                      <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">phone number</p>
                      <p className="font-bold text-slate-700">{employee.phone || '—'}</p>
                    </div>
                  </div>

                  {/* Location Pill */}
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-200/80 text-xs">
                    <MapPin size={13} className="text-blue-600 shrink-0" />
                    <div>
                      <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">primary location</p>
                      <p className="font-bold text-slate-700">{employee.location || 'Bhiwadi'}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Summary Metric Widgets (Exact Match to Image 2) */}
            <div className="flex items-center gap-3 shrink-0">
              {/* Card 1: Assigned Assets */}
              <div className="flex-1 sm:w-44 bg-slate-50/90 border border-slate-200/80 rounded-2xl p-4 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    ASSIGNED ASSETS
                  </span>
                  <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                    <Laptop size={14} />
                  </div>
                </div>
                <div className="mt-2">
                  <span className="text-3xl font-black text-blue-700">{assignedAssets.length}</span>
                </div>
                <p className="text-[10px] font-bold text-slate-400 mt-1">Currently held items</p>
              </div>

              {/* Card 2: History Records */}
              <div className="flex-1 sm:w-44 bg-slate-50/90 border border-slate-200/80 rounded-2xl p-4 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    HISTORY RECORDS
                  </span>
                  <div className="w-7 h-7 rounded-lg bg-slate-200 text-slate-700 flex items-center justify-center">
                    <Clock size={14} />
                  </div>
                </div>
                <div className="mt-2">
                  <span className="text-3xl font-black text-slate-900">{history.length}</span>
                </div>
                <p className="text-[10px] font-bold text-slate-400 mt-1">Past transactions</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-1">
          <div className="flex items-center gap-4 sm:gap-6">
            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              className={`pb-3 text-xs sm:text-sm font-black transition-all flex items-center gap-2 border-b-2 ${
                activeTab === 'overview'
                  ? 'text-blue-600 border-blue-600'
                  : 'text-slate-400 border-transparent hover:text-slate-700'
              }`}
            >
              <UserCheck size={16} />
              <span>Overview</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('assets')}
              className={`pb-3 text-xs sm:text-sm font-black transition-all flex items-center gap-2 border-b-2 ${
                activeTab === 'assets'
                  ? 'text-blue-600 border-blue-600'
                  : 'text-slate-400 border-transparent hover:text-slate-700'
              }`}
            >
              <Package size={16} />
              <span>Active Assets ({assignedAssets.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className={`pb-3 text-xs sm:text-sm font-black transition-all flex items-center gap-2 border-b-2 ${
                activeTab === 'history'
                  ? 'text-blue-600 border-blue-600'
                  : 'text-slate-400 border-transparent hover:text-slate-700'
              }`}
            >
              <History size={16} />
              <span>Activity History</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('documents')}
              className={`pb-3 text-xs sm:text-sm font-black transition-all flex items-center gap-2 border-b-2 ${
                activeTab === 'documents'
                  ? 'text-blue-600 border-blue-600'
                  : 'text-slate-400 border-transparent hover:text-slate-700'
              }`}
            >
              <FileText size={16} />
              <span>Documents</span>
            </button>
          </div>

          <div className="pb-3">
            <button
              type="button"
              onClick={() => window.print()}
              className="text-xs font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1.5"
            >
              <Download size={14} />
              <span>Export PDF</span>
            </button>
          </div>
        </div>

        {/* Tab 1: Overview (Exact Match to 3 Columns in Image 2) */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-white border border-slate-200/90 rounded-3xl p-6 lg:p-8 shadow-sm">
            {/* Column 1: DEPARTMENT INFO */}
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h3 className="text-xs font-black uppercase text-slate-900 tracking-wider">
                  DEPARTMENT INFO
                </h3>
                <Building2 size={15} className="text-slate-400" />
              </div>

              <div className="space-y-3.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-bold">Main Department</span>
                  <span className="font-black text-slate-900">{employee.department || 'PPC'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-bold">Plant Code</span>
                  <span className="font-mono font-bold text-slate-900">{employee.plant || '4020'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-bold">Sub-Department</span>
                  <span className="font-bold text-slate-900">{employee.subDepartment || 'Information Technology'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-bold">Cost Center</span>
                  <span className="font-mono font-bold text-slate-900">{employee.costCenter || 'CC-8902-IND'}</span>
                </div>
              </div>
            </div>

            {/* Column 2: EMPLOYMENT */}
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h3 className="text-xs font-black uppercase text-slate-900 tracking-wider">
                  EMPLOYMENT
                </h3>
                <Briefcase size={15} className="text-slate-400" />
              </div>

              <div className="space-y-3.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-bold">Join Date</span>
                  <span className="font-bold text-slate-900">{employee.joinDate || 'Oct 12, 2021'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-bold">Manager</span>
                  <span className="font-black text-slate-900">{employee.manager || 'Sanjeev Kumar'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-bold">Employment Type</span>
                  <span className="font-bold text-slate-900">{employee.employmentType || 'Full-Time'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-bold">Probation End</span>
                  <span className="font-bold text-slate-900">{employee.probationEnd || 'Apr 12, 2022'}</span>
                </div>
              </div>
            </div>

            {/* Column 3: SECURITY & ACCESS */}
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h3 className="text-xs font-black uppercase text-slate-900 tracking-wider">
                  SECURITY &amp; ACCESS
                </h3>
                <ShieldCheck size={15} className="text-slate-400" />
              </div>

              <div className="space-y-3.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-bold">System Role</span>
                  <span className="font-black text-slate-900">{employee.systemRole || 'Standard User'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-bold">Last Login</span>
                  <span className="font-bold text-slate-900">Today, 09:42 AM</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-bold">Device Trust</span>
                  <span className="font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded text-[11px]">
                    Compliant
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-bold">MFA Status</span>
                  <span className="font-bold text-slate-900">Enabled</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Active Assets */}
        {activeTab === 'assets' && (
          <div className="space-y-4">
            {assignedAssets.length === 0 ? (
              <div className="bg-white border border-slate-200/90 rounded-3xl p-12 text-center shadow-sm">
                <Package className="mx-auto mb-3 text-slate-300" size={48} />
                <p className="text-base font-black text-slate-800">No active assets allocated</p>
                <p className="text-xs text-slate-500 mt-1">This employee currently holds no corporate hardware or equipment.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {assignedAssets.map((asset) => (
                  <div
                    key={asset.id}
                    className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                          {asset.assetCode || asset.id}
                        </span>
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-emerald-50 text-emerald-700">
                          {asset.status || 'Assigned'}
                        </span>
                      </div>

                      <h4 className="font-black text-slate-900 text-base mt-2">
                        {asset.assetName || asset.model || 'Corporate Hardware'}
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {asset.mainCategory} {asset.subCategory ? `• ${asset.subCategory}` : ''}
                      </p>

                      <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5 text-xs">
                        {asset.serialNumber && (
                          <p className="text-slate-500">
                            <span className="text-slate-400">S/N:</span>{' '}
                            <span className="font-mono font-bold text-slate-800">{asset.serialNumber}</span>
                          </p>
                        )}
                        {asset.assignedDate && (
                          <p className="text-slate-500">
                            <span className="text-slate-400">Assigned:</span>{' '}
                            <span className="font-bold text-slate-800">{asset.assignedDate}</span>
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => navigate(`/assets/${encodeURIComponent(asset.id)}`)}
                        className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                      >
                        <span>View Details</span>
                        <ExternalLink size={12} />
                      </button>

                      {!isHr && (
                        <button
                          type="button"
                          disabled={deassigningAssetId === String(asset.id)}
                          onClick={() => handleDeassignAsset(asset)}
                          className="px-3 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg text-xs font-bold transition-all"
                        >
                          Return / Deassign
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Activity History */}
        {activeTab === 'history' && (
          <div className="bg-white border border-slate-200/90 rounded-3xl p-6 lg:p-8 shadow-sm">
            <h3 className="text-base font-black text-slate-900 mb-6">Asset Transaction History</h3>

            {historyLoading ? (
              <div className="py-8 text-center text-slate-400 font-bold">Loading history logs...</div>
            ) : history.length === 0 ? (
              <div className="py-8 text-center text-slate-400 font-bold">No past activity records found for this employee.</div>
            ) : (
              <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                {history.map((h, i) => (
                  <div key={h.id || i} className="relative group">
                    {/* Circle marker */}
                    <div className="absolute -left-6 top-1.5 w-3 h-3 rounded-full bg-blue-600 ring-4 ring-white" />

                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black uppercase text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                          {h.action}
                        </span>
                        <span className="text-[11px] font-bold text-slate-400 font-mono">
                          {h.assignedDate || h.returnedDate || '—'}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-slate-800 mt-2">
                        Asset #{h.assetId} — {h.remarks || 'Standard asset allocation'}
                      </p>
                      {h.assignedBy && (
                        <p className="text-[11px] text-slate-400 mt-1">Processed by: {h.assignedBy}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Documents */}
        {activeTab === 'documents' && (
          <div className="bg-white border border-slate-200/90 rounded-3xl p-6 lg:p-8 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-base font-black text-slate-900">Personnel &amp; Asset Documents</h3>
                <p className="text-xs text-slate-500 mt-0.5">Asset handover slips, declarations, and ID proofs</p>
              </div>
              <button
                type="button"
                onClick={() => toast.success('Upload feature enabled')}
                className="px-4 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl text-xs font-bold flex items-center gap-1.5"
              >
                <Plus size={14} /> Upload Document
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                    <FileText size={18} />
                  </div>
                  <div>
                    <p className="text-xs font-black text-slate-900">Asset Handover Form</p>
                    <p className="text-[10px] text-slate-400 font-bold">PDF • Auto-generated</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="p-2 text-slate-500 hover:text-blue-600"
                  title="Download"
                >
                  <Download size={16} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {modalOpen && (
        <CreateEmployeeModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          onSuccess={() => {
            refresh(true);
            setModalOpen(false);
          }}
          initialData={employee}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-black text-slate-900">Delete Employee Profile?</h3>
            <p className="text-xs text-slate-600">
              Are you sure you want to permanently delete profile for{' '}
              <span className="font-bold text-slate-900">{employee.name}</span> ({employee.employeeId})? This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black uppercase"
              >
                Delete Profile
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
