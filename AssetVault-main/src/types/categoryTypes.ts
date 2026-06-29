export type FieldInputType =
  | 'text'
  | 'number'
  | 'date'
  | 'select'
  | 'checkbox'
  | 'textarea'
  | 'email';

export interface FieldDefinition {
  key: string;
  label: string;
  type: FieldInputType;
  required?: boolean;
  placeholder?: string;
  options?: string[];
  /** Map value into legacy Asset column on save (e.g. cpu ← processor) */
  legacyKey?: string;
}

export interface AssetTypeDefinition {
  id: string;
  name: string;
  mainCategory: string;
  subCategory?: string;
  departments?: string[];
  fields: FieldDefinition[];
  /** Keep RAM/CPU/SSD form blocks for IT laptop/desktop */
  useLegacyItForm?: boolean;
  defaultIcon?: string;
}

export interface TypeDefinitionsConfig {
  types: AssetTypeDefinition[];
  updatedAt?: string;
}
