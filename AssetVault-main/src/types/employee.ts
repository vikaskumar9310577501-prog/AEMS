export type EmployeeStatus = 'Active' | 'Inactive';

export interface Employee {
  employeeId: string;
  name: string;
  email: string;
  phone: string;
  department: string;
  /** Site / office location (dropdown from settings) */
  location: string;
  designation: string;
  /** Plant code from settings */
  plant: string;
  status: EmployeeStatus;
  createdAt?: string;
  updatedAt?: string;
}

export type AssignmentAction = 'Assign' | 'Return' | 'Transfer';

export interface AssignmentHistoryEntry {
  id: string;
  assetId: string;
  action: AssignmentAction;
  employeeId: string;
  employeeName: string;
  assignedDate: string;
  returnedDate?: string;
  assignedBy?: string;
  remarks?: string;
  fromEmployeeId?: string;
  fromEmployeeName?: string;
}

export const EMPTY_EMPLOYEE = (): Employee => ({
  employeeId: '',
  name: '',
  email: '',
  phone: '',
  department: '',
  location: '',
  designation: '',
  plant: '',
  status: 'Active',
});
