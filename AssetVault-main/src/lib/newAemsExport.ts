import * as XLSX from 'xlsx';
import type { Asset } from '../types';
import type { Employee } from '../types/employee';

export function isItDepartment(deptName: string): boolean {
  const upper = String(deptName || '').trim().toUpperCase();
  return (
    upper === 'IT' ||
    upper === 'IT-SAP' ||
    upper === 'IT SAP' ||
    upper.includes('INFORMATION TECHNOLOGY') ||
    upper.includes('IT ASSET')
  );
}

export interface DepartmentExportOptions {
  department: string;
  assets: Asset[];
  employees: Employee[];
  location?: string;
  plant?: string;
}

export function exportDepartmentToNewAems(options: DepartmentExportOptions): { count: number; filename: string } {
  const { department, assets, employees, location, plant } = options;
  const isAll = !department || department === 'All' || department === 'ALL';
  const isIt = !isAll && isItDepartment(department);

  // Filter assets by department if a specific department is chosen
  const filteredAssets = isAll
    ? assets
    : assets.filter((a) => {
        const d = String(a.department || '').trim().toLowerCase();
        const target = department.trim().toLowerCase();
        if (isIt) {
          return isItDepartment(a.department || '') || String(a.mainCategory || '').toLowerCase().includes('it');
        }
        return d === target || d.includes(target);
      });

  const empMapById = new Map<string, Employee>();
  const empMapByName = new Map<string, Employee>();
  const empMapByEmail = new Map<string, Employee>();

  employees.forEach((emp) => {
    if (emp.employeeId) empMapById.set(emp.employeeId.trim().toUpperCase(), emp);
    if (emp.name) empMapByName.set(emp.name.trim().toLowerCase(), emp);
    if (emp.email) empMapByEmail.set(emp.email.trim().toLowerCase(), emp);
  });

  const rows = filteredAssets.map((asset) => {
    // Resolve custodian / employee
    let matchedEmp: Employee | undefined;
    const aEmpId = String((asset as any).employeeId || '').trim().toUpperCase();
    const aName = String(asset.contactName || '').trim().toLowerCase();
    const aEmail = String(asset.contactEmail || '').trim().toLowerCase();

    if (aEmpId && empMapById.has(aEmpId)) {
      matchedEmp = empMapById.get(aEmpId);
    } else if (aEmail && empMapByEmail.has(aEmail)) {
      matchedEmp = empMapByEmail.get(aEmail);
    } else if (aName && empMapByName.has(aName)) {
      matchedEmp = empMapByName.get(aName);
    }

    const assetName =
      (asset as any).assetName ||
      (asset.make && asset.model ? `${asset.make} ${asset.model}` : '') ||
      (asset as any).equipmentName ||
      asset.assetType ||
      'Equipment';

    const assetType = String(asset.assetType || (asset as any).category || (isIt ? 'LAPTOP' : 'EQUIPMENT')).toUpperCase();
    const serialNumber = String(asset.serialNumber || asset.assetCode || '').trim().toUpperCase();
    const manufacturer = asset.make || '';
    const model = asset.model || '';
    const hostname = (asset as any).hostName || (asset as any).hostname || '';
    const purchaseDate = (asset as any).purchaseDate || asset.warrantyStartDate || '';
    const purchaseCost = (asset as any).purchaseCost || (asset as any).cost || '';
    const vendorName = asset.vendorName || '';
    const poNumber = (asset as any).poNumber || asset.accountAssetCode || '';
    const warrantyExpiry = asset.warrantyEndDate || '';

    const empCode = matchedEmp?.employeeId || (asset as any).employeeId || '';
    const empName = matchedEmp?.name || asset.contactName || '';
    const empEmail = matchedEmp?.email || asset.contactEmail || '';
    const empPhone = matchedEmp?.phone || asset.contactMobile || '';
    const empDesig = matchedEmp?.designation || '';
    const remarks =
      (asset as any).remarks ||
      (asset as any).additionalItems ||
      (asset.status ? `Status: ${asset.status}` : '') ||
      '';

    if (isIt) {
      // 23-column IT format
      return {
        'Asset Name': assetName,
        'Asset Type': assetType,
        'Manufacturer / Brand': manufacturer,
        'Model': model,
        'Serial Number': serialNumber,
        'Processor / CPU': asset.cpu || '',
        'RAM Memory': asset.ram || '',
        'Storage Capacity': asset.ssd || (asset as any).hdd || (asset as any).storage || '',
        'Operating System': asset.windowsVersion || (asset as any).os || '',
        'Hostname': hostname,
        'MAC Address': asset.macAddress || '',
        'IP Address': (asset as any).ipAddress || '',
        'Purchase Date (YYYY-MM-DD)': purchaseDate,
        'Purchase Cost (INR)': purchaseCost ? Number(purchaseCost) || purchaseCost : '',
        'Vendor Name': vendorName,
        'PO Number': poNumber,
        'Warranty Expiry (YYYY-MM-DD)': warrantyExpiry,
        'Employee Code (Optional)': empCode,
        'Employee Full Name (Optional)': empName,
        'Employee Email (Optional)': empEmail,
        'Employee Phone (Optional)': empPhone,
        'Employee Designation (Optional)': empDesig,
        'Remarks (Optional)': remarks,
      };
    }

    // Non-IT Standard Industrial Format (17 columns)
    return {
      'Asset Name': assetName,
      'Asset Type': assetType,
      'Manufacturer / Brand': manufacturer,
      'Model': model,
      'Serial Number': serialNumber,
      'Hostname': hostname,
      'Purchase Date (YYYY-MM-DD)': purchaseDate,
      'Purchase Cost (INR)': purchaseCost ? Number(purchaseCost) || purchaseCost : '',
      'Vendor Name': vendorName,
      'PO Number': poNumber,
      'Warranty Expiry (YYYY-MM-DD)': warrantyExpiry,
      'Employee Code (Optional)': empCode,
      'Employee Full Name (Optional)': empName,
      'Employee Email (Optional)': empEmail,
      'Employee Phone (Optional)': empPhone,
      'Employee Designation (Optional)': empDesig,
      'Remarks (Optional)': remarks,
    };
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);

  // Auto-fit column widths
  if (rows.length > 0) {
    const colWidths = Object.keys(rows[0] || {}).map((k) => ({
      wch: Math.max(k.length + 3, 16),
    }));
    ws['!cols'] = colWidths;
  }

  const cleanDept = (isAll ? 'ALL ASSETS' : department).toUpperCase();
  const cleanLoc = location && location !== 'All' ? `_${location.replace(/[^A-Za-z0-9]/g, '_')}` : '';
  const cleanPlant = plant && plant !== 'All' ? `_${plant.replace(/[^A-Za-z0-9]/g, '_')}` : '';
  const sheetTitle = `${cleanDept.slice(0, 20)} Template`;
  XLSX.utils.book_append_sheet(wb, ws, sheetTitle);

  // Guidelines & Rules Sheet matching New AEMS v2 standard
  const guidelines = [
    ['AEMS v2 — SMART ASSET BATCH IMPORTER GUIDELINES'],
    ['Department:', cleanDept],
    ['Location Scope:', location && location !== 'All' ? location : 'All Locations'],
    ['Plant Scope:', plant && plant !== 'All' ? plant : 'All Plants'],
    ['Total Exported Rows:', filteredAssets.length],
    ['Export Timestamp:', new Date().toISOString()],
    [''],
    ['RULE 1: Genuine Excel Only', 'Only genuine .xlsx and .xls files are supported. CSV and other scripts are strictly rejected.'],
    ['RULE 2: Mandatory Columns', '"Asset Name" and "Serial Number" are strictly mandatory for each row.'],
    ['RULE 3: Unique Serial Numbers', 'Every serial number must be globally unique across PG Electroplast.'],
    ['RULE 4: Smart Custodian Handling', 'If "Employee Code" is provided and the employee does not exist in the database, AEMS will AUTOMATICALLY CREATE their active profile in the Staff Directory and link the asset!'],
    ['RULE 5: Inactive Employee Safety', 'If an employee code belongs to an inactive or resigned staff member, the asset will safely route to "In Stock".'],
    ['RULE 6: Unassigned to Stock', 'If Employee Code is left blank, the asset is automatically added directly to the "In Stock" available pool.'],
    ['RULE 7: Invoices & Photos', 'Physical asset photos, invoices, and warranty documents can be uploaded anytime via the "Edit Asset" screen.'],
  ];

  const wsGuide = XLSX.utils.aoa_to_sheet(guidelines);
  wsGuide['!cols'] = [{ wch: 35 }, { wch: 75 }];
  XLSX.utils.book_append_sheet(wb, wsGuide, 'Guidelines & Rules');

  const filename = `PGEL_${cleanDept.replace(/[^A-Z0-9]/g, '_')}${cleanLoc}${cleanPlant}_Import_Ready.xlsx`;
  XLSX.writeFile(wb, filename);

  return { count: rows.length, filename };
}
