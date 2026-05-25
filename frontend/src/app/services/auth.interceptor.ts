import { HttpInterceptorFn } from '@angular/common/http';

const tokenKey = 'pu_cms_admin_token';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const token = localStorage.getItem(tokenKey);

  if (!token || !request.url.startsWith('/api/')) {
    return next(request);
  }

  return next(
    request.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    })
  );
};
