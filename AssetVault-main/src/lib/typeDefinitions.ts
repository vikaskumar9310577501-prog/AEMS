import type { AssetTypeDefinition, FieldDefinition, TypeDefinitionsConfig } from '../types/categoryTypes';

export const DEFAULT_TYPE_DEFINITIONS: AssetTypeDefinition[] = [
  {
    id: 'laptop',
    name: 'Laptop',
    mainCategory: 'IT Assets',
    subCategory: 'Laptop / Desktop',
    useLegacyItForm: true,
    fields: [
      { key: 'processor', label: 'Processor', type: 'text', required: true, legacyKey: 'cpu' },
      { key: 'ram', label: 'RAM', type: 'select', required: true, options: ['4GB', '8GB', '16GB', '32GB', '64GB'], legacyKey: 'ram' },
      { key: 'rom', label: 'ROM / Storage', type: 'select', required: true, options: ['128GB', '256GB', '512GB', '1TB', '2TB'], legacyKey: 'ssd' },
      { key: 'windows_version', label: 'Windows Version', type: 'select', options: ['Windows 10 Pro', 'Windows 11 Pro', 'Windows 11 Home', 'macOS', 'Linux'], legacyKey: 'windowsVersion' },
      { key: 'charger_available', label: 'Charger Available', type: 'select', options: ['Yes', 'No'] },
    ],
  },
  {
    id: 'desktop',
    name: 'Desktop',
    mainCategory: 'IT Assets',
    subCategory: 'Laptop / Desktop',
    useLegacyItForm: true,
    fields: [
      { key: 'processor', label: 'Processor', type: 'text', required: true, legacyKey: 'cpu' },
      { key: 'ram', label: 'RAM', type: 'select', required: true, options: ['4GB', '8GB', '16GB', '32GB'], legacyKey: 'ram' },
      { key: 'rom', label: 'Storage', type: 'select', required: true, options: ['256GB', '512GB', '1TB', '2TB'], legacyKey: 'ssd' },
      { key: 'windows_version', label: 'Windows Version', type: 'select', legacyKey: 'windowsVersion', options: ['Windows 10 Pro', 'Windows 11 Pro'] },
    ],
  },
  {
    id: 'vehicle',
    name: 'Car / Vehicle',
    mainCategory: 'Vehicle Assets',
    fields: [
      { key: 'vehicle_number', label: 'Vehicle Number', type: 'text', required: true },
      { key: 'vehicle_type', label: 'Vehicle Type', type: 'select', options: ['Car', 'Bike', 'Truck', 'Forklift', 'E-Rickshaw'] },
      { key: 'rc_number', label: 'RC Number', type: 'text' },
      { key: 'insurance_expiry', label: 'Insurance Expiry', type: 'date', required: true },
      { key: 'pollution_expiry', label: 'Pollution Expiry', type: 'date' },
      { key: 'driver_assigned', label: 'Driver Assigned', type: 'text' },
      { key: 'fuel_type', label: 'Fuel Type', type: 'select', options: ['Petrol', 'Diesel', 'CNG', 'Electric', 'Hybrid'] },
      { key: 'kilometers', label: 'Kilometers', type: 'number' },
    ],
  },
  {
    id: 'fan',
    name: 'Fan',
    mainCategory: 'Furniture Assets',
    subCategory: 'Fan',
    fields: [
      { key: 'fan_type', label: 'Fan Type', type: 'select', options: ['Ceiling', 'Table', 'Wall', 'Exhaust', 'Industrial'] },
      { key: 'fan_size', label: 'Size', type: 'text' },
      { key: 'installation_date', label: 'Installation Date', type: 'date' },
      { key: 'maintenance_status', label: 'Maintenance Status', type: 'select', options: ['OK', 'Due', 'Overdue'] },
    ],
  },
  {
    id: 'ac',
    name: 'Air Conditioner (AC)',
    mainCategory: 'Furniture Assets',
    subCategory: 'AC',
    fields: [
      { key: 'tonnage', label: 'Tonnage / Capacity', type: 'select', options: ['1.0 Ton', '1.5 Ton', '2.0 Ton', '3.0 Ton', 'Other'] },
      { key: 'star_rating', label: 'Energy Star Rating', type: 'select', options: ['1 Star', '2 Star', '3 Star', '4 Star', '5 Star'] },
      { key: 'compressor_type', label: 'Compressor Type', type: 'select', options: ['Inverter', 'Non-Inverter'] },
    ],
  },
  {
    id: 'office_asset_gen',
    name: 'Office Asset (General)',
    mainCategory: 'Furniture Assets',
    fields: [
      { key: 'material', label: 'Material', type: 'select', options: ['Wood', 'Metal', 'Plastic', 'Glass', 'Other'] },
      { key: 'dimensions', label: 'Dimensions', type: 'text' },
    ],
  },
  {
    id: 'printer',
    name: 'Printer',
    mainCategory: 'IT Assets',
    subCategory: 'Printer / Scanner',
    fields: [
      { key: 'printer_type', label: 'Printer Type', type: 'select', options: ['Laser', 'Inkjet', 'Dot Matrix', 'Thermal'] },
      { key: 'ip_address', label: 'IP Address', type: 'text', legacyKey: 'ipAddress' },
      { key: 'toner_model', label: 'Toner Model', type: 'text' },
      { key: 'network_location', label: 'Location', type: 'text' },
    ],
  },
  {
    id: 'monitor',
    name: 'Monitor',
    mainCategory: 'IT Assets',
    subCategory: 'Output Device',
    fields: [
      { key: 'screen_size', label: 'Screen Size', type: 'text', placeholder: 'e.g. 24 inch' },
      { key: 'resolution', label: 'Resolution', type: 'text', placeholder: 'e.g. 1920x1080' },
      { key: 'panel_type', label: 'Panel Type', type: 'select', options: ['IPS', 'VA', 'TN', 'OLED'] },
    ],
  },
  {
    id: 'network_device',
    name: 'Network Device',
    mainCategory: 'IT Assets',
    subCategory: 'Network Device',
    fields: [
      { key: 'ip_address', label: 'IP Address', type: 'text', legacyKey: 'ipAddress' },
      { key: 'ports_count', label: 'Number of Ports', type: 'number' },
      { key: 'firmware_version', label: 'Firmware Version', type: 'text' },
    ],
  },
  {
    id: 'cctv_security',
    name: 'CCTV / Security Device',
    mainCategory: 'IT Assets',
    subCategory: 'CCTV / Security Device',
    fields: [
      { key: 'camera_resolution', label: 'Camera Resolution', type: 'select', options: ['2MP', '4MP', '5MP', '8MP (4K)', 'N/A'] },
      { key: 'channel_count', label: 'Channels (for NVR)', type: 'select', options: ['4 Channel', '8 Channel', '16 Channel', '32 Channel', 'N/A'] },
      { key: 'location_name', label: 'Location Name', type: 'text', placeholder: 'e.g. Main Gate, Warehouse A', legacyKey: 'hostName' },
    ],
  },
  {
    id: 'server_ups',
    name: 'Server / UPS',
    mainCategory: 'IT Assets',
    subCategory: 'Server / UPS',
    fields: [
      { key: 'capacity_rating', label: 'Capacity / Rating', type: 'text', placeholder: 'e.g. 1000VA, 2U Server' },
      { key: 'ip_address', label: 'Management IP (if any)', type: 'text', legacyKey: 'ipAddress' },
      { key: 'battery_replacement_due', label: 'Battery Replacement Due', type: 'date' },
    ],
  },
  {
    id: 'software_license',
    name: 'Software License',
    mainCategory: 'Software / License Assets',
    fields: [
      { key: 'email_id', label: 'Email ID', type: 'email', required: true },
      { key: 'purchase_date', label: 'Purchase Date', type: 'date', legacyKey: 'purchaseDate' },
      { key: 'license_type', label: 'License Type', type: 'select', options: ['Standard', 'Basic', 'With Teams', 'Without Teams', 'Perpetual', 'Subscription (Monthly)', 'Subscription (Annual)', 'Open Source', 'OEM'] },
      { key: 'renewal_date', label: 'Renewal Date', type: 'date', legacyKey: 'warrantyEndDate' },
      { key: 'seats', label: 'Seats / License Count', type: 'number' },
    ],
  },
  {
    id: 'generator',
    name: 'Generator',
    mainCategory: 'Electrical Assets',
    subCategory: 'Generator',
    fields: [
      { key: 'capacity_kva', label: 'Capacity (kVA)', type: 'number', required: true },
      { key: 'fuel_type', label: 'Fuel Type', type: 'select', options: ['Diesel', 'Gas', 'Petrol', 'Other'] },
      { key: 'phase', label: 'Phase Type', type: 'select', options: ['Three Phase', 'Single Phase'] },
    ],
  },
  {
    id: 'inverter',
    name: 'Inverter',
    mainCategory: 'Electrical Assets',
    subCategory: 'Inverter',
    fields: [
      { key: 'capacity_kva', label: 'Capacity (kVA)', type: 'text' },
      { key: 'inverter_type', label: 'Inverter Type', type: 'select', options: ['Sine Wave', 'Square Wave', 'Hybrid', 'Other'] },
    ],
  },
  {
    id: 'battery',
    name: 'Battery',
    mainCategory: 'Electrical Assets',
    subCategory: 'Battery',
    fields: [
      { key: 'battery_capacity_ah', label: 'Capacity (AH)', type: 'number', required: true },
      { key: 'voltage_rating', label: 'Voltage Rating', type: 'select', options: ['12V', '24V', '48V', 'Other'] },
      { key: 'battery_type', label: 'Battery Type', type: 'select', options: ['Tubular', 'Flat Plate', 'SMF / VRLA', 'Lithium-Ion'] },
    ],
  },
  {
    id: 'electrical_asset',
    name: 'Electrical Asset (General)',
    mainCategory: 'Electrical Assets',
    fields: [
      { key: 'power_rating', label: 'Power Rating (Watts/kW)', type: 'text' },
      { key: 'voltage', label: 'Operating Voltage', type: 'select', options: ['220V (Single Phase)', '415V (Three Phase)', '12V / 24V DC', 'Other'] },
      { key: 'capacity', label: 'Capacity (AH/KVA)', type: 'text', placeholder: 'e.g. 150AH, 10KVA' },
    ],
  },
  {
    id: 'production_asset',
    name: 'Production Asset',
    mainCategory: 'Production Assets',
    fields: [
      { key: 'power_source', label: 'Power Source', type: 'select', options: ['Electricity', 'Pneumatic (Air)', 'Hydraulic', 'Manual', 'Other'] },
    ],
  },
  {
    id: 'safety_asset',
    name: 'Safety Asset',
    mainCategory: 'Safety Assets',
    fields: [
      { key: 'safety_standard', label: 'Safety Standard / Cert', type: 'text', placeholder: 'e.g. ISI, CE' },
    ],
  },
  {
    id: 'furniture_asset',
    name: 'Furniture Asset',
    mainCategory: 'Furniture Assets',
    fields: [
      { key: 'material', label: 'Material Type', type: 'select', options: ['Wood', 'Metal', 'Plastic', 'Glass', 'Leather', 'Fabric', 'Other'] },
      { key: 'dimensions', label: 'Dimensions (L x W x H)', type: 'text' },
      { key: 'color', label: 'Color', type: 'text' },
    ],
  },
  {
    id: 'admin_facility_asset',
    name: 'Admin / Facility Asset',
    mainCategory: 'Furniture Assets',
    fields: [
      { key: 'facility_use', label: 'Facility Use / Location', type: 'text' },
      { key: 'consumable', label: 'Consumable Type', type: 'select', options: ['Asset', 'Semi-Consumable', 'Consumable'] },
    ],
  },
  {
    id: 'quality_testing_instrument',
    name: 'Quality Testing & Measuring Instrument',
    mainCategory: 'Quality Assets',
    subCategory: 'Precision Measuring Instrument',
    fields: [
      { key: 'instrument_type', label: 'Instrument Type', type: 'select', options: ['Vernier Caliper', 'Digital Micrometer', 'Height Gauge', 'Dial Indicator / Bore Gauge', 'Digital Torque Wrench', 'Coating Thickness (DFT Meter)', 'Surface Roughness Tester', 'Digital Weighing Scale', 'Pin Gauge / Thread Gauge Set', 'Hardness Tester', 'Other Measuring Tool'], required: true },
      { key: 'least_count', label: 'Least Count / Resolution', type: 'text', placeholder: 'e.g. 0.01 mm, 0.001 mm, 0.1 N·m' },
      { key: 'range_capacity', label: 'Measurement Range', type: 'text', placeholder: 'e.g. 0-150 mm, 0-25 mm, 0-100 N·m' },
      { key: 'calibration_cert_no', label: 'Calibration Certificate No.', type: 'text', placeholder: 'e.g. CAL-QC-2026-089' },
      { key: 'calibration_agency', label: 'Calibration Agency / Lab', type: 'select', options: ['NABL Accredited External Lab', 'In-House Quality Metrology Lab', 'OEM / Manufacturer Certified Lab'] },
      { key: 'calibration_date', label: 'Last Calibration Date', type: 'date' },
      { key: 'calibration_due_date', label: 'Calibration Due Date', type: 'date', required: true },
      { key: 'calibration_frequency', label: 'Calibration Frequency', type: 'select', options: ['3 Months', '6 Months', '12 Months (Annual)', '24 Months'] },
      { key: 'quality_stage', label: 'QC Inspection Stage', type: 'select', options: ['Incoming QC (IQC - Raw Material)', 'In-Process QC (IPQC - Assembly/Press)', 'Final Line QC (PQC - Finished Goods)', 'Reliability & Metrology Lab'] },
      { key: 'certificate_document', label: 'Calibration Certificate (Doc/URL)', type: 'file' },
    ],
  },
  {
    id: 'ac_performance_leak_tester',
    name: 'AC Leak & Gas Charging Instrument',
    mainCategory: 'Quality Assets',
    subCategory: 'AC Leak & Gas Charging Equipment',
    fields: [
      { key: 'tester_type', label: 'Leak / Charging Instrument Type', type: 'select', options: ['Helium Leak Detection Sniffer', 'Electronic Halogen Leak Detector', 'Digital Vacuum Gauge / Micron Meter', 'Refrigerant Auto-Charging Station', 'High Pressure Nitrogen Test Rig', 'Ultrasonic Leak Detector', 'Submerged Water Dip Leak Tank Rig'], required: true },
      { key: 'refrigerant_compatibility', label: 'Refrigerant Gas Compatibility', type: 'select', options: ['R32 (Eco AC)', 'R410A', 'R22', 'R134a', 'R290', 'Multi-Refrigerant Universal'] },
      { key: 'operating_pressure', label: 'Working / Test Pressure Range', type: 'text', placeholder: 'e.g. 0-50 Bar / 0-725 PSI' },
      { key: 'leak_sensitivity', label: 'Sensitivity / Detection Limit', type: 'text', placeholder: 'e.g. 1x10^-5 mbar·l/s or 3g/year' },
      { key: 'calibration_due_date', label: 'Sensor Calibration Due Date', type: 'date', required: true },
      { key: 'ac_production_line', label: 'AC Production Line / Station', type: 'select', options: ['Indoor Unit (IDU) Assembly Line', 'Outdoor Unit (ODU) Assembly Line', 'Heat Exchanger / Copper Brazing Station', 'Vacuum & Charging Station', 'Final Testing Chamber'] },
      { key: 'sop_number', label: 'Quality SOP / Test Ref', type: 'text', placeholder: 'e.g. SOP-QC-AC-LEAK-01' },
      { key: 'calibration_doc', label: 'Sensor Test Certificate', type: 'file' },
    ],
  },
  {
    id: 'ac_electrical_safety_tester',
    name: 'Electrical Safety & Performance Rig',
    mainCategory: 'Quality Assets',
    subCategory: 'Electrical Safety & Performance Rig',
    fields: [
      { key: 'equipment_type', label: 'Testing Equipment Type', type: 'select', options: ['Hi-Pot Tester (Dielectric Withstand)', 'Earth Continuity / Ground Bond Tester', 'Insulation Resistance Tester (Megger)', 'Digital Power Analyzer (V, A, W, PF)', 'Multi-Channel Temperature Data Logger', 'Sound Level (dB) Meter', 'Air Velocity / CFM Anemometer', 'Psychrometric Chamber Data Logger', 'Burst Pressure Testing Rig'], required: true },
      { key: 'test_voltage_kv', label: 'Test Voltage / Parameter Range', type: 'text', placeholder: 'e.g. 0-5 kV AC, 0-1000V DC, 0-50A' },
      { key: 'compliance_standard', label: 'Quality Compliance Standard', type: 'select', options: ['IS 1391 (Indian Standard for Room AC)', 'IEC 60335-2-40 (Appliance Safety)', 'BEE Star Rating Energy Efficiency Test', 'ISO 9001 / IATF 16949 Standard', 'CE / UL International Standard'] },
      { key: 'calibration_due_date', label: 'Calibration Due Date', type: 'date', required: true },
      { key: 'accuracy_class', label: 'Accuracy Class / Tolerance', type: 'text', placeholder: 'e.g. Class 0.5 / ±0.5%' },
      { key: 'sensor_channels', label: 'Channels / Probes (if logger)', type: 'select', options: ['1-4 Channels', '8 Channels', '16 Channels', '32 Channels (Psychrometric)', 'N/A'] },
      { key: 'testing_room_location', label: 'Testing Lab / Line Station', type: 'text', placeholder: 'e.g. AC Performance Test Lab, Line 2 Safety Rig' },
      { key: 'compliance_cert', label: 'Compliance / Calibration Report', type: 'file' },
    ],
  },
  {
    id: 'maintenance_asset',
    name: 'Maintenance Tool / Asset',
    mainCategory: 'Maintenance Assets',
    fields: [
      { key: 'tool_type', label: 'Tool Category', type: 'select', options: ['Hand Tool', 'Power Tool', 'Measuring Instrument', 'Safety Gear', 'Other'] },
      { key: 'calibration_due_date', label: 'Calibration Due Date', type: 'date' },
    ],
  },
];

