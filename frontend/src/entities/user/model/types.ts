export interface User {
  id: string;
  displayName: string;
  email: string;
  pendingEmail?: string | null;
  createdAt: string;
}
