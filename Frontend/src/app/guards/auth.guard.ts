import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';

export const roleAuthGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const token = localStorage.getItem('token') || sessionStorage.getItem('token');
  const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');

  if (!token) {
    router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
    return false;
  }

  const expectedRoles = (route.data?.['roles'] as string[]) || [];

  if (userStr) {
    try {
      const user = JSON.parse(userStr);
      const userRole = user.role ? user.role.toLowerCase() : '';

      if (expectedRoles.length === 0 || expectedRoles.map((r) => r.toLowerCase()).includes(userRole)) {
        return true;
      }
    } catch (e) {
      console.error('Error parsing user session in guard:', e);
    }
  }

  // Fallback JWT token decode
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const userRole = payload.role ? payload.role.toLowerCase() : '';

    if (expectedRoles.length === 0 || expectedRoles.map((r) => r.toLowerCase()).includes(userRole)) {
      return true;
    }
  } catch (e) {
    console.error('Error decoding JWT payload in guard:', e);
  }

  router.navigate(['/login']);
  return false;
};

// Export legacy tpoAuthGuard for backwards compatibility
export const tpoAuthGuard: CanActivateFn = (route, state) => {
  route.data = { ...route.data, roles: ['tpo'] };
  return roleAuthGuard(route, state);
};
