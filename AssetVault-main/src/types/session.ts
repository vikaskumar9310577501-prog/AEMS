export interface AppSessionUser {
  email: string;
  role: string;
  locations: string[];
  plants: string[];
  categories?: string[];
  allowDelete?: boolean;
}
