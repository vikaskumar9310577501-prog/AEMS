export interface InventoryItem {
  itemId: string;
  assetCode: string;
  itemName: string;
  brandName: string;
  model: string;
  serialNumber: string;
  category: string;
  status: string;
  quantity: number;
  minStock: number;
  employeeId?: string;
  assigneeName?: string;
  assigneeEmail?: string;
  assigneeMobile?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: any;
}

export const EMPTY_INVENTORY_ITEM = (): InventoryItem => ({
  itemId: '',
  assetCode: '',
  itemName: '',
  brandName: '',
  model: '',
  serialNumber: '',
  category: 'IT Assets',
  status: 'Available',
  quantity: 0,
  minStock: 0,
  employeeId: '',
  assigneeName: '',
  assigneeEmail: '',
  assigneeMobile: '',
});