export const DEFAULT_DEPARTMENTS: DepartmentDefinition[] = [
  { id: 'it', name: 'IT', active: true, displayOrder: 1 },
  { id: 'maintenance', name: 'Maintenance', active: true, displayOrder: 2 },
  { id: 'electrical', name: 'Electrical', active: true, displayOrder: 3 },
  { id: 'mechanical', name: 'Mechanical', active: true, displayOrder: 4 },
  { id: 'civil', name: 'Civil', active: true, displayOrder: 5 },
  { id: 'corporate', name: 'Corporate', active: true, displayOrder: 6 },
  { id: 'admin', name: 'Admin', active: true, displayOrder: 7 },
  { id: 'hr', name: 'HR', active: true, displayOrder: 8 },
  { id: 'production', name: 'Production', active: true, displayOrder: 9 },
  { id: 'quality', name: 'Quality', active: true, displayOrder: 10 },
  { id: 'store', name: 'Store', active: true, displayOrder: 11 },
  { id: 'safety', name: 'Safety', active: true, displayOrder: 12 },
  { id: 'purchase', name: 'Purchase', active: true, displayOrder: 13 },
  { id: 'finance', name: 'Finance', active: true, displayOrder: 14 },
];

export function defaultTypeDefinitionsConfig(): TypeDefinitionsConfig {
  return {
    types: structuredClone ? structuredClone(DEFAULT_TYPE_DEFINITIONS) : JSON.parse(JSON.stringify(DEFAULT_TYPE_DEFINITIONS)),
    departments: structuredClone ? structuredClone(DEFAULT_DEPARTMENTS) : JSON.parse(JSON.stringify(DEFAULT_DEPARTMENTS)),
    updatedAt: new Date().toISOString(),
  };
}

