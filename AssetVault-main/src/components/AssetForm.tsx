import React, { useState, useEffect, useLayoutEffect, useRef, useMemo } from "react";
import { toast } from "react-hot-toast";
import { Asset, AssetFormData, AssetType, DesktopAccessories } from "../types";
import { Monitor, User, Cpu, MapPin, LayoutDashboard, ChevronLeft, ChevronRight, Package, Building2, Keyboard, Mouse, Zap, Upload } from "lucide-react";
import { cn } from "../lib/utils";
import { getDevicePreviewUrl, getDevicePreviewLabel, getAssetPreviewUrl } from "../lib/devicePreview";
import { getDocumentViewUrl, getDeviceImageUrl } from "../lib/fileUrls";
import { formatSelectedTypeLabel } from "../lib/assetDisplay";
import DeviceThumb from "./DeviceThumb";
import SmartSelect from "./SmartSelect";
import { APP_NAME, LOGO_SRC } from "../lib/constants";
import { formatStoredDateTime, toDateInputValue } from "../lib/formatDisplayDate";
import WarrantyDateField from "./WarrantyDateField";
import {
  mergeCatalog,
  catalogWithAssetValues,
  getBrandListForAssetType,
  getModelsForBrandAndType,
  addBrandForType,
  addModelForType,
  addVendor,
  addSubCategory,
  setSoftwareSubCategoryImage,
  setSubCategoryImage,
  getLicenseTypeList,
  addLicenseType,
  removeLicenseType,
  addRam,
  addSsd,
  addCpu,
  addWindowsVersion,
  removeVendor,
  removeSubCategory,
  removeRam,
  removeSsd,
  removeCpu,
  removeWindowsVersion,
  removeBrandForType,
  removeModelForType,
  type AssetCatalog,
  getVendorsForCategory,
} from "../lib/assetCatalog";
import { assetToFormData, optionsWithValue } from "../lib/formAsset";
import { MAIN_CATEGORIES, CATEGORY_SUBCATEGORIES, PERIPHERAL_TYPES, IT_PRIMARY_TYPES, PERIPHERAL_GRID_TYPES, CCTV_IT_TYPES, subCategoryForItAssetType } from "../lib/assetCatalogByType";
import { SIDEBAR_CCTV_CATEGORY } from "../lib/dashboardCategories";
import { SOFTWARE_LICENSE_CATEGORY } from "../lib/softwareLicense";
import { validateCorporateEmail } from "../lib/emailValidation";
import { ASSET_CONDITION_OPTIONS, validateNewPurchaseRequirements } from "../lib/assetCondition";
import { useTypeDefinitions } from "../hooks/useTypeDefinitions";
import DynamicAssetForm, { validateDynamicFields } from "./DynamicAssetForm";
import EmployeeSelector from "./EmployeeSelector";
import type { Employee } from "../types/employee";
import { normalizeEmployeeId } from "../lib/employeeLookup";
import { isInactiveEmployee } from "../lib/employeeStatus";
import {
  resolveTypeDefinition,
  emptyDynamicValues,
  applyLegacyFieldMapping,
  legacyToDynamicDetails,
} from "../lib/typeDefinitions";
import {
  applyCategorySelection,
  getEntryFormProfile,
} from "../lib/entryFormProfile";

function getScrollParent(node: HTMLElement | null): HTMLElement | Window {
  if (!node) return window;
  let el: HTMLElement | null = node.parentElement;
  while (el) {
    const { overflowY } = getComputedStyle(el);
    if (/(auto|scroll|overlay)/.test(overflowY) && el.scrollHeight > el.clientHeight + 1) {
      return el;
    }
    el = el.parentElement;
  }
  return window;
}

