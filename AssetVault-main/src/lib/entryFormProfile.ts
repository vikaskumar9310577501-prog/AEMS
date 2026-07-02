import type { AssetFormData } from '../types';
import type { AssetTypeDefinition, TypeDefinitionsConfig } from '../types/categoryTypes';
import { PERIPHERAL_TYPES } from './assetCatalogByType';
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
  /** IT Assets: user enters code; other categories: auto-generated */
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
  const isItPeripheral = isItAssets && (PERIPHERAL_TYPES as readonly string[]).includes(formData.assetType);
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

  const isVehicle = mainCategory === 'Vehicle Assets';
  const isSoftware = mainCategory === 'Software / License Assets';

  return {
    mainCategory,
    isItAssets,
    isItPrimaryDevice,
    isItPeripheral,
    useAssetNameField: !isItAssets,
    useBrandModelFields: true,
    requireModelField: !isSoftware,
    requireMacAddress: isItPrimaryDevice,
    showNetworkFields: isItAssets && !isCctvSecurity,
    showLegacyItSpecs,
    showDynamicSpecs,
    isCctvSecurityDevice: !!isCctvSecurity,
    serialLabel: isSoftware ? 'License Key' : isVehicle ? 'Chassis / Engine No.' : 'Serial Number',
    assetCodeLabel: isSoftware ? 'Software Code' : isVehicle ? 'Internal Asset Code' : 'Asset Code',
    /** Always allow editing asset code, automatic ones will be pre-populated */
    manualAssetCode: true,
    requireSerialNumber: !isSoftware,
    makeLabel: isSoftware ? 'Publisher / Brand' : 'Brand / Make',
    modelLabel: isSoftware ? 'Product / Edition' : 'Model',
    assetNameLabel: isSoftware ? 'Software Name' : 'Asset Name',
    assetNamePlaceholder: isSoftware
      ? 'Enter software name'
      : isVehicle
        ? 'e.g. Company Swift — Plant 1'
        : 'Enter asset name',
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
  options?: { preserveFields?: boolean }
): AssetFormData {
  const cleared = options?.preserveFields ? prev : { ...prev, ...clearTypeSpecificFields() };

  if (mainCategory === 'IT Assets') {
    const sub = subCategory || 'Laptop / Desktop';
    const def = resolveTypeDefinition(typeConfig, {
      mainCategory,
      subCategory: sub,
      assetType: 'Laptop',
    });
    return {
      ...cleared,
      mainCategory,
      subCategory: sub,
      assetType: 'Laptop',
      assetTypeId: def?.id || 'laptop',
    };
  }

  const def = resolveTypeDefinition(typeConfig, { mainCategory, subCategory });
  const isSoftware = mainCategory === 'Software / License Assets';
  return {
    ...cleared,
    mainCategory,
    subCategory,
    assetType: (subCategory || mainCategory) as AssetFormData['assetType'],
    assetTypeId: def?.id || '',
    ...(isSoftware ? { condition: 'EXISTING ASSETS' as const } : {}),
  };
}
