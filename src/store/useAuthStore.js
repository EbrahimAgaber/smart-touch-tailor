import { create } from 'zustand';

// Reads from localStorage to persist role across reloads (default to Admin for instant preview)
const getSavedRole = () => localStorage.getItem('activeRole') || 'Admin';

// FIX BUG 8: Restore currentUser from localStorage so staff_id is never null after reload
const getSavedUser = () => {
  try {
    const stored = localStorage.getItem('currentUser');
    return stored ? JSON.parse(stored) : { id: 1, name: 'محمد العمري', role: 'Admin', permissions: [] };
  } catch {
    return { id: 1, name: 'محمد العمري', role: 'Admin', permissions: [] };
  }
};

export const useAuthStore = create((set) => ({
  role: getSavedRole(),
  currentUser: getSavedUser(),
  
  login: async (pin, staffId) => {
    try {
      const staff = await window.api.verifyStaffPin(pin, staffId);
      if (staff) {
        const staffObj = (staff.user && staff.user.id) ? staff.user : staff;
        // Normalize role to Proper Case for consistency
        const normalizedRole = staffObj.role ? (staffObj.role.charAt(0).toUpperCase() + staffObj.role.slice(1).toLowerCase()) : 'Cashier';
        
        localStorage.setItem('activeRole', normalizedRole);
        let permissions = [];
        try {
          permissions = typeof staffObj.permissions_json === 'string' 
            ? JSON.parse(staffObj.permissions_json || '[]') 
            : (staffObj.permissions_json || []);
        } catch {
          permissions = [];
        }

        const safeUser = { 
          id: staffObj.id || 1, 
          name: staffObj.name || 'محمد العمري', 
          role: normalizedRole,
          permissions: permissions
        };
        localStorage.setItem('currentUser', JSON.stringify(safeUser));
        set({ role: normalizedRole, currentUser: safeUser });
        return { success: true, staff: safeUser };
      }
      return { success: false, error: 'رمز المرور غير صحيح أو الموظف غير موجود' };
    } catch (e) {
      console.error("Login Error:", e);
      return { success: false, error: 'فشل الاتصال بالنظام: ' + e.message };
    }
  },
  
  logout: () => {
    localStorage.removeItem('activeRole');
    localStorage.removeItem('currentUser');
    set({ role: null, currentUser: null });
  }
}));

/**
 * Role-based and Permission-based access control helper.
 * Determines if the current user has visibility/access to a specific module.
 * @param {string} permission - The permission key (e.g., 'view_reports')
 * @returns {boolean}
 */
export const can = (permission) => {
  const state = useAuthStore.getState();
  const role = String(state.role || '').toLowerCase();
  const currentUser = state.currentUser;
  
  // 1. Admin always has full access (case-insensitive)
  if (role === 'admin') return true;
  
  // 2. If no role or user, no access
  if (!role || !currentUser) return false;

  // 3. Check granular permissions
  const userPerms = currentUser.permissions || [];
  
  // Map UI-level permission strings to database-level categories
  const mapping = {
    'view_dashboard':   ['reports'],
    'view_reports':     ['reports', 'accounts'],
    'view_stock':       ['stock'],
    'manage_purchases': ['stock'],
    'manage_menu':      ['stock'],
    'manage_staff':     ['settings'],
    'manage_settings':  ['settings'],
    'customers':        ['customers'],
  };

  const requiredCategories = mapping[permission] || [];
  
  // If a mapping exists, the user must have at least one of the required categories
  if (requiredCategories.length > 0) {
    return requiredCategories.some(cat => userPerms.includes(cat));
  }

  // If no mapping is defined, default to false for non-admins (safe default)
  return false;
};
