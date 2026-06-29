export type AssetType = 'Laptop' | 'Desktop' | 'Monitor' | 'Keyboard' | 'Mouse' | 'UPS' | 'Printer' | 'QR Scanner' | 'Network Switch' | 'Camera' | 'NVR' | 'Network Rack' | 'Laptop Kit' | 'Attendance Machine' | 'External HDD' | 'Access Point' | 'Firewall' | 'Network Controller';

export interface DesktopAccessories {
  mouse: boolean;
  keyboard: boolean;
  monitor: boolean;
  ups: boolean;
}

export interface Plant {
  code: string; // custom identifier, e.g., "P-101"
  name: string;
  location: string;
  managerEmail?: string;
  notes?: string;
}

export interface User {
  email: string;
  role: string;
  locations: string[];
  plants: string[];
  categories?: string[];
}

export interface Asset {
  id?: number; // S No
  location: string;
  plantCode: string;
  department: string;
  make: string;
  model: string;
  serialNumber: string;
  assetCode?: string;
  accountAssetCode?: string;
  vendorName: string;
  warrantyStartDate?: string;
  warrantyEndDate?: string;
  // Peripheral Serials & Codes
  monitorSerial?: string;
  monitorAssetCode?: string;
  keyboardSerial?: string;
  keyboardAssetCode?: string;
  mouseSerial?: string;
  mouseAssetCode?: string;
  upsSerial?: string;
  upsAssetCode?: string;
  ram: string;
  ssd: string;
  cpu: string;
  windowsVersion: string;
  assetType: AssetType;
  accessories?: DesktopAccessories;
  macAddress: string;
  contactName: string;
  contactEmail: string;
  contactMobile: string;
  additionalItems?: string;
  documentUrl?: string;
  imageUrl?: string;
  qrCodeText: string;
  qrCodeImage: string; // This will store the base64 or a placeholder if we can't save image to sheets directly (typically we save the URL/Text)
  uniqueCode: string; // 5-digit
  binaryCode: string; // 0 or 1

  // Company-Level Fields
  assetName?: string;
  mainCategory?: string;
  subCategory?: string;
  quantity?: number | string;
  employeeId?: string;
  /** New fields for IT assets */
  ipAddress?: string;
  hostName?: string;
  purchaseDate?: string;
  purchaseCost?: string | number;
  invoiceNumber?: string;
  condition?: 'NEW PURCHASE' | 'EXISTING ASSETS' | 'EXISTING SOFTWARE' | 'Renewable' | 'Average' | 'Poor' | 'Damaged' | 'New' | 'Good';
  status?: 'Available' | 'Assigned' | 'In Use' | 'Under Maintenance' | 'Damaged' | 'Lost' | 'Scrap' | 'Sold';
  maintenanceRequired?: 'Yes' | 'No';
  lastMaintenanceDate?: string;
  nextMaintenanceDate?: string;
  createdBy?: string;
  createdDate?: string;
  updatedBy?: string;
  updatedDate?: string;
  extraItems?: string;
  missingItems?: string;
  assignedDate?: string;
  returnDate?: string;

  // AMC Fields
  amcVendor?: string;
  amcStartDate?: string;
  amcEndDate?: string;
  amcCost?: string | number;

  /** EAV dynamic fields (Fan, Vehicle, custom types) — not stored in RAM/SSD columns */
  dynamicDetails?: Record<string, string>;
  /** Links to Category_Definitions type id */
  assetTypeId?: string;
}

export interface AssetFormData extends Omit<Asset, 'id' | 'qrCodeText' | 'qrCodeImage' | 'uniqueCode' | 'binaryCode'> {}

