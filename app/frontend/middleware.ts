import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('access_token')?.value;
  const pathname = request.nextUrl.pathname;

  // Rotas que requerem autenticação
  const protectedRoutes = ['/dashboard'];

  // Rotas públicas (sem autenticação)
  const publicRoutes = ['/login', '/forgot-password', '/reset-password', '/'];

  // Verifica se a rota atual é protegida
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));
  
  // Verifica se a rota é pública
  const isPublicRoute = publicRoutes.includes(pathname);

  // Se a rota é protegida e não há token, redireciona para login
  if (isProtectedRoute && !token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Se o usuário está logado e tenta acessar login/forgot-password, redireciona para dashboard
  if ((pathname === '/login' || pathname === '/forgot-password') && token) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!api|_next/static|_next/image|favicon.ico|public|version).*)',
  ],
};