function resetFormScrollContainers(formEl: HTMLElement | null) {
  if (!formEl) return;

  const scrollers: HTMLElement[] = [];
  let node: HTMLElement | null = formEl.parentElement;
  while (node) {
    const { overflowY } = getComputedStyle(node);
    if (/(auto|scroll|overlay)/.test(overflowY)) {
      scrollers.push(node);
    }
    node = node.parentElement;
  }

  for (const el of scrollers) {
    el.scrollTo({ top: 0, behavior: "smooth" });
  }
  if (window.scrollY > 0) {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

/** Scroll the nearest scroll container so the step anchor sits at the top. */
function scrollStepToStart(anchor: HTMLElement | null, formEl: HTMLElement | null, offset = 16) {
  resetFormScrollContainers(formEl);
  if (!anchor) return;

  requestAnimationFrame(() => {
    const scroller = getScrollParent(anchor);
    if (scroller === window) {
      const top = anchor.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
      return;
    }
    const el = scroller as HTMLElement;
    const top =
      el.scrollTop + anchor.getBoundingClientRect().top - el.getBoundingClientRect().top - offset;
    el.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  });
}

function focusFirstField(root: HTMLElement | null) {
  if (!root) return;
  const target =
    root.querySelector<HTMLElement>('input:not([type="hidden"]):not([disabled]):not([type="file"])') ??
    root.querySelector<HTMLElement>('select:not([disabled])') ??
    root.querySelector<HTMLElement>('textarea:not([disabled])') ??
    root.querySelector<HTMLElement>('[role="button"][tabindex="0"]');
  target?.focus({ preventScroll: true });
}

function focusStepField(step: number, refs: {
  step2Focus: HTMLDivElement | null;
  step3Location: HTMLDivElement | null;
}) {
  if (step === 2) focusFirstField(refs.step2Focus);
  if (step === 3) focusFirstField(refs.step3Location);
}


interface AssetFormProps {
  key?: string | number | null;
  initialData?: Asset;
  onSubmit: (data: AssetFormData) => void | Promise<void>;
  onCancel: () => void;
  loading: boolean;
  /** Full-page registration uses wider layout and spacing */
  layout?: "modal" | "page";
  /** Skip step 1 when category was chosen on the dashboard */
  prefillMainCategory?: string;
  /** Pre-select IT type when opened from Camera / NVR sidebar */
  prefillAssetType?: AssetType;
  hideAssignee?: boolean;
  allowedCategories?: string[];
}

const RAM_OPTIONS = ['4GB', '8GB', '16GB', '32GB', '64GB', '128GB'];
const SSD_OPTIONS = ['128GB', '256GB', '512GB', '1TB', '2TB'];
const CPU_OPTIONS = ['Core i3', 'Core i5', 'Core i7', 'Core i9', 'Ryzen 3', 'Ryzen 5', 'Ryzen 7', 'Ryzen 9', 'Apple M1', 'Apple M2', 'Apple M3', 'Apple M4'];
const WINDOWS_OPTIONS = ['Windows 10 Pro', 'Windows 10 Home', 'Windows 11 Pro', 'Windows 11 Home', 'Linux', 'macOS'];

function applyItAssetTypeSelection(type: AssetType): { assetType: AssetType; subCategory: string } {
  return { assetType: type, subCategory: subCategoryForItAssetType(type) };
}

interface AppSettings {
  locations: string[];
  plants: { code: string; name: string; location: string }[];
  assetFields: { key: string; label: string; enabled: boolean }[];
  catalog?: AssetCatalog;
}

function sameSettingValue(left: unknown, right: unknown): boolean {
  return String(left ?? '').trim().toLowerCase() === String(right ?? '').trim().toLowerCase();
}

export default function AssetForm({ initialData, onSubmit, onCancel, loading, layout = "modal", prefillMainCategory, prefillAssetType, hideAssignee = false, allowedCategories: propAllowedCategories }: AssetFormProps) {
  const isPageLayout = layout === "page";
  const { config: typeConfig } = useTypeDefinitions();
  const [appSettings, setAppSettings] = useState<AppSettings>({ locations: [], plants: [], assetFields: [] });
  const [catalog, setCatalog] = useState<AssetCatalog>(() => mergeCatalog());
  const [dynamicDetails, setDynamicDetails] = useState<Record<string, string>>(() => {
    if (!initialData?.id) return {};
    return assetToFormData(initialData).dynamicDetails || {};
  });
  const [dynamicFieldErrors, setDynamicFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch((import.meta.env.VITE_API_BASE_URL || "") + '/api/settings?refresh=1')
      .then((r) => r.json())
      .then((data) => {
        setAppSettings({
          locations: data.locations || [],
          plants: data.plants || [],
          assetFields: data.assetFields || [],
          catalog: data.catalog,
        });
        setCatalog((prev) => {
          const merged = mergeCatalog(data.catalog);
          if (initialData?.id) {
            return catalogWithAssetValues(
              merged,
              initialData.assetType,
              initialData.make,
              initialData.model
            );
          }
          return merged;
        });
      })
      .catch(() => {});
  }, []);

  const isEditMode = !!initialData?.id;

  const initialFormSnapshot = React.useMemo(() => {
    if (!initialData?.id) return "";
    const fd = assetToFormData(initialData);
    return JSON.stringify({
      id: initialData.id,
      updatedDate: initialData.updatedDate,
      assetCode: fd.assetCode,
      serialNumber: fd.serialNumber,
      make: fd.make,
      model: fd.model,
      assetName: fd.assetName,
      location: fd.location,
      plantCode: fd.plantCode,
      department: fd.department,
      mainCategory: fd.mainCategory,
      subCategory: fd.subCategory,
      assetType: fd.assetType,
    });
  }, [initialData]);

  const persistCatalog = (updater: AssetCatalog | ((prev: AssetCatalog) => AssetCatalog)) => {
    setCatalog((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      fetch((import.meta.env.VITE_API_BASE_URL || "") + '/api/settings', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locations: appSettings.locations,
          plants: appSettings.plants,
          assetFields: appSettings.assetFields,
          catalog: next,
        }),
      }).catch(() => {});
      return next;
    });
  };

  const isFieldEnabled = (key: string) => {
    const field = appSettings.assetFields.find((f) => f.key === key);
    return field ? field.enabled : true;
  };

  const getSubCategories = (mainCategory: string) => {
    const staticSubs = CATEGORY_SUBCATEGORIES[mainCategory] || [];
    const customSubs = catalog.subCategories?.[mainCategory] || [];
    const all = Array.from(new Set([...staticSubs, ...customSubs]));
    const deleted = catalog.deletedOptions?.subCategories || [];
    return all.filter((s) => !deleted.includes(`${mainCategory}:${s}`));
  };

  const [formData, setFormData] = useState<AssetFormData>(() => assetToFormData(initialData));

  const activeTypeDef = React.useMemo(
    () =>
      resolveTypeDefinition(typeConfig, {
        assetTypeId: formData.assetTypeId,
        assetType: formData.assetType,
        mainCategory: formData.mainCategory,
        subCategory: formData.subCategory,
      }),
    [typeConfig, formData.assetTypeId, formData.assetType, formData.mainCategory, formData.subCategory]
  );

  const entryProfile = React.useMemo(
    () => getEntryFormProfile(formData, activeTypeDef, { isEditMode }),
    [formData, activeTypeDef, isEditMode]
  );

  const lastResolvedTypeIdRef = useRef<string | null>(null);

  /** Reload all fields when opening edit or when sheet data refreshes for same asset. */
  useEffect(() => {
    if (!initialData?.id) return;
    const fd = assetToFormData(initialData);
    setFormData(fd);
    setDynamicDetails(fd.dynamicDetails || {});
    const def = resolveTypeDefinition(typeConfig, {
      assetTypeId: fd.assetTypeId,
      assetType: fd.assetType,
      mainCategory: fd.mainCategory,
      subCategory: fd.subCategory,
    });
    lastResolvedTypeIdRef.current = def?.id || fd.assetTypeId || null;
    setFormStep(2);
    setFieldErrors({});
    setMacError(null);
    setIncludeMonitor(!!(initialData.monitorSerial || initialData.monitorAssetCode));
    setIncludeKeyboard(!!(initialData.keyboardSerial || initialData.keyboardAssetCode));
    setIncludeMouse(!!(initialData.mouseSerial || initialData.mouseAssetCode));
    setIncludeUps(!!(initialData.upsSerial || initialData.upsAssetCode));
    setShowAmc(!!initialData.amcVendor);
    setCatalog((c) =>
      catalogWithAssetValues(c, initialData.assetType, initialData.make, initialData.model)
    );
  }, [initialFormSnapshot, initialData, typeConfig]);

  React.useEffect(() => {
    const def = resolveTypeDefinition(typeConfig, {
      assetTypeId: formData.assetTypeId,
      assetType: formData.assetType,
      mainCategory: formData.mainCategory,
      subCategory: formData.subCategory,
    });
    if (!def) {
      lastResolvedTypeIdRef.current = null;
      return;
    }
    setFormData((prev) => (prev.assetTypeId === def.id ? prev : { ...prev, assetTypeId: def.id }));

    if (lastResolvedTypeIdRef.current !== def.id) {
      lastResolvedTypeIdRef.current = def.id;
      setDynamicDetails((prev) => {
        const base = emptyDynamicValues(def.fields);
        if (initialData?.id) {
          const fromAsset = legacyToDynamicDetails(def, formData as unknown as Record<string, unknown>);
          for (const f of def.fields) {
            if (fromAsset[f.key]) base[f.key] = fromAsset[f.key];
          }
          const saved =
            (initialData.dynamicDetails as Record<string, string> | undefined) ||
            (formData.dynamicDetails as Record<string, string> | undefined) ||
            prev;
          for (const f of def.fields) {
            if (saved[f.key]) base[f.key] = saved[f.key];
          }
        }
        return base;
      });
      setDynamicFieldErrors({});
    }
  }, [formData.assetType, formData.mainCategory, formData.subCategory, formData.assetTypeId, typeConfig, initialData?.id]);

  const onDynamicChange = (key: string, value: string) => {
    setDynamicDetails((prev) => {
      const next = { ...prev, [key]: value };
      if (activeTypeDef) {
        const field = activeTypeDef.fields.find((f) => f.key === key);
        if (field?.legacyKey) {
          setFormData((fd) => ({ ...fd, [field.legacyKey!]: value } as AssetFormData));
        }
      }
      return next;
    });
    setDynamicFieldErrors((prev) => {
      const n = { ...prev };
      const field = activeTypeDef?.fields.find((f) => f.key === key);
      if (field && (field.type === 'email' || field.key.toLowerCase().includes('email'))) {
        const emailErr = validateCorporateEmail(value);
        if (emailErr) n[key] = emailErr;
        else delete n[key];
        return n;
      }
      delete n[key];
      return n;
    });
  };

  const [includeMonitor, setIncludeMonitor] = useState(() => !!(initialData?.monitorSerial || initialData?.monitorAssetCode));
  const [includeKeyboard, setIncludeKeyboard] = useState(() => !!(initialData?.keyboardSerial || initialData?.keyboardAssetCode));
  const [includeMouse, setIncludeMouse] = useState(() => !!(initialData?.mouseSerial || initialData?.mouseAssetCode));
  const [includeUps, setIncludeUps] = useState(() => !!(initialData?.upsSerial || initialData?.upsAssetCode));
  const [showAmc, setShowAmc] = useState(() => !!initialData?.amcVendor);

  const [macError, setMacError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [checkingField, setCheckingField] = useState<string | null>(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingPreview, setUploadingPreview] = useState(false);
  const categoryPreviewInputRef = useRef<HTMLInputElement>(null);
  const uniqueTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [formStep, setFormStep] = useState(initialData?.id ? 2 : 1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const mountedRef = useRef(true);
  const formStepRef = useRef(formStep);
  const advanceGuardRef = useRef(false);
  const formTopRef = useRef<HTMLFormElement>(null);
  const step2TopRef = useRef<HTMLElement>(null);
  const step2FocusRef = useRef<HTMLDivElement>(null);
  const step3TopRef = useRef<HTMLDivElement>(null);
  const step3LocationRef = useRef<HTMLDivElement>(null);
  const [saveReady, setSaveReady] = useState(true);
  const [linkedEmployee, setLinkedEmployee] = useState<Employee | null>(null);

  useEffect(() => {
    formStepRef.current = formStep;
  }, [formStep]);

  useEffect(() => {
    const hasAssignee = !!(formData.employeeId?.trim() || formData.contactName?.trim());
    if (!hasAssignee || formData.assignedDate?.trim()) return;
    setFormData((prev) => ({
      ...prev,
      assignedDate: toDateInputValue(new Date().toISOString()),
    }));
  }, [formData.employeeId, formData.contactName, formData.assignedDate]);

  useLayoutEffect(() => {
    const refs = {
      step2Focus: step2FocusRef.current,
      step3Location: step3LocationRef.current,
    };

    if (formStep === 1) {
      scrollStepToStart(formTopRef.current, formTopRef.current);
      return;
    }

    const anchor = formStep === 2 ? step2TopRef.current : step3TopRef.current;
    scrollStepToStart(anchor, formTopRef.current);

    const focusTimer = window.setTimeout(() => focusStepField(formStep, refs), 300);
    return () => window.clearTimeout(focusTimer);
  }, [formStep]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const STEPS = [
    { n: 1, title: "Select Asset", icon: Package },
    { n: 2, title: "Asset Details", icon: Cpu },
    { n: 3, title: "Assignment", icon: Building2 },
  ] as const;

  const isSoftwareCategory = formData.mainCategory === SOFTWARE_LICENSE_CATEGORY;
  const isItCategory = (formData.mainCategory || "IT Assets") === "IT Assets";
  const canUploadPreview = isItCategory
    ? !!formData.assetType?.trim()
    : !!formData.subCategory?.trim();

  const previewUrl = useMemo(() => {
    const assetImage = getDeviceImageUrl(formData.imageUrl);
    if (assetImage) return assetImage;

    const sub = formData.subCategory?.trim() || "";
    const previewKey = isItCategory ? (formData.assetType || "").trim() : sub;
    if (previewKey) {
      const custom = catalog.subCategoryImages?.[previewKey];
      const customImage = getDeviceImageUrl(custom);
      if (customImage) return customImage;
    }
    if (isSoftwareCategory && sub) {
      const custom = catalog.softwareSubCategoryImages?.[sub];
      const customImage = getDeviceImageUrl(custom);
      if (customImage) return customImage;
    }

    return getAssetPreviewUrl(
      formData.mainCategory || "IT Assets",
      sub,
      formData.assetType,
      catalog.subCategoryImages,
      catalog.softwareSubCategoryImages
    );
  }, [
    formData.imageUrl,
    formData.mainCategory,
    formData.subCategory,
    formData.assetType,
    isSoftwareCategory,
    isItCategory,
    catalog.subCategoryImages,
    catalog.softwareSubCategoryImages,
  ]);
  const selectedTypeLabel = formatSelectedTypeLabel({
    assetType: formData.assetType,
    subCategory: formData.subCategory,
    mainCategory: formData.mainCategory,
    assetName: formData.assetName,
  });

  const selectAssetType = (newType: AssetType) => {
    const make = formData.make || "";
    const models = make ? getModelsForBrandAndType(catalog, newType, make) : [];
    const model = models.includes(formData.model) ? formData.model : "";
    const wasPrimary = ["Laptop", "Desktop"].includes(formData.assetType);
    const isPrimary = ["Laptop", "Desktop"].includes(newType);
    const typeDef = resolveTypeDefinition(typeConfig, {
      mainCategory: formData.mainCategory,
      subCategory: formData.subCategory,
      assetType: newType,
    });
    setFormData((prev) => ({
      ...prev,
      assetType: newType,
      assetTypeId: typeDef?.id || prev.assetTypeId,
      make,
      model,
      ...(isEditMode ? {} : { assetName: "" }),
      ...(wasPrimary !== isPrimary && !isEditMode
        ? { ram: "", ssd: "", cpu: "", windowsVersion: "", macAddress: "" }
        : {}),
    }));
    setDynamicFieldErrors({});
  };

  const documentUploadBlock = (label = "Attach Document (PDF) — optional") => (
    <div className="space-y-1.5 font-mono md:col-span-2">
      <label className="label-caps flex items-center gap-2">{label}</label>
      <div className="flex flex-wrap gap-3 items-center">
        <input
          type="file"
          accept=".pdf,application/pdf"
          onChange={handleFileUpload}
          disabled={uploadingDoc}
          className="flex-1 min-w-[200px] input-geometric file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700"
        />
        {uploadingDoc && (
          <span className="text-xs text-blue-500 font-bold animate-pulse">Uploading PDF…</span>
        )}
        {formData.documentUrl && !uploadingDoc && (
          <span className="flex items-center gap-2">
            <span className="text-xs text-green-500 font-bold">✓ PDF Attached</span>
            <a
              href={getDocumentViewUrl(formData.documentUrl)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 font-bold underline"
            >
              Preview PDF
            </a>
          </span>
        )}
      </div>
    </div>
  );

  /** Laptop/Desktop use legacy RAM/CPU fields — map them for type validation */
  const effectiveDynamicDetails = (): Record<string, string> => {
    if (!activeTypeDef) return dynamicDetails;
    if (entryProfile.showLegacyItSpecs) {
      return legacyToDynamicDetails(activeTypeDef, formData as unknown as Record<string, unknown>);
    }
    return dynamicDetails;
  };

  const validateStep = (step: number): boolean => {
    if (step === 1) {
      if (entryProfile.isItAssets) return !!formData.assetType;
      return !!formData.subCategory?.trim();
    }
    if (step === 2) {
      if (entryProfile.useAssetNameField && !formData.assetName?.trim()) {
        toast.error(`${entryProfile.assetNameLabel} is required`);
        return false;
      }
      if (entryProfile.showDynamicSpecs && activeTypeDef) {
        const detailsToValidate = effectiveDynamicDetails();
        const dErr = validateDynamicFields(activeTypeDef.fields, detailsToValidate);
        if (Object.keys(dErr).length > 0) {
          setDynamicFieldErrors(dErr);
          const missing = Object.keys(dErr)
            .map((k) => activeTypeDef.fields.find((f) => f.key === k)?.label || k)
            .join(", ");
          toast.error(`Please fill: ${missing}`);
          return false;
        }
        setDynamicFieldErrors({});
      }
      if (entryProfile.useBrandModelFields && !formData.make?.trim()) {
        toast.error(`${entryProfile.makeLabel} is required`);
        return false;
      }
      if (entryProfile.useBrandModelFields && entryProfile.requireModelField && !formData.model?.trim()) {
        toast.error(`${entryProfile.modelLabel} is required`);
        return false;
      }
      if (entryProfile.requireSerialNumber && !formData.serialNumber?.trim()) {
        toast.error(`${entryProfile.serialLabel} is required`);
        return false;
      }
      if (entryProfile.manualAssetCode && !formData.assetCode?.trim()) {
        toast.error(`${entryProfile.assetCodeLabel} is required`);
        return false;
      }
      if (fieldErrors.serialNumber || (entryProfile.manualAssetCode && fieldErrors.assetCode)) {
        toast.error("Serial number or asset code already exists");
        return false;
      }
      if (entryProfile.requireMacAddress) {
        if (!formData.macAddress?.trim()) {
          toast.error("MAC address is required for laptops and desktops");
          return false;
        }
        if (!validateMac(formData.macAddress)) {
          setMacError("Invalid MAC format");
          return false;
        }
        if (fieldErrors.macAddress) {
          toast.error("MAC address already registered");
          return false;
        }
      } else if (formData.macAddress?.trim() && !validateMac(formData.macAddress)) {
        setMacError("Invalid MAC format");
        return false;
      } else if (fieldErrors.macAddress) {
        toast.error("MAC address already registered");
        return false;
      }
      if (!formData.vendorName?.trim()) {
        toast.error("Vendor is required");
        return false;
      }
      const purchaseErr = validateNewPurchaseRequirements({
        condition: formData.condition,
        invoiceNumber: formData.invoiceNumber,
        documentUrl: formData.documentUrl,
      });
      if (purchaseErr) {
        toast.error(purchaseErr);
        return false;
      }
      return true;
    }
    if (step === 3) {
      if (!formData.location?.trim() || !formData.plantCode?.trim()) {
        toast.error("Location and plant are required");
        return false;
      }
      if (entryProfile.isCctvSecurityDevice) {
        return true;
      }
      if (!hideAssignee && !formData.department?.trim()) {
        toast.error("Department is required");
        return false;
      }

      const hasAssignee =
        !!formData.employeeId?.trim() ||
        !!formData.contactName?.trim() ||
        !!formData.contactEmail?.trim();

      if (!hasAssignee) {
        return true;
      }

      if (!formData.contactName?.trim() || !formData.contactEmail?.trim()) {
        toast.error("Assignee name and email are required");
        return false;
      }
      const assigneeEmailErr = validateCorporateEmail(formData.contactEmail);
      if (assigneeEmailErr) {
        toast.error(assigneeEmailErr);
        return false;
      }
      if (!formData.employeeId?.trim()) {
        toast.error("Employee ID is required — search or create a saved profile");
        return false;
      }
      if (!linkedEmployee) {
        toast.error("Create or link a saved employee profile before registering this asset");
        return false;
      }
      if (isInactiveEmployee(linkedEmployee.status)) {
        const sameExistingAssignee =
          !!initialData?.id &&
          !!initialData.employeeId &&
          normalizeEmployeeId(initialData.employeeId) === normalizeEmployeeId(linkedEmployee.employeeId);
        if (!sameExistingAssignee) {
          toast.error("Inactive employees cannot receive new assets — return existing assets only");
          return false;
        }
      }
      if (!formData.contactMobile?.trim()) {
        toast.error("Contact number is required");
        return false;
      }
      if (!formData.assignedDate?.trim()) {
        toast.error("Assigned date is required when an employee is assigned");
        return false;
      }
      return true;
    }
    return true;
  };

  const goNext = () => {
    if (!validateStep(formStep)) return;
    advanceGuardRef.current = true;
    setSaveReady(false);
    setFormStep((s) => Math.min(3, s + 1));
    window.setTimeout(() => {
      advanceGuardRef.current = false;
      setSaveReady(true);
    }, 500);
  };
  const goBack = () => setFormStep((s) => Math.max(1, s - 1));

  /** Step header clicks: back is always allowed; forward requires every prior step to pass validation. */
  const goToStep = (targetStep: number) => {
    if (targetStep === formStep) return;
    if (targetStep < formStep) {
      setFormStep(targetStep);
      return;
    }
    for (let step = 1; step < targetStep; step++) {
      if (!validateStep(step)) return;
    }
    setFormStep(targetStep);
  };

  const checkUnique = async (
    field: "serialNumber" | "assetCode" | "macAddress" | "vehicleNumber",
    value: string
  ) => {
    if (!value.trim()) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
      return true;
    }
    setCheckingField(field);
    try {
      const params = new URLSearchParams({ field, value: value.trim() });
      if (initialData?.id) params.set("excludeId", String(initialData.id));
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || ""}/api/assets/check-unique?${params}`);
      const data = await res.json();
      if (data.duplicate) {
        setFieldErrors((prev) => ({
          ...prev,
          [field]: data.message || "Already assigned — duplicate not allowed",
        }));
        return false;
      }
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
      return true;
    } catch {
      return true;
    } finally {
      setCheckingField(null);
    }
  };

  useEffect(() => {
    if (uniqueTimerRef.current) clearTimeout(uniqueTimerRef.current);
    uniqueTimerRef.current = setTimeout(() => {
      void checkUnique("serialNumber", formData.serialNumber);
      if (entryProfile.manualAssetCode) {
        void checkUnique("assetCode", formData.assetCode);
      }
      if (formData.macAddress) void checkUnique("macAddress", formData.macAddress);
      const veh =
        formData.dynamicDetails?.vehicle_number || formData.dynamicDetails?.vehicleNumber || "";
      if (veh) void checkUnique("vehicleNumber", String(veh));
    }, 450);
    return () => {
      if (uniqueTimerRef.current) clearTimeout(uniqueTimerRef.current);
    };
  }, [formData.serialNumber, formData.assetCode, formData.macAddress, initialData?.id, entryProfile.manualAssetCode]);

  useEffect(() => {
    if (entryProfile.manualAssetCode || initialData?.id) return;
    const cat = formData.mainCategory || "IT Assets";
    fetch(
      `${import.meta.env.VITE_API_BASE_URL || ""}/api/assets/next-code?category=${encodeURIComponent(cat)}`
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && !data.manual && data.code) {
          setFormData((prev) => ({ ...prev, assetCode: data.code }));
        } else if (data?.manual) {
          setFormData((prev) => ({ ...prev, assetCode: prev.assetCode || "" }));
        }
      })
      .catch(() => {});
  }, [formData.mainCategory, entryProfile.manualAssetCode, initialData?.id]);

  const loggedInUser = React.useMemo(() => {
    try {
      const stored = localStorage.getItem('assestflow_user') || localStorage.getItem('assetflow_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }, []);

  const allowedLocations = React.useMemo(() => {
    if (!loggedInUser) return [];
    if (loggedInUser.role === 'IT Admin' || loggedInUser.locations?.includes('All')) {
      return appSettings.locations;
    }
    return appSettings.locations.filter((loc) =>
      loggedInUser.locations?.some((allowed: string) => sameSettingValue(allowed, loc))
    );
  }, [appSettings.locations, loggedInUser]);

  const allowedPlants = React.useMemo(() => {
    if (!loggedInUser) return [];
    if (loggedInUser.role === 'IT Admin' || loggedInUser.plants?.includes('All')) {
      return appSettings.plants;
    }
    return appSettings.plants.filter((p) =>
      loggedInUser.plants?.some((allowed: string) => sameSettingValue(allowed, p.code) || sameSettingValue(allowed, p.name))
    );
  }, [appSettings.plants, loggedInUser]);

  const plantsForLocation = React.useMemo(() => {
    return allowedPlants.filter(
      (p) => !formData.location || sameSettingValue(p.location, formData.location)
    );
  }, [allowedPlants, formData.location]);

  const allowedCategories = React.useMemo(() => {
    if (propAllowedCategories) return propAllowedCategories;
    if (!loggedInUser) return MAIN_CATEGORIES;
    const cats = loggedInUser.categories ?? loggedInUser.Categories ?? loggedInUser.category ?? loggedInUser.access;
    const userCats = Array.isArray(cats)
      ? cats
      : typeof cats === 'string'
        ? cats.split(',').map((s: string) => s.trim()).filter(Boolean)
        : [];
    if (loggedInUser.role === 'IT Admin' || userCats.length === 0 || userCats.includes('All')) {
      return MAIN_CATEGORIES;
    }
    return MAIN_CATEGORIES.filter(cat => userCats.includes(cat));
  }, [loggedInUser, propAllowedCategories]);

  useEffect(() => {
    if (!initialData?.id && allowedCategories.length > 0) {
      const defaultCat = allowedCategories[0];
      if (!allowedCategories.includes(formData.mainCategory || "IT Assets")) {
        const subs = CATEGORY_SUBCATEGORIES[defaultCat] || [];
        const firstSub = defaultCat === "IT Assets" ? (subs[0] || "") : "";
        setFormData((prev) => applyCategorySelection(prev, defaultCat, firstSub, typeConfig));
      }
    }
  }, [allowedCategories, initialData?.id]);

  /** When opened from dashboard with a category filter, skip re-selecting category */
  useEffect(() => {
    if (initialData?.id || !prefillMainCategory || prefillMainCategory === "All" || prefillAssetType || prefillMainCategory === SIDEBAR_CCTV_CATEGORY) return;
    if (!allowedCategories.includes(prefillMainCategory)) return;
    const subs = CATEGORY_SUBCATEGORIES[prefillMainCategory] || [];
    const firstSub = prefillMainCategory === "IT Assets" ? (subs[0] || "") : "";
    setFormData((prev) => applyCategorySelection(prev, prefillMainCategory, firstSub, typeConfig));
  }, [prefillMainCategory, prefillAssetType, allowedCategories, initialData?.id, typeConfig]);

  /** When opened from Camera/NVR sidebar — IT Assets + type selector, jump to step 2 */
  useEffect(() => {
    if (initialData?.id || prefillMainCategory !== SIDEBAR_CCTV_CATEGORY) return;
    const typeDef = resolveTypeDefinition(typeConfig, {
      mainCategory: "IT Assets",
      subCategory: "CCTV / Security Device",
      assetType: "Camera",
    });
    setFormData((prev) => ({
      ...applyCategorySelection(prev, "IT Assets", "CCTV / Security Device", typeConfig),
      assetType: "Camera",
      subCategory: "CCTV / Security Device",
      assetTypeId: typeDef?.id || "cctv_security",
    }));
  }, [prefillMainCategory, initialData?.id, typeConfig]);

  /** Legacy: direct asset type prefill (Camera or NVR) */
  useEffect(() => {
    if (initialData?.id || !prefillAssetType) return;
    if (prefillAssetType !== "Camera" && prefillAssetType !== "NVR") return;
    const typeDef = resolveTypeDefinition(typeConfig, {
      mainCategory: "IT Assets",
      subCategory: "CCTV / Security Device",
      assetType: prefillAssetType,
    });
    setFormData((prev) => ({
      ...applyCategorySelection(prev, "IT Assets", "CCTV / Security Device", typeConfig),
      assetType: prefillAssetType,
      subCategory: "CCTV / Security Device",
      assetTypeId: typeDef?.id || "cctv_security",
    }));
  }, [prefillAssetType, initialData?.id, typeConfig]);

  const selectCctvAssetType = (type: (typeof CCTV_IT_TYPES)[number]) => {
    const { subCategory } = applyItAssetTypeSelection(type);
    const typeDef = resolveTypeDefinition(typeConfig, {
      mainCategory: "IT Assets",
      subCategory,
      assetType: type,
    });
    selectAssetType(type);
    setFormData((prev) => ({
      ...prev,
      assetType: type,
      subCategory,
      assetTypeId: typeDef?.id || "cctv_security",
    }));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingDoc(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const base64 = evt.target?.result as string;
      try {
        const res = await fetch((import.meta.env.VITE_API_BASE_URL || "") + '/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: file.name, fileData: base64 })
        });
        const data = await res.json();
        if (data.url) {
          setFormData(prev => ({ ...prev, documentUrl: data.url }));
          toast.success("PDF uploaded");
        } else if (data.error) {
          toast.error(data.error);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setUploadingDoc(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCategoryPreviewUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    const previewKey = isItCategory ? formData.assetType?.trim() : formData.subCategory?.trim();
    if (!previewKey) {
      toast.error(isItCategory ? "Select an asset type first" : "Select a sub category first");
      return;
    }

    setUploadingPreview(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const base64 = evt.target?.result as string;
      try {
        const res = await fetch((import.meta.env.VITE_API_BASE_URL || "") + "/api/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: file.name, fileData: base64 }),
        });
        const data = await res.json();
        if (data.url) {
          persistCatalog((c) =>
            isSoftwareCategory && formData.subCategory?.trim()
              ? setSoftwareSubCategoryImage(c, formData.subCategory.trim(), data.url)
              : setSubCategoryImage(c, previewKey, data.url)
          );
          toast.success(`Image saved for ${previewKey}`);
        } else if (data.error) {
          toast.error(data.error);
        }
      } catch (err) {
        console.error(err);
        toast.error("Image upload failed");
      } finally {
        setUploadingPreview(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return;

    setUploadingImage(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const base64 = evt.target?.result as string;
      try {
        const res = await fetch((import.meta.env.VITE_API_BASE_URL || "") + '/api/upload', {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: file.name, fileData: base64 }),
        });
        const data = await res.json();
        if (data.url) {
          setFormData((prev) => ({ ...prev, imageUrl: data.url }));
        }
      } catch (err) {
        console.error(err);
      } finally {
        setUploadingImage(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const validateMac = (mac: string) => {
    // Allows 00:1A:2B:3C:4D:5E, 00-1A-2B-3C-4D-5E, 00.1A.2B.3C.4D.5E or 001A2B3C4D5E
    const macRegex = /^([0-9A-Fa-f]{2}[:.-]){5}([0-9A-Fa-f]{2})$|^([0-9A-Fa-f]{12})$/;
    return macRegex.test(mac);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    if (name === "macAddress") {
      // Extract only hexadecimal characters and convert to uppercase
      const clean = value.replace(/[^0-9A-Fa-f]/g, "").toUpperCase();
      // Group hex digits in pairs of 2 separated by colons
      const chunks = [];
      for (let i = 0; i < clean.length && i < 12; i += 2) {
        chunks.push(clean.substring(i, i + 2));
      }
      const formatted = chunks.join(":");
      
      setFormData(prev => ({ ...prev, [name]: formatted }));
      if (formatted === "" || validateMac(formatted)) {
        setMacError(null);
      }
      return;
    }

    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAccessoryChange = (key: keyof DesktopAccessories) => {
    setFormData(prev => ({
      ...prev,
      accessories: {
        ...prev.accessories!,
        [key]: !prev.accessories?.[key]
      }
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || loading || advanceGuardRef.current || !saveReady) return;
    if (formStepRef.current !== 3) return;

    const detailsForSave = effectiveDynamicDetails();

    const merged = applyLegacyFieldMapping(
      { ...formData, dynamicDetails: detailsForSave, assetTypeId: activeTypeDef?.id || formData.assetTypeId },
      activeTypeDef,
      detailsForSave
    ) as AssetFormData;

    const now = new Date().toISOString();
    const currentUser = loggedInUser?.name || loggedInUser?.username || loggedInUser?.email || "System";

    const dataToSubmit = {
      ...merged,
      dynamicDetails: detailsForSave,
      assetTypeId: activeTypeDef?.id || formData.assetTypeId,
      status: !isSoftwareCategory && formData.maintenanceRequired === 'Yes' ? 'Under Maintenance' : (formData.status || 'Available'),
      monitorAssetCode: includeMonitor ? formData.monitorAssetCode : "",
      monitorSerial: includeMonitor ? formData.monitorSerial : "",
      keyboardAssetCode: includeKeyboard ? formData.keyboardAssetCode : "",
      keyboardSerial: includeKeyboard ? formData.keyboardSerial : "",
      mouseAssetCode: includeMouse ? formData.mouseAssetCode : "",
      mouseSerial: includeMouse ? formData.mouseSerial : "",
      upsAssetCode: includeUps ? formData.upsAssetCode : "",
      upsSerial: includeUps ? formData.upsSerial : "",
      updatedBy: currentUser,
      updatedDate: now,
      ...(initialData?.id ? {} : { createdBy: currentUser, createdDate: now }),
    };

    console.log('[AMS] Form submission payload:', {
      cpu: dataToSubmit.cpu,
      ram: dataToSubmit.ram,
      ssd: dataToSubmit.ssd,
      windowsVersion: dataToSubmit.windowsVersion,
      macAddress: dataToSubmit.macAddress,
      ipAddress: dataToSubmit.ipAddress,
      hostName: dataToSubmit.hostName,
      contactEmail: dataToSubmit.contactEmail,
      contactMobile: dataToSubmit.contactMobile,
      contactName: dataToSubmit.contactName,
      imageUrl: dataToSubmit.imageUrl,
      documentUrl: dataToSubmit.documentUrl,
    });

    setIsSubmitting(true);
    try {
      if (!validateStep(1) || !validateStep(2) || !validateStep(3)) {
        setIsSubmitting(false);
        return;
      }

      const isIT = (dataToSubmit.mainCategory || "IT Assets") === "IT Assets";
      const isPeripheral = PERIPHERAL_TYPES.includes(dataToSubmit.assetType);
      if (isIT && !isPeripheral && !validateMac(dataToSubmit.macAddress)) {
        setMacError("Invalid Format. Use XX:XX:XX:XX:XX:XX or XXXXXXXXXXXX (Hex only)");
        const el = document.getElementById("mac-address-input");
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setIsSubmitting(false);
        return;
      }

      const serialOk = await checkUnique("serialNumber", dataToSubmit.serialNumber);
      const codeOk = entryProfile.manualAssetCode
        ? await checkUnique("assetCode", dataToSubmit.assetCode)
        : true;
      const macOk = (!isIT || isPeripheral || !dataToSubmit.macAddress) ? true : await checkUnique("macAddress", dataToSubmit.macAddress);

      if (!serialOk || !codeOk || !macOk) {
        toast.error("Duplicate Serial Number, Asset Code, or MAC Address — save blocked.");
        setIsSubmitting(false);
        return;
      }

      await Promise.resolve(onSubmit(dataToSubmit));
    } catch (err: any) {
      toast.error(err.message || "Failed to save asset");
    } finally {
      if (mountedRef.current) {
        setIsSubmitting(false);
      }
    }
  };

  const handleInvalid = (e: React.FormEvent<HTMLFormElement>) => {
    const firstInvalid = e.currentTarget.querySelector(':invalid') as HTMLElement;
    if (firstInvalid) {
      const topPos = firstInvalid.getBoundingClientRect().top + window.scrollY - 100;
      window.scrollTo({ top: topPos, behavior: 'smooth' });
      firstInvalid.focus({ preventScroll: true });
    }
  };

  const handleFormKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
    if (e.key === "Enter" && formStep < 3) {
      e.preventDefault();
    }
  };

  return (
    <form
      ref={formTopRef}
      onSubmit={handleSubmit}
      onInvalid={handleInvalid}
      onKeyDown={handleFormKeyDown}
      className={cn("space-y-8", isPageLayout && "space-y-10")}
    >
      {/* Step indicator */}
      <nav className="flex items-center gap-2 p-1 bg-slate-100 rounded-2xl border border-slate-200">
        {STEPS.map(({ n, title, icon: Icon }) => (
          <button
            key={n}
            type="button"
            onClick={() => goToStep(n)}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-3 px-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all",
              formStep === n
                ? "bg-white text-blue-700 shadow-md ring-1 ring-blue-100"
                : n < formStep
                  ? "text-slate-600 hover:bg-white/60"
                  : "text-slate-400"
            )}
          >
            <span className={cn(
              "w-6 h-6 rounded-full flex items-center justify-center text-[10px]",
              formStep === n ? "bg-blue-600 text-white" : n < formStep ? "bg-emerald-500 text-white" : "bg-slate-200"
            )}>{n}</span>
            <Icon size={14} className="hidden sm:block" />
            <span className="hidden md:inline">{title}</span>
          </button>
        ))}
      </nav>
        {/* STEP 1 — Select asset category and type */}
      {formStep === 1 && (
      <section className="space-y-6">
        <div className="rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-sm">
          <div className="grid md:grid-cols-5 gap-0">
            <div className="md:col-span-2 p-6 flex flex-col justify-center bg-gradient-to-br from-slate-900 to-slate-800 text-white">
              <img src={LOGO_SRC} alt={APP_NAME} className="w-12 h-12 object-contain mb-4" />
              <p className="text-[10px] font-black uppercase tracking-widest text-blue-300">Step 1</p>
              <h4 className="text-2xl font-black mt-1">Select Asset Category</h4>
              <p className="text-sm text-slate-300 mt-2">Choose the main asset category and its specific sub-category to proceed.</p>
            </div>
            <div className="md:col-span-3 relative min-h-[280px] bg-slate-50 flex items-center justify-center p-6">
              <img
                src={previewUrl}
                alt={selectedTypeLabel}
                className="max-w-full max-h-[220px] w-auto h-auto object-contain drop-shadow-lg"
              />
              {canUploadPreview && (
                <>
                  <input
                    ref={categoryPreviewInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleCategoryPreviewUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => categoryPreviewInputRef.current?.click()}
                    disabled={uploadingPreview}
                    className="absolute top-4 right-4 z-10 flex items-center gap-2 px-3 py-2 bg-white/95 hover:bg-white text-slate-800 rounded-xl text-[10px] font-black uppercase tracking-wider shadow-lg border border-slate-200 transition-all disabled:opacity-60"
                  >
                    <Upload size={14} />
                    {uploadingPreview ? "Uploading..." : "Upload image"}
                  </button>
                </>
              )}
              <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-slate-900/80 to-transparent pointer-events-none">
                <p className="text-white font-black text-lg">{formData.mainCategory || "IT Assets"}</p>
                <p className="text-white/80 text-xs">{selectedTypeLabel}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-5 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          {/* Main Category Dropdown / Label */}
          <div className="space-y-1.5">
            <label className="label-caps font-black text-xs text-slate-700 font-sans">Main Category *</label>
            {allowedCategories.length > 1 ? (
              <select
                required
                name="mainCategory"
                value={formData.mainCategory || "IT Assets"}
                onChange={(e) => {
                  const mainCat = e.target.value;
                  const subs = CATEGORY_SUBCATEGORIES[mainCat] || [];
                  const firstSub = mainCat === "IT Assets" ? (subs[0] || "") : "";
                  setFormData((prev) =>
                    applyCategorySelection(prev, mainCat, firstSub, typeConfig, {
                      preserveFields: isEditMode,
                    })
                  );
                  setDynamicFieldErrors({});
                  setMacError(null);
                  if (!isEditMode) {
                    setIncludeMonitor(false);
                    setIncludeKeyboard(false);
                    setIncludeMouse(false);
                    setIncludeUps(false);
                  }
                }}
                className="w-full input-geometric font-bold bg-white text-sm py-3 px-4 focus:ring-2 focus:ring-blue-500/50"
              >
                {allowedCategories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            ) : (
              <div className="w-full input-geometric font-bold bg-slate-100 text-slate-700 text-sm py-3 px-4 border border-slate-200 rounded-xl select-none">
                {formData.mainCategory || allowedCategories[0] || "IT Assets"}
              </div>
            )}
          </div>

          {/* Sub Category Picker */}
          {(formData.mainCategory || "IT Assets") === "IT Assets" ? (
            <div className="space-y-4 pt-2">
              <h3 className="label-caps flex items-center gap-2">
                <LayoutDashboard size={12} className="text-blue-500" />
                IT Asset Type
              </h3>
              {entryProfile.isCctvSecurityDevice ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-xl w-full border border-slate-200">
                    {CCTV_IT_TYPES.map((type) => (
                      <button
                        type="button"
                        key={type}
                        onClick={() => selectCctvAssetType(type)}
                        className={cn(
                          "py-3 px-2 rounded-lg font-black text-xs uppercase tracking-widest transition-all flex flex-col items-center gap-2",
                          formData.assetType === type
                            ? "bg-white text-cyan-600 shadow-md ring-1 ring-slate-200"
                            : "text-slate-400 hover:text-slate-600"
                        )}
                      >
                        <DeviceThumb assetType={type} size="sm" className="!w-14 !h-14" />
                        {type}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
              <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 bg-slate-100 p-1 rounded-xl w-full border border-slate-200">
                {IT_PRIMARY_TYPES.map((type) => {
                  const isPeripheralGroup = type === "Input/Output Device";
                  const isSelected = isPeripheralGroup
                    ? PERIPHERAL_GRID_TYPES.includes(formData.assetType)
                    : formData.assetType === type;
                  return (
                    <button
                      type="button"
                      key={type}
                      onClick={() => {
                        const newType = isPeripheralGroup ? "Monitor" : (type as AssetType);
                        selectAssetType(newType);
                        const { subCategory } = applyItAssetTypeSelection(newType);
                        setFormData((prev) => ({ ...prev, subCategory }));
                      }}
                      className={cn(
                        "py-3 px-2 rounded-lg font-black text-xs uppercase tracking-widest transition-all",
                        isSelected ? "bg-white text-blue-600 shadow-md ring-1 ring-slate-200" : "text-slate-400 hover:text-slate-600"
                      )}
                    >
                      {type}
                    </button>
                  );
                })}
              </div>
              {PERIPHERAL_GRID_TYPES.includes(formData.assetType) && (
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="text-[10px] font-black uppercase text-slate-400 mb-3 tracking-widest">Device Type</div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {PERIPHERAL_GRID_TYPES.map((pType) => (
                      <button
                        type="button"
                        key={pType}
                        onClick={() => {
                          selectAssetType(pType as AssetType);
                          const { subCategory } = applyItAssetTypeSelection(pType as AssetType);
                          setFormData((prev) => ({ ...prev, subCategory }));
                        }}
                        className={cn(
                          "flex flex-col items-center gap-2 p-3 rounded-xl border transition-all",
                          formData.assetType === pType
                            ? "bg-blue-50 border-blue-300 ring-2 ring-blue-200"
                            : "bg-white border-slate-200 hover:border-slate-300"
                        )}
                      >
                        <DeviceThumb assetType={pType} size="sm" className="!w-16 !h-16" />
                        <span className="text-[10px] font-bold text-center">{pType}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              </>
              )}
            </div>
          ) : (
            <div className="space-y-1.5 pt-2">
              <SmartSelect
                label="Sub Category"
                required
                value={formData.subCategory}
                options={getSubCategories(formData.mainCategory || "")}
                onChange={(subCategory) => {
                  setFormData((prev) =>
                    applyCategorySelection(prev, prev.mainCategory || "", subCategory, typeConfig, {
                      preserveFields: isEditMode,
                    })
                  );
                  setDynamicFieldErrors({});
                }}
                onAddCustom={(v) =>
                  persistCatalog((c) => addSubCategory(c, formData.mainCategory || "", v))
                }
                onDeleteOption={(v) =>
                  persistCatalog((c) => removeSubCategory(c, formData.mainCategory || "", v))
                }
              />
            </div>
          )}

        </div>
      </section>
      )}

      {/* STEP 2 — Asset information */}
      {formStep === 2 && (
      <section className="space-y-6">
        <div className="flex items-center gap-4 p-4 bg-blue-50 border border-blue-100 rounded-2xl">
          <DeviceThumb assetType={formData.assetType} mainCategory={formData.mainCategory} subCategory={formData.subCategory} imageUrl={formData.imageUrl} size="lg" className="!w-32 !h-32" />
          <div>
            <p className="text-[10px] font-black uppercase text-blue-600">Selected asset category</p>
            <h4 className="text-xl font-black text-slate-900">{formData.mainCategory || "IT Assets"}</h4>
            <p className="text-sm text-slate-600">{selectedTypeLabel}</p>
          </div>
        </div>

        <div ref={step2TopRef} className="space-y-5 scroll-mt-6">
        <h3 className="label-caps flex items-center gap-2">
           <Cpu size={12} className="text-blue-500" />
           Asset Identity & Details
        </h3>
        <div className="flex flex-col gap-5" ref={step2FocusRef}>
          {entryProfile.useAssetNameField && (
            <div className="space-y-1.5">
              <label className="label-caps text-red-500">{entryProfile.assetNameLabel} *</label>
              <input
                required
                name="assetName"
                value={formData.assetName || ""}
                onChange={handleChange}
                placeholder={entryProfile.assetNamePlaceholder}
                className="w-full input-geometric border-blue-400 font-bold bg-white"
              />
            </div>
          )}

          {entryProfile.showDynamicSpecs && activeTypeDef && (
            <DynamicAssetForm
              fields={activeTypeDef.fields}
              values={dynamicDetails}
              onChange={onDynamicChange}
              errors={dynamicFieldErrors}
              title={`${activeTypeDef.name} — details`}
              className="pb-2"
              managedSelects={
                isSoftwareCategory
                  ? {
                      license_type: {
                        options: getLicenseTypeList(catalog),
                        onAddCustom: (v) => persistCatalog((c) => addLicenseType(c, v)),
                        onDeleteOption: (v) => persistCatalog((c) => removeLicenseType(c, v)),
                      },
                    }
                  : undefined
              }
            />
          )}

          {entryProfile.useBrandModelFields && (
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <SmartSelect
              label={entryProfile.makeLabel}
              required
              value={formData.make}
              options={[
                ...getBrandListForAssetType(catalog, formData.assetType),
                ...(formData.make && !getBrandListForAssetType(catalog, formData.assetType).includes(formData.make)
                  ? [formData.make]
                  : []),
              ]}
              onChange={(make) => {
                const models = getModelsForBrandAndType(catalog, formData.assetType, make);
                setFormData((prev) => ({
                  ...prev,
                  make,
                  model: models.includes(prev.model) ? prev.model : "",
                }));
              }}
              onAddCustom={(make) =>
                persistCatalog((c) => addBrandForType(c, formData.assetType, make))
              }
              onDeleteOption={(make) =>
                persistCatalog((c) => removeBrandForType(c, formData.assetType, make))
              }
            />
            </div>
            {!isSoftwareCategory && (
            <div className="flex-1">
            <SmartSelect
              label={entryProfile.modelLabel}
              required
              disabled={!formData.make}
              value={formData.model}
              options={
                formData.make
                  ? optionsWithValue(
                      getModelsForBrandAndType(catalog, formData.assetType, formData.make),
                      formData.model
                    )
                  : []
              }
              onChange={(model) => {
                setFormData((prev) => ({
                  ...prev,
                  model,
                  assetName: (prev.mainCategory || "IT Assets") === "IT Assets" ? (prev.make + " " + model) : prev.assetName
                }));
              }}
              onAddCustom={(model) => {
                if (!formData.make) return;
                persistCatalog((c) =>
                  addModelForType(c, formData.assetType, formData.make, model)
                );
              }}
              onDeleteOption={(model) => {
                if (!formData.make) return;
                persistCatalog((c) =>
                  removeModelForType(c, formData.assetType, formData.make, model)
                );
              }}
              placeholder={formData.make ? `Select ${entryProfile.modelLabel.toLowerCase()}` : `Select ${entryProfile.makeLabel.toLowerCase()} first`}
            />
            </div>
            )}
          </div>
          )}

          {/* Condition field */}
          <div className="space-y-1.5">
            <label className="label-caps text-red-500">Condition *</label>
            <select
              required
              name="condition"
              value={formData.condition || "EXISTING ASSETS"}
              onChange={handleChange}
              className="w-full input-geometric bg-white font-bold text-slate-800"
            >
              {ASSET_CONDITION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 space-y-1.5">
              <label className={cn("label-caps", entryProfile.requireSerialNumber && "text-red-500")}>
                {entryProfile.serialLabel}
                {entryProfile.requireSerialNumber ? " *" : ""}
              </label>
              <input
                required={entryProfile.requireSerialNumber}
                name="serialNumber"
                value={formData.serialNumber}
                onChange={handleChange}
                placeholder={isSoftwareCategory ? "Enter license key" : "ID-99201-SYS"}
                className={cn(
                  "w-full input-geometric border-blue-400 font-bold bg-white",
                  fieldErrors.serialNumber && "border-red-500 bg-red-50"
                )}
              />
              {checkingField === "serialNumber" && (
                <p className="text-[10px] text-slate-400 font-bold">Checking uniqueness…</p>
              )}
              {fieldErrors.serialNumber && (
                <p className="text-[10px] text-red-600 font-bold">{fieldErrors.serialNumber}</p>
              )}
            </div>
            <div className="flex-1 space-y-3">
              <div className="space-y-1.5">
                <label className="label-caps text-slate-600">
                  {entryProfile.assetCodeLabel}
                  {entryProfile.manualAssetCode ? " *" : " (auto)"}
                </label>
                {entryProfile.manualAssetCode ? (
                  <>
                    <input
                      required
                      name="assetCode"
                      value={formData.assetCode}
                      onChange={handleChange}
                      placeholder={isSoftwareCategory ? "Enter software code" : "AST-101"}
                      className={cn(
                        "w-full input-geometric border-blue-400 font-bold bg-white",
                        fieldErrors.assetCode && "border-red-500 bg-red-50"
                      )}
                    />
                    {checkingField === "assetCode" && (
                      <p className="text-[10px] text-slate-400 font-bold">Checking uniqueness…</p>
                    )}
                    {fieldErrors.assetCode && (
                      <p className="text-[10px] text-red-600 font-bold">{fieldErrors.assetCode}</p>
                    )}
                  </>
                ) : (
                  <input
                    disabled
                    value={formData.assetCode || "Auto-generated on save"}
                    className="w-full input-geometric border-slate-200 font-bold bg-slate-50 text-slate-600 cursor-not-allowed"
                  />
                )}
                <p className="text-[10px] text-slate-500 font-medium">
                  {entryProfile.manualAssetCode
                    ? isSoftwareCategory
                      ? "Enter software code manually."
                      : "Enter asset code manually."
                    : "Asset code is auto-generated when you save."}
                </p>
              </div>
              <div className="space-y-1.5">
                <label className="label-caps">Account Asset Code (optional)</label>
                <input
                  name="accountAssetCode"
                  value={formData.accountAssetCode || ""}
                  onChange={handleChange}
                  placeholder="e.g. ACC-IT-2026-001"
                  className="w-full input-geometric border-blue-400 font-bold bg-white text-slate-800"
                />
                <p className="text-[10px] text-slate-500 font-medium">Optional accounting reference code.</p>
              </div>
            </div>
          </div>

          {entryProfile.isCctvSecurityDevice && activeTypeDef && (
            <div className="space-y-4 pb-2">
              <h3 className="label-caps flex items-center gap-2 text-blue-600">
                {formData.assetType === 'NVR' ? 'NVR — details' : `${activeTypeDef.name} — details`}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="label-caps">{formData.assetType === 'NVR' ? 'NVR IP' : 'Camera IP'}</label>
                  <input
                    id="ip-address-input"
                    name="ipAddress"
                    value={formData.ipAddress || ""}
                    onChange={handleChange}
                    placeholder="192.168.1.100"
                    className="w-full input-geometric font-mono tracking-wider bg-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="label-caps">MAC Address</label>
                  <input
                    id="mac-address-input"
                    name="macAddress"
                    value={formData.macAddress}
                    onChange={handleChange}
                    placeholder="00:1A:2B:3C:4D:5E"
                    className={cn(
                      "w-full input-geometric font-mono text-center tracking-widest",
                      macError || fieldErrors.macAddress ? "border-red-500 bg-red-50" : "bg-white"
                    )}
                  />
                  {macError && <p className="text-[10px] text-red-500 font-bold text-center">{macError}</p>}
                  {fieldErrors.macAddress && (
                    <p className="text-[10px] text-red-600 font-bold text-center">{fieldErrors.macAddress}</p>
                  )}
                  {checkingField === "macAddress" && (
                    <p className="text-[10px] text-slate-400 text-center">Checking MAC…</p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {formData.assetType !== 'NVR' && (() => {
                  const resolutionField = activeTypeDef.fields.find((f) => f.key === 'camera_resolution');
                  if (!resolutionField) return null;
                  return (
                    <div className="space-y-1.5">
                      <label className="label-caps">{resolutionField.label}</label>
                      <select
                        value={dynamicDetails.camera_resolution || ""}
                        onChange={(e) => onDynamicChange('camera_resolution', e.target.value)}
                        className="w-full input-geometric bg-white"
                      >
                        <option value="">Select…</option>
                        {(resolutionField.options || []).map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                      {dynamicFieldErrors.camera_resolution && (
                        <p className="text-xs text-red-500 font-bold">{dynamicFieldErrors.camera_resolution}</p>
                      )}
                    </div>
                  );
                })()}
                {formData.assetType === 'NVR' && (() => {
                  const channelField = activeTypeDef.fields.find((f) => f.key === 'channel_count');
                  if (!channelField) return null;
                  return (
                    <div className="space-y-1.5">
                      <label className="label-caps">{channelField.label}</label>
                      <select
                        value={dynamicDetails.channel_count || ""}
                        onChange={(e) => onDynamicChange('channel_count', e.target.value)}
                        className="w-full input-geometric bg-white"
                      >
                        <option value="">Select…</option>
                        {(channelField.options || []).map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                      {dynamicFieldErrors.channel_count && (
                        <p className="text-xs text-red-500 font-bold">{dynamicFieldErrors.channel_count}</p>
                      )}
                    </div>
                  );
                })()}
                <div className="space-y-1.5">
                  <label className="label-caps">Location Name</label>
                  <input
                    name="location_name"
                    value={dynamicDetails.location_name || ""}
                    onChange={(e) => onDynamicChange('location_name', e.target.value)}
                    placeholder="e.g. Main Gate, Warehouse A"
                    className="w-full input-geometric bg-white"
                  />
                  {dynamicFieldErrors.location_name && (
                    <p className="text-xs text-red-500 font-bold">{dynamicFieldErrors.location_name}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SmartSelect
              label="Vendor Name"
              required
              value={formData.vendorName}
              options={optionsWithValue(
                getVendorsForCategory(catalog, formData.mainCategory || "IT Assets"),
                formData.vendorName
              )}
              onChange={(vendorName) => setFormData((prev) => ({ ...prev, vendorName }))}
              onAddCustom={(v) => persistCatalog((c) => addVendor(c, formData.mainCategory || "IT Assets", v))}
              onDeleteOption={(v) => persistCatalog((c) => removeVendor(c, formData.mainCategory || "IT Assets", v))}
            />

            <div className="space-y-1.5">
              <label className="label-caps">
                PO Number
                {formData.condition === "NEW PURCHASE" ? " *" : ""}
              </label>
              <input
                name="invoiceNumber"
                value={formData.invoiceNumber || ""}
                onChange={handleChange}
                placeholder="PO-99201"
                required={formData.condition === "NEW PURCHASE"}
                className="w-full input-geometric bg-white text-slate-800"
              />
              {formData.condition === "NEW PURCHASE" && (
                <p className="text-[10px] text-slate-500 font-medium">Required for new purchases.</p>
              )}
            </div>
          </div>

          {entryProfile.showNetworkFields && !entryProfile.isCctvSecurityDevice && (
            <div className="space-y-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Network Details</p>
              {/* IP Address & Hostname — always shown for IT assets */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="label-caps">IP Address</label>
                  <input
                    id="ip-address-input"
                    name="ipAddress"
                    value={formData.ipAddress || ""}
                    onChange={handleChange}
                    placeholder="192.168.1.100"
                    className="w-full input-geometric font-mono tracking-wider bg-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="label-caps">Host Name</label>
                  <input
                    id="hostname-input"
                    name="hostName"
                    value={formData.hostName || ""}
                    onChange={handleChange}
                    placeholder="DESKTOP-ABC123"
                    className="w-full input-geometric font-mono tracking-wider bg-white"
                  />
                </div>
              </div>
              {/* MAC Address — required only for Laptop/Desktop */}
              {entryProfile.requireMacAddress && (
                <div className="space-y-1.5 font-mono">
                  <label className="label-caps">MAC Address *</label>
                  <input
                    required
                    id="mac-address-input"
                    name="macAddress"
                    value={formData.macAddress}
                    onChange={handleChange}
                    placeholder="00:1A:2B:3C:4D:5E"
                    className={cn(
                      "w-full input-geometric font-mono text-center tracking-widest",
                      macError || fieldErrors.macAddress ? "border-red-500 bg-red-50" : "bg-white"
                    )}
                  />
                  {macError && <p className="text-[10px] text-red-500 font-bold text-center">{macError}</p>}
                  {fieldErrors.macAddress && (
                    <p className="text-[10px] text-red-600 font-bold text-center">{fieldErrors.macAddress}</p>
                  )}
                  {checkingField === "macAddress" && (
                    <p className="text-[10px] text-slate-400 text-center">Checking MAC…</p>
                  )}
                </div>
              )}
            </div>
          )}

          {!isSoftwareCategory && (
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <WarrantyDateField
              label="Warranty Start"
              value={formData.warrantyStartDate}
              onChange={(warrantyStartDate) =>
                setFormData((prev) => ({ ...prev, warrantyStartDate }))
              }
            />
            </div>
            <div className="flex-1">
            <WarrantyDateField
              label="Warranty End"
              value={formData.warrantyEndDate}
              minFrom={formData.warrantyStartDate}
              onChange={(warrantyEndDate) =>
                setFormData((prev) => ({ ...prev, warrantyEndDate }))
              }
            />
            </div>
          </div>
          )}

          {/* Purchase Details */}
          {!isSoftwareCategory && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="label-caps">Purchase Date</label>
              <input
                type="date"
                name="purchaseDate"
                value={formData.purchaseDate || ""}
                onChange={handleChange}
                className="w-full input-geometric bg-white text-slate-800"
              />
            </div>
            <div className="space-y-1.5">
              <label className="label-caps">Purchase Cost</label>
              <input
                type="number"
                name="purchaseCost"
                value={formData.purchaseCost || ""}
                onChange={handleChange}
                placeholder="0.00"
                className="w-full input-geometric bg-white text-slate-800"
              />
            </div>
          </div>
          )}

          {!isSoftwareCategory && (
          <>
          {/* Maintenance Details */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
            <div className="space-y-1.5">
              <label className="label-caps font-bold">Maintenance Required</label>
              <select
                name="maintenanceRequired"
                value={formData.maintenanceRequired || "No"}
                onChange={(e) => {
                  const mReq = e.target.value as 'Yes' | 'No';
                  setFormData(prev => ({
                    ...prev,
                    maintenanceRequired: mReq,
                    status: mReq === 'Yes' ? 'Under Maintenance' : prev.status
                  }));
                }}
                className="w-full input-geometric bg-white font-bold text-slate-800"
              >
                <option value="No">No</option>
                <option value="Yes">Yes</option>
              </select>
            </div>

            {formData.maintenanceRequired === 'Yes' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {formData.condition !== 'NEW PURCHASE' && (
                  <div className="space-y-1.5 flex-1">
                    <label className="label-caps">Last Maintenance Date</label>
                    <input
                      type="date"
                      name="lastMaintenanceDate"
                      value={formData.lastMaintenanceDate || ""}
                      onChange={handleChange}
                      className="w-full input-geometric bg-white text-slate-800"
                    />
                  </div>
                )}
                <div className={cn("space-y-1.5 flex-1", formData.condition === 'NEW PURCHASE' && "md:col-span-2")}>
                  <label className="label-caps">Next Maintenance Date</label>
                  <input
                    type="date"
                    name="nextMaintenanceDate"
                    value={formData.nextMaintenanceDate || ""}
                    onChange={handleChange}
                    className="w-full input-geometric bg-white text-slate-800"
                  />
                </div>
              </div>
            )}
          </div>

          {/* AMC Details section */}
          <div className="space-y-4">
            {!showAmc ? (
              <button
                type="button"
                onClick={() => setShowAmc(true)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2"
              >
                + Add AMC Details
              </button>
            ) : (
              <div className="p-5 bg-blue-50/30 rounded-2xl border border-blue-100 space-y-4 relative">
                <div className="flex justify-between items-center border-b border-blue-100/50 pb-2">
                  <h4 className="text-xs font-black uppercase tracking-widest text-blue-800">AMC Details</h4>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAmc(false);
                      setFormData(prev => ({
                        ...prev,
                        amcVendor: "",
                        amcStartDate: "",
                        amcEndDate: "",
                        amcCost: ""
                      }));
                    }}
                    className="text-[10px] font-bold text-red-500 hover:text-red-700 transition-colors uppercase tracking-wider"
                  >
                    Remove AMC
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="label-caps text-slate-400">Asset ID</label>
                    <input
                      disabled
                      value={formData.assetCode || "Auto-assigned"}
                      className="w-full input-geometric bg-slate-100/70 border-slate-200 text-slate-500 cursor-not-allowed font-bold"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="label-caps text-slate-400">{entryProfile.assetNameLabel}</label>
                    <input
                      disabled
                      value={formData.assetName || (formData.make ? `${formData.make} ${formData.model}` : formData.model) || ""}
                      className="w-full input-geometric bg-slate-100/70 border-slate-200 text-slate-500 cursor-not-allowed font-bold"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="label-caps">AMC Vendor</label>
                    <input
                      name="amcVendor"
                      value={formData.amcVendor || ""}
                      onChange={handleChange}
                      placeholder="e.g. XYZ Solutions"
                      className="w-full input-geometric bg-white text-slate-800"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="label-caps">AMC Cost</label>
                    <input
                      type="number"
                      name="amcCost"
                      value={formData.amcCost || ""}
                      onChange={handleChange}
                      placeholder="e.g. 2000"
                      className="w-full input-geometric bg-white text-slate-800"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="label-caps">AMC Start Date</label>
                    <input
                      type="date"
                      name="amcStartDate"
                      value={formData.amcStartDate || ""}
                      onChange={handleChange}
                      className="w-full input-geometric bg-white text-slate-800"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="label-caps">AMC End Date</label>
                    <input
                      type="date"
                      name="amcEndDate"
                      value={formData.amcEndDate || ""}
                      onChange={handleChange}
                      className="w-full input-geometric bg-white text-slate-800"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
          </>
          )}
        </div>

      {entryProfile.showLegacyItSpecs && (
        <section className="bg-slate-50 p-5 rounded-2xl border border-slate-200">
          <h3 className="label-caps mb-5 flex items-center gap-2">
             <Cpu size={12} className="text-blue-500" />
             Hardware Specification
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <SmartSelect
                label="RAM"
                value={formData.ram}
                options={optionsWithValue(
                  [...RAM_OPTIONS, ...(catalog.ram || [])].filter(
                    (v) => !(catalog.deletedOptions?.ram || []).includes(v)
                  ),
                  formData.ram
                )}
                onChange={(ram) => setFormData((prev) => ({ ...prev, ram }))}
                onAddCustom={(v) => persistCatalog((c) => addRam(c, v))}
                onDeleteOption={(v) => persistCatalog((c) => removeRam(c, v))}
              />
            </div>
            <div className="space-y-1.5">
              <SmartSelect
                label="Storage (SSD)"
                value={formData.ssd}
                options={optionsWithValue(
                  [...SSD_OPTIONS, ...(catalog.ssd || [])].filter(
                    (v) => !(catalog.deletedOptions?.ssd || []).includes(v)
                  ),
                  formData.ssd
                )}
                onChange={(ssd) => setFormData((prev) => ({ ...prev, ssd }))}
                onAddCustom={(v) => persistCatalog((c) => addSsd(c, v))}
                onDeleteOption={(v) => persistCatalog((c) => removeSsd(c, v))}
              />
            </div>
            <div className="space-y-1.5">
              <SmartSelect
                label="Processor Arch"
                required
                value={formData.cpu}
                options={optionsWithValue(
                  [...CPU_OPTIONS, ...(catalog.cpu || [])].filter(
                    (v) => !(catalog.deletedOptions?.cpu || []).includes(v)
                  ),
                  formData.cpu
                )}
                onChange={(cpu) => setFormData((prev) => ({ ...prev, cpu }))}
                onAddCustom={(v) => persistCatalog((c) => addCpu(c, v))}
                onDeleteOption={(v) => persistCatalog((c) => removeCpu(c, v))}
              />
            </div>
            <div className="space-y-1.5">
              <SmartSelect
                label="OS Version"
                value={formData.windowsVersion}
                options={optionsWithValue(
                  [...WINDOWS_OPTIONS, ...(catalog.windowsVersion || [])].filter(
                    (v) => !(catalog.deletedOptions?.windowsVersion || []).includes(v)
                  ),
                  formData.windowsVersion
                )}
                onChange={(windowsVersion) => setFormData((prev) => ({ ...prev, windowsVersion }))}
                onAddCustom={(v) => persistCatalog((c) => addWindowsVersion(c, v))}
                onDeleteOption={(v) => persistCatalog((c) => removeWindowsVersion(c, v))}
              />
            </div>
          </div>
        </section>
      )}

      {!PERIPHERAL_GRID_TYPES.includes(formData.assetType) && (
        <div className="space-y-1.5 font-mono">
          <label className="label-caps flex items-center gap-2">Attach Asset Photo (optional)</label>
          <div className="flex gap-3 items-center">
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              disabled={uploadingImage}
              className="flex-1 input-geometric file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700"
            />
            {uploadingImage && <span className="text-xs text-blue-500 font-bold animate-pulse">Uploading...</span>}
            {formData.imageUrl && !uploadingImage && <span className="text-xs text-green-600 font-bold">✓ Photo added</span>}
          </div>
        </div>
      )}

      <div className="w-full">
        {documentUploadBlock(
          formData.condition === "NEW PURCHASE"
            ? "Attach Asset Document (PDF) *"
            : "Attach Asset Document (PDF) — optional"
        )}
      </div>
        </div>
      </section>
      )}

      {/* STEP 3 — Assignment & location */}
      {formStep === 3 && (
      <section className="space-y-6">
        <div
          ref={step3TopRef}
          className="scroll-mt-6 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center gap-3"
        >
          <MapPin className="text-emerald-600 shrink-0" size={22} />
          <div>
            <p className="text-[10px] font-black uppercase text-emerald-700">Step 3</p>
            <h4 className="font-black text-slate-900">
              {(entryProfile.isCctvSecurityDevice || hideAssignee) ? "Location & Plant" : "Location, Plant & Assignee"}
            </h4>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div ref={step3LocationRef} className="space-y-1.5">
            <SmartSelect
              label="Location"
              required
              value={formData.location}
              options={optionsWithValue(allowedLocations, formData.location)}
              onChange={(location) => {
                setFormData((prev) => ({
                  ...prev,
                  location,
                  plantCode: "",
                }));
              }}
            />
          </div>
          {formData.location && (
            <div className="space-y-1.5">
              <label className="label-caps font-black text-xs text-slate-700 font-sans">
                Plant Code / Name<span className="text-red-500 ml-0.5">*</span>
              </label>
              <select
                required
                value={formData.plantCode}
                onChange={(e) => setFormData((prev) => ({ ...prev, plantCode: e.target.value }))}
                className="w-full input-geometric bg-white font-bold text-slate-800"
              >
                <option value="" disabled>
                  Select plant
                </option>
                {plantsForLocation.map((plant) => (
                  <option key={plant.code} value={plant.code}>
                    {plant.code} — {plant.name}
                  </option>
                ))}
                {formData.plantCode &&
                  !plantsForLocation.some((p) => sameSettingValue(p.code, formData.plantCode) || sameSettingValue(p.name, formData.plantCode)) && (
                    <option value={formData.plantCode}>{formData.plantCode}</option>
                  )}
              </select>
            </div>
          )}
        </div>

      {formData.assetType === 'Desktop' && (
        <section className="space-y-5 bg-slate-50 p-5 rounded-2xl border border-slate-200">
          <h3 className="label-caps flex items-center gap-2">
             <Monitor size={12} className="text-blue-500" />
             I/O Devices (Attached Peripherals) — Optional
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Monitor Card */}
            <div className={cn(
              "space-y-3 p-4 bg-white rounded-2xl border transition-all shadow-sm",
              includeMonitor ? "border-blue-300 ring-2 ring-blue-50" : "border-slate-200 opacity-70"
            )}>
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                    <Monitor className="w-4 h-4 text-blue-600" />
                  </div>
                  <span className="text-xs font-black uppercase text-slate-800">Monitor</span>
                </div>
                <input
                  type="checkbox"
                  checked={includeMonitor}
                  onChange={(e) => {
                    setIncludeMonitor(e.target.checked);
                    if (!e.target.checked) {
                      setFormData(prev => ({ ...prev, monitorAssetCode: "", monitorSerial: "" }));
                    }
                  }}
                  className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                />
              </div>
              {includeMonitor ? (
                <div className="space-y-2 font-mono">
                  <input
                    name="monitorAssetCode"
                    value={formData.monitorAssetCode}
                    onChange={handleChange}
                    placeholder="Asset Code"
                    className="w-full input-geometric bg-slate-50 text-xs py-2 px-3 focus:bg-white"
                  />
                  <input
                    name="monitorSerial"
                    value={formData.monitorSerial}
                    onChange={handleChange}
                    placeholder="Serial Number"
                    className="w-full input-geometric bg-slate-50 text-xs py-2 px-3 focus:bg-white"
                  />
                </div>
              ) : (
                <p className="text-[10px] text-slate-400 italic text-center py-4">Monitor excluded</p>
              )}
            </div>

            {/* Keyboard Card */}
            <div className={cn(
              "space-y-3 p-4 bg-white rounded-2xl border transition-all shadow-sm",
              includeKeyboard ? "border-blue-300 ring-2 ring-blue-50" : "border-slate-200 opacity-70"
            )}>
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                    <Keyboard className="w-4 h-4 text-blue-600" />
                  </div>
                  <span className="text-xs font-black uppercase text-slate-800">Keyboard</span>
                </div>
                <input
                  type="checkbox"
                  checked={includeKeyboard}
                  onChange={(e) => {
                    setIncludeKeyboard(e.target.checked);
                    if (!e.target.checked) {
                      setFormData(prev => ({ ...prev, keyboardAssetCode: "", keyboardSerial: "" }));
                    }
                  }}
                  className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                />
              </div>
              {includeKeyboard ? (
                <div className="space-y-2 font-mono">
                  <input
                    name="keyboardAssetCode"
                    value={formData.keyboardAssetCode}
                    onChange={handleChange}
                    placeholder="Asset Code"
                    className="w-full input-geometric bg-slate-50 text-xs py-2 px-3 focus:bg-white"
                  />
                  <input
                    name="keyboardSerial"
                    value={formData.keyboardSerial}
                    onChange={handleChange}
                    placeholder="Serial Number"
                    className="w-full input-geometric bg-slate-50 text-xs py-2 px-3 focus:bg-white"
                  />
                </div>
              ) : (
                <p className="text-[10px] text-slate-400 italic text-center py-4">Keyboard excluded</p>
              )}
            </div>

            {/* Mouse Card */}
            <div className={cn(
              "space-y-3 p-4 bg-white rounded-2xl border transition-all shadow-sm",
              includeMouse ? "border-blue-300 ring-2 ring-blue-50" : "border-slate-200 opacity-70"
            )}>
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                    <Mouse className="w-4 h-4 text-blue-600" />
                  </div>
                  <span className="text-xs font-black uppercase text-slate-800">Mouse</span>
                </div>
                <input
                  type="checkbox"
                  checked={includeMouse}
                  onChange={(e) => {
                    setIncludeMouse(e.target.checked);
                    if (!e.target.checked) {
                      setFormData(prev => ({ ...prev, mouseAssetCode: "", mouseSerial: "" }));
                    }
                  }}
                  className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                />
              </div>
              {includeMouse ? (
                <div className="space-y-2 font-mono">
                  <input
                    name="mouseAssetCode"
                    value={formData.mouseAssetCode}
                    onChange={handleChange}
                    placeholder="Asset Code"
                    className="w-full input-geometric bg-slate-50 text-xs py-2 px-3 focus:bg-white"
                  />
                  <input
                    name="mouseSerial"
                    value={formData.mouseSerial}
                    onChange={handleChange}
                    placeholder="Serial Number"
                    className="w-full input-geometric bg-slate-50 text-xs py-2 px-3 focus:bg-white"
                  />
                </div>
              ) : (
                <p className="text-[10px] text-slate-400 italic text-center py-4">Mouse excluded</p>
              )}
            </div>

            {/* UPS Card */}
            <div className={cn(
              "space-y-3 p-4 bg-white rounded-2xl border transition-all shadow-sm",
              includeUps ? "border-blue-300 ring-2 ring-blue-50" : "border-slate-200 opacity-70"
            )}>
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                    <Zap className="w-4 h-4 text-blue-600" />
                  </div>
                  <span className="text-xs font-black uppercase text-slate-800">UPS</span>
                </div>
                <input
                  type="checkbox"
                  checked={includeUps}
                  onChange={(e) => {
                    setIncludeUps(e.target.checked);
                    if (!e.target.checked) {
                      setFormData(prev => ({ ...prev, upsAssetCode: "", upsSerial: "" }));
                    }
                  }}
                  className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                />
              </div>
              {includeUps ? (
                <div className="space-y-2 font-mono">
                  <input
                    name="upsAssetCode"
                    value={formData.upsAssetCode}
                    onChange={handleChange}
                    placeholder="Asset Code"
                    className="w-full input-geometric bg-slate-50 text-xs py-2 px-3 focus:bg-white"
                  />
                  <input
                    name="upsSerial"
                    value={formData.upsSerial}
                    onChange={handleChange}
                    placeholder="Serial Number"
                    className="w-full input-geometric bg-slate-50 text-xs py-2 px-3 focus:bg-white"
                  />
                </div>
              ) : (
                <p className="text-[10px] text-slate-400 italic text-center py-4">UPS excluded</p>
              )}
            </div>

          </div>
        </section>
      )}

      {!entryProfile.isCctvSecurityDevice && !hideAssignee && (
      <section className="space-y-5 border-t border-slate-100 pt-6">
        <h3 className="label-caps flex items-center gap-2">
           <User size={12} className="text-blue-500" />
           Assigned To
        </h3>
        <div className="flex flex-col gap-5">
          <EmployeeSelector
            values={{
              employeeId: formData.employeeId || '',
              contactName: formData.contactName,
              contactEmail: formData.contactEmail,
              contactMobile: formData.contactMobile,
              department: formData.department,
              location: formData.location,
              plantCode: formData.plantCode,
            }}
            onChange={(patch) => setFormData((prev) => ({ ...prev, ...patch }))}
            onEmployeeResolved={setLinkedEmployee}
            requireSavedProfile
          />
          <div className="w-full space-y-1.5 font-mono">
            <label className="label-caps">Additional Items / Remarks</label>
            <textarea
              name="additionalItems"
              value={formData.additionalItems}
              onChange={(e) => setFormData(prev => ({ ...prev, additionalItems: e.target.value }))}
              placeholder="Case, Charger, Adapter, etc."
              rows={3}
              className="w-full input-geometric min-h-[100px] py-3"
            />
          </div>
          <div className="space-y-1.5 font-mono max-w-md">
            <label className="label-caps">Assigned Date *</label>
            <input
              type="date"
              name="assignedDate"
              required={!!formData.employeeId?.trim() || !!formData.contactName?.trim()}
              value={formData.assignedDate || ""}
              onChange={handleChange}
              className="w-full input-geometric"
            />
          </div>

          {initialData && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3 mt-4">
              <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-500">Audit & Metadata</h4>
              <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                <div>
                  <p className="text-slate-400 uppercase text-[9px] font-black">Created By</p>
                  <p className="font-bold text-slate-800">{formData.createdBy || "—"}</p>
                </div>
                <div>
                  <p className="text-slate-400 uppercase text-[9px] font-black">Created Date</p>
                  <p className="font-bold text-slate-800">{formatStoredDateTime(formData.createdDate)}</p>
                </div>
                <div>
                  <p className="text-slate-400 uppercase text-[9px] font-black">Last Updated By</p>
                  <p className="font-bold text-slate-800">{formData.updatedBy || "—"}</p>
                </div>
                <div>
                  <p className="text-slate-400 uppercase text-[9px] font-black">Last Updated Date</p>
                  <p className="font-bold text-slate-800">{formatStoredDateTime(formData.updatedDate)}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
      )}
      </section>
      )}

      {/* Navigation */}
      <div className="flex gap-3 justify-between pt-6 border-t border-slate-100">
        <button type="button" onClick={onCancel} disabled={isSubmitting} className="btn-secondary-geometric disabled:opacity-50">
          Discard
        </button>
        <div className="flex gap-3">
          {formStep > 1 && (
            <button type="button" onClick={goBack} disabled={isSubmitting} className="btn-secondary-geometric flex items-center gap-2 disabled:opacity-50">
              <ChevronLeft size={16} /> Back
            </button>
          )}
          {formStep < 3 ? (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={goNext}
              disabled={isSubmitting}
              className="btn-primary-geometric flex items-center gap-2 disabled:opacity-50"
            >
              Next <ChevronRight size={16} />
            </button>
          ) : (
            <button
              type="submit"
              disabled={isSubmitting || loading || !saveReady}
              className="btn-primary-geometric"
            >
              {isSubmitting || loading ? 'Saving...' : initialData ? 'Save Changes' : 'Register Asset'}
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