const SOFTWARE_LICENSE_CATEGORY = 'Software / License Assets';

function patchSoftwareLicenseType(
  type: AssetTypeDefinition,
  softwareDefaults: AssetTypeDefinition
): AssetTypeDefinition {
  if (type.mainCategory !== SOFTWARE_LICENSE_CATEGORY) return type;
  return { ...softwareDefaults, ...type, fields: softwareDefaults.fields };
}

function patchCctvSecurityType(
  type: AssetTypeDefinition,
  cctvDefaults: AssetTypeDefinition
): AssetTypeDefinition {
  if (type.id !== 'cctv_security') return type;
  return { ...cctvDefaults, ...type, fields: cctvDefaults.fields };
}

export function mergeTypeDefinitions(saved?: TypeDefinitionsConfig | null): TypeDefinitionsConfig {
  const base = defaultTypeDefinitionsConfig();
  if (!saved) return base;

  // Merge Departments
  const deptMap = new Map<string, DepartmentDefinition>();
  for (const d of base.departments || []) deptMap.set(d.id.toLowerCase(), d);
  for (const d of saved.departments || []) {
    const id = (d.id || d.name).toLowerCase().replace(/[^a-z0-9]+/g, '_');
    const existing = deptMap.get(id);
    deptMap.set(id, { ...existing, ...d, id });
  }

  // Merge Types
  const softwareDefaults = base.types.find((t) => t.id === 'software_license');
  const cctvDefaults = base.types.find((t) => t.id === 'cctv_security');

  const byId = new Map<string, AssetTypeDefinition>();
  for (const t of base.types) byId.set(t.id, t);
  for (const t of saved.types || []) {
    let patched = softwareDefaults ? patchSoftwareLicenseType(t, softwareDefaults) : t;
    if (cctvDefaults) patched = patchCctvSecurityType(patched, cctvDefaults);
    byId.set(t.id, patched);
  }

  return {
    types: Array.from(byId.values()),
    departments: Array.from(deptMap.values()).sort((a, b) => (a.displayOrder || 99) - (b.displayOrder || 99)),
    updatedAt: saved.updatedAt || base.updatedAt,
  };
}

