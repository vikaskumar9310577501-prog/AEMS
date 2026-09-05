import type { AssetFormData } from '../types';
import type { AssetTypeDefinition, TypeDefinitionsConfig } from '../types/categoryTypes';
import { CATEGORY_SUBCATEGORIES, PERIPHERAL_TYPES } from './assetCatalogByType';
import { resolveTypeDefinition } from './typeDefinitions';

export interface EntryFormProfile {
  mainCategory: string;
  isItAssets: boolean;
  isItPrimaryDevice: boolean;
  isItPeripheral: boolean;
  /** Non-IT: dedicated asset name field */
  useAssetNameField: boolean;
  /** IT: brand + model required */
  useBrandModelFields: boolean;
  requireModelField: boolean;
  /** Show MAC Address input and validate it (Laptop/Desktop only) */
  requireMacAddress: boolean;
  /** Show IP Address + Hostname fields (all IT assets) */
  showNetworkFields: boolean;
  showLegacyItSpecs: boolean;
  showDynamicSpecs: boolean;
  /** CCTV / Security Device (Camera) — custom field block after identity fields */
  isCctvSecurityDevice: boolean;
  serialLabel: string;
  assetCodeLabel: string;
  /** Software/edit forms use manual code entry; new assets in other categories are auto-generated. */
  manualAssetCode: boolean;
  requireSerialNumber: boolean;
  makeLabel: string;
  modelLabel: string;
  assetNameLabel: string;
  assetNamePlaceholder: string;
}

export function getEntryFormProfile(
  formData: Pick<AssetFormData, 'mainCategory' | 'assetType' | 'subCategory' | 'department'>,
  activeTypeDef: AssetTypeDefinition | null,
  options?: { isEditMode?: boolean }
): EntryFormProfile {
  const isEditMode = !!options?.isEditMode;
  const mainCategory = formData.mainCategory || 'IT Assets';
  const isItAssets = mainCategory === 'IT Assets';
  const isItPrimaryDevice = isItAssets && ['Laptop', 'Desktop'].includes(formData.assetType);
  const isInputOutput =
    isItAssets &&
    (
      formData.assetType === 'Input/Output Device' ||
      (PERIPHERAL_TYPES as readonly string[]).includes(formData.assetType) ||
      formData.subCategory === 'Input Device' ||
      formData.subCategory === 'Output Device' ||
      formData.subCategory?.toLowerCase().includes('input') ||
      formData.subCategory?.toLowerCase().includes('output')
    );
  const isItPeripheral = isInputOutput;
  const isCctvSecurity =
    activeTypeDef?.id === 'cctv_security' ||
    formData.assetType === 'Camera' ||
    formData.assetType === 'NVR' ||
    formData.subCategory === 'CCTV / Security Device';
  const showDynamicSpecs = !!(
    activeTypeDef &&
    !activeTypeDef.useLegacyItForm &&
    activeTypeDef.fields.length > 0 &&
    !isCctvSecurity
  );
  const showLegacyItSpecs = !!(activeTypeDef?.useLegacyItForm && isItPrimaryDevice);

  const isQuality = mainCategory === 'Quality Assets' || (formData.department || '').toLowerCase().includes('quality');
  const isProduction = mainCategory === 'Production Assets' || (formData.department || '').toLowerCase().includes('production') || (formData.department || '').toLowerCase().includes('mechanical');
  const isElectrical = mainCategory === 'Electrical Assets' || (formData.department || '').toLowerCase().includes('electrical');
  const isMaintenance = mainCategory === 'Maintenance Assets' || (formData.department || '').toLowerCase().includes('maintenance');
  const isSafety = mainCategory === 'Safety Assets' || (formData.department || '').toLowerCase().includes('safety');
  const isVehicle = mainCategory === 'Vehicle Assets';
  const isFurniture = mainCategory === 'Furniture Assets' || (formData.department || '').toLowerCase().includes('furniture') || (formData.department || '').toLowerCase().includes('admin');
  const isSoftware = mainCategory === 'Software / License Assets' || mainCategory === 'Software & Licenses';

  let serialLabel = 'Serial Number';
  let assetCodeLabel = 'Asset Code';
  let makeLabel = 'Brand / Make';
  let modelLabel = 'Model';
  let assetNameLabel = 'Asset Name';
  let assetNamePlaceholder = 'Enter asset name';
  let requireSerialNumber = true;

  if (isQuality) {
    serialLabel = 'Instrument / Gauge Serial No.';
    assetCodeLabel = 'Quality Tag / Asset Code';
    makeLabel = 'Instrument Brand / OEM';
    modelLabel = 'Model / Type No.';
    assetNameLabel = 'Instrument / Equipment Name';
    assetNamePlaceholder = 'e.g. Digital Vernier Caliper 0-150mm';
  } else if (isProduction) {
    serialLabel = 'Machine / Equipment Serial No.';
    assetCodeLabel = 'Machine / Plant Code';
    makeLabel = 'OEM / Manufacturer';
    modelLabel = 'Model / Specification';
    assetNameLabel = 'Machine / Equipment Name';
    assetNamePlaceholder = 'e.g. Copper Brazing Rig - Line 1';
  } else if (isElectrical) {
    serialLabel = 'Panel / Equipment Serial No.';
    assetCodeLabel = 'Electrical Asset Code';
    makeLabel = 'Manufacturer / Brand';
    modelLabel = 'Model / Rating';
    assetNameLabel = 'Electrical Equipment Name';
    assetNamePlaceholder = 'e.g. 500kVA Distribution Panel';
  } else if (isMaintenance) {
    serialLabel = 'Tool / Equipment Serial No.';
    assetCodeLabel = 'Maintenance Tool Code';
    makeLabel = 'Manufacturer / Brand';
    modelLabel = 'Model / Spec';
    assetNameLabel = 'Maintenance Tool / Asset Name';
    assetNamePlaceholder = 'e.g. Hydraulic Pipe Bender';
  } else if (isSafety) {
    serialLabel = 'Equipment / Cylinder Serial No.';
    assetCodeLabel = 'Safety Asset Code';
    makeLabel = 'Manufacturer / Brand';
    modelLabel = 'Model / Capacity';
    assetNameLabel = 'Safety Equipment Name';
    assetNamePlaceholder = 'e.g. CO2 Fire Extinguisher 4.5kg';
  } else if (isVehicle) {
    serialLabel = 'Chassis / Engine No.';
    assetCodeLabel = 'Internal Asset Code';
    makeLabel = 'Vehicle Make / Brand';
    modelLabel = 'Model / Variant';
    assetNameLabel = 'Vehicle Name / Number';
    assetNamePlaceholder = 'e.g. Company Swift — Plant 1';
  } else if (isFurniture) {
    serialLabel = 'Batch / Item Code (Optional)';
    requireSerialNumber = false;
    assetCodeLabel = 'Furniture Asset Code';
    makeLabel = 'Brand / Manufacturer';
    modelLabel = 'Model / Variant';
    assetNameLabel = 'Furniture / Item Name';
    assetNamePlaceholder = 'e.g. High-back Ergonomic Mesh Chair';
  } else if (isSoftware) {
    serialLabel = 'License Key / Subscription ID';
    requireSerialNumber = false;
    assetCodeLabel = 'Software Code';
    makeLabel = 'Publisher / Vendor';
    modelLabel = 'Edition / Version';
    assetNameLabel = 'Software Name';
    assetNamePlaceholder = 'e.g. SolidWorks 2026 Professional';
  }

  return {
    mainCategory,
    isItAssets,
    isItPrimaryDevice,
    isItPeripheral,
    useAssetNameField: !isItAssets,
    useBrandModelFields: true,
    requireModelField: !isSoftware,
    requireMacAddress: isItPrimaryDevice,
    showNetworkFields: isItAssets && !isInputOutput && !isCctvSecurity,
    showLegacyItSpecs,
    showDynamicSpecs,
    isCctvSecurityDevice: !!isCctvSecurity,
    serialLabel,
    assetCodeLabel,
    manualAssetCode: isSoftware || isEditMode,
    requireSerialNumber,
    makeLabel,
    modelLabel,
    assetNameLabel,
    assetNamePlaceholder,
  };
}

