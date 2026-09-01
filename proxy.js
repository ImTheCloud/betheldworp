// Convention Next 16 : ce fichier s'appelait middleware.js et exportait
// « middleware ». Le nom du fichier ET celui de la fonction comptent tous les
// deux — Next refuse de construire si l'un des deux ne suit pas.
import { NextResponse } from 'next/server';

const locales = ['ro', 'fr', 'en', 'nl'];
const defaultLocale = 'ro';

function getLocale(request) {
  // 1. Check cookie
  const cookie = request.cookies.get('bethel_lang')?.value;
  if (cookie && locales.includes(cookie)) return cookie;

  // 2. Check Accept-Language header
  const acceptLang = request.headers.get('accept-language');
  if (acceptLang) {
    const preferred = acceptLang.split(',')[0].split('-')[0].toLowerCase();
    if (locales.includes(preferred)) return preferred;
  }

  return defaultLocale;
}

export function proxy(request) {
  const { pathname } = request.nextUrl;

  // Skip static assets and special routes explicitly via matcher, 
  // but double-check here just in case.
  if (
    pathname.includes('.') || 
    pathname.startsWith('/api') || 
    pathname.startsWith('/admin') ||
    pathname.startsWith('/_next')
  ) {
    return;
  }

  // Check if the pathname already has a supported locale
  const pathnameHasLocale = locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  );

  if (pathnameHasLocale) return;

  // Redirect to the detected locale
  const locale = getLocale(request);
  const url = request.nextUrl.clone();
  url.pathname = `/${locale}${pathname}`;
  
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    // Match all request paths except for the ones starting with:
    // - api (API routes)
    // - admin (Admin panel)
    // - _next/static (static files)
    // - _next/image (image optimization files)
    // - favicon.ico, images, icon.png (public files)
    '/((?!api|admin|_next/static|_next/image|favicon.ico|images|icon.png|logo.png|web.webmanifest).*)',
  ],
};
