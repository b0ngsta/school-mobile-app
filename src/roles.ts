// Role constants — kept in their own module (no imports except types) so
// screens and routes.ts can both use them without require cycles.
import type { Role } from './types';

export const MANAGER_ROLES: Role[] = ['admin', 'principal', 'sub_admin', 'coordinator'];
