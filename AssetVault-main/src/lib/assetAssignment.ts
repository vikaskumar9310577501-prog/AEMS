import type { Asset, AssetFormData } from '../types';

export const IN_HOUSE_ASSIGNEE_LABEL = 'In House';

export type AssetAssignmentMode = 'employee' | 'in_house';

export function isInHouseAssignment(
  asset: Pick<Asset, 'contactName' | 'employeeId'>
): boolean {
  const name = String(asset.contactName || '').trim().toLowerCase();
  if (name !== 'in house') return false;
  return !String(asset.employeeId || '').trim();
}

export function resolveAssignmentMode(
  asset?: Pick<Asset, 'contactName' | 'employeeId'> | null
): AssetAssignmentMode {
  if (asset && isInHouseAssignment(asset)) return 'in_house';
  return 'employee';
}

export function applyInHouseAssignmentPayload<T extends AssetFormData>(data: T): T {
  return {
    ...data,
    employeeId: '',
    contactEmail: '',
    contactMobile: '',
    assignedDate: '',
    returnDate: '',
    contactName: IN_HOUSE_ASSIGNEE_LABEL,
    status:
      data.status === 'Under Maintenance' || data.maintenanceRequired === 'Yes'
        ? 'Under Maintenance'
        : 'In Use',
  };
}

export function displayAssigneeLabel(asset: Pick<Asset, 'contactName' | 'employeeId'>): string {
  if (isInHouseAssignment(asset)) return IN_HOUSE_ASSIGNEE_LABEL;
  return String(asset.contactName || '').trim();
}