function norm(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function resolveTypeDefinition(
  config: TypeDefinitionsConfig,
  opts: { assetTypeId?: string; assetType?: string; mainCategory?: string; subCategory?: string }
): AssetTypeDefinition | null {
  const { assetTypeId, assetType, mainCategory, subCategory } = opts;
  const main = mainCategory || '';
  const sub = subCategory || '';
  const typeNorm = norm(assetType || '');
  const inMain = (t: AssetTypeDefinition) => !main || !t.mainCategory || t.mainCategory === main;

  if (main === SOFTWARE_LICENSE_CATEGORY) {
    return (
      config.types.find((t) => t.id === 'software_license') ||
      config.types.find((t) => t.mainCategory === main && !t.subCategory) ||
      null
    );
  }

  /** Laptop and Desktop share "Laptop / Desktop" — name/id must win over first subcategory match. */
  if (typeNorm) {
    const byName = config.types.find(
      (t) => (norm(t.name) === typeNorm || norm(t.id) === typeNorm) && inMain(t)
    );
    if (byName) return byName;
  }

  if (assetTypeId) {
    const byId = config.types.find((t) => t.id === assetTypeId && inMain(t));
    if (byId) return byId;
  }

  if (main && sub) {
    const matches = config.types.filter((t) => t.mainCategory === main && t.subCategory === sub);
    if (matches.length === 1) return matches[0];
    if (matches.length > 1) {
      const named = matches.find(
        (t) => norm(t.name) === typeNorm || norm(t.id) === typeNorm || t.id === assetTypeId
      );
      if (named) return named;
      return matches[0];
    }
  }

  if (main) {
    const mainWide = config.types.find(
      (t) => t.mainCategory === main && (!t.subCategory || t.subCategory === '')
    );
    if (mainWide) return mainWide;
  }

  if (main && sub) {
    const loose = config.types.find(
      (t) =>
        t.mainCategory === main &&
        !!t.subCategory &&
        (sub.toLowerCase().includes(t.subCategory.toLowerCase()) ||
          t.subCategory.toLowerCase().includes(sub.toLowerCase()))
    );
    if (loose) return loose;
  }

  return null;
}

/** Copy dynamic field values into legacy Asset columns where configured */
export function applyLegacyFieldMapping(
  asset: Record<string, unknown>,
  typeDef: AssetTypeDefinition | null,
  dynamicDetails: Record<string, string>
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...asset, dynamicDetails: { ...dynamicDetails } };
  if (!typeDef) return out;

  for (const field of typeDef.fields) {
    const val = dynamicDetails[field.key];
    if (val === undefined || val === '') continue;
    if (field.legacyKey) {
      out[field.legacyKey] = val;
      out.dynamicDetails[field.key] = val;
    }
  }

  if (typeDef.mainCategory === SOFTWARE_LICENSE_CATEGORY) {
    delete (out.dynamicDetails as Record<string, string>).outlook_status;
    delete (out.dynamicDetails as Record<string, string>).version;
  }

  const ip =
    String(out.ipAddress || '').trim() ||
    String(dynamicDetails.ip_address || dynamicDetails.ipAddress || '').trim();
  const host =
    String(out.hostName || '').trim() ||
    String(
      dynamicDetails.host_name ||
        dynamicDetails.hostname ||
        dynamicDetails.hostName ||
        dynamicDetails.location_name ||
        ''
    ).trim();
  if (ip) out.ipAddress = ip;
  if (host) out.hostName = host;

  return out;
}

/** Build dynamicDetails from legacy asset when loading edit form */
export function legacyToDynamicDetails(
  typeDef: AssetTypeDefinition | null,
  asset: Record<string, unknown>
): Record<string, string> {
  const details: Record<string, string> = { ...(asset.dynamicDetails as Record<string, string>) };
  if (!typeDef) return details;

  if (typeDef.mainCategory === SOFTWARE_LICENSE_CATEGORY) {
    delete details.outlook_status;
    delete details.version;
  }

  for (const field of typeDef.fields) {
    if (field.legacyKey && asset[field.legacyKey]) {
      details[field.key] = String(asset[field.legacyKey]);
    }
  }
  return details;
}

export function emptyDynamicValues(fields: FieldDefinition[]): Record<string, string> {
  const o: Record<string, string> = {};
  for (const f of fields) o[f.key] = '';
  return o;
}