/** Clear fields that must not carry over when asset category / type changes */
export function clearTypeSpecificFields(): Partial<AssetFormData> {
  return {
    assetName: '',
    make: '',
    model: '',
    serialNumber: '',
    assetCode: '',
    macAddress: '',
    ipAddress: '',
    hostName: '',
    ram: '',
    ssd: '',
    cpu: '',
    windowsVersion: '',
    monitorSerial: '',
    monitorAssetCode: '',
    monitorMake: '',
    monitorModel: '',
    keyboardSerial: '',
    keyboardAssetCode: '',
    keyboardMake: '',
    keyboardModel: '',
    keyboardConnectivity: '',
    mouseSerial: '',
    mouseAssetCode: '',
    mouseMake: '',
    mouseModel: '',
    mouseConnectivity: '',
    upsSerial: '',
    upsAssetCode: '',
    upsMake: '',
    upsModel: '',
    dynamicDetails: {},
    accessories: { mouse: false, keyboard: false, monitor: false, ups: false },
  };
}

export function applyCategorySelection(
  prev: AssetFormData,
  mainCategory: string,
  subCategory: string,
  typeConfig: TypeDefinitionsConfig,
  options?: { preserveFields?: boolean; assetType?: string }
): AssetFormData {
  const cleared = options?.preserveFields ? prev : { ...prev, ...clearTypeSpecificFields() };

  if (mainCategory === 'IT Assets') {
    const sub = subCategory || 'Laptop / Desktop';
    const assetType = (options?.assetType || 'Laptop').trim() || 'Laptop';
    const def = resolveTypeDefinition(typeConfig, {
      mainCategory,
      subCategory: sub,
      assetType,
    });
    return {
      ...cleared,
      mainCategory,
      subCategory: sub,
      assetType: assetType as AssetFormData['assetType'],
      assetTypeId: def?.id || (assetType === 'Desktop' ? 'desktop' : 'laptop'),
    };
  }

  const typeSub = typeConfig.types.find((type) => type.mainCategory === mainCategory && type.subCategory)?.subCategory;
  const effectiveSubCategory = subCategory || CATEGORY_SUBCATEGORIES[mainCategory]?.[0] || typeSub || '';
  const def = resolveTypeDefinition(typeConfig, { mainCategory, subCategory: effectiveSubCategory });
  const isSoftware = mainCategory === 'Software / License Assets';
  return {
    ...cleared,
    mainCategory,
    subCategory: effectiveSubCategory,
    assetType: (effectiveSubCategory || mainCategory) as AssetFormData['assetType'],
    assetTypeId: def?.id || '',
    ...(isSoftware ? { condition: 'EXISTING ASSETS' as const } : {}),
  };
}
