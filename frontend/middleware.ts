// ERP Nexus - Next.js Middleware
// Middleware para proteção de rotas e redirecionamentos de autenticação

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Rotas que não requerem autenticação
const PUBLIC_ROUTES = [
  '/',
  '/login',
  '/forgot-password',
  '/reset-password',
  '/register',
];

// Rotas da API que devem ser ignoradas pelo middleware
const API_ROUTES = [
  '/api',
  '/_next',
  '/favicon.ico',
  '/sitemap.xml',
  '/robots.txt',
];

// Rotas que requerem autenticação
const PROTECTED_ROUTES = [
  '/dashboard',
  '/crm',
  '/services',
  '/agendamento',
  '/relatorios',
];

/**
 * Middleware do Next.js para:
 * 1. Proteger rotas que requerem autenticação
 * 2. Redirecionar usuários logados da página de login
 * 3. Gerenciar fluxo de navegação baseado em autenticação
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Desabilitar middleware em desenvolvimento para evitar conflitos
  if (process.env.NODE_ENV === 'development') {
    return NextResponse.next();
  }
  
  // Ignorar rotas da API e recursos estáticos
  if (API_ROUTES.some(route => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Verificar se o usuário tem token de autenticação
  const token = request.cookies.get('erp_nexus_token')?.value ||
                request.headers.get('authorization')?.replace('Bearer ', '');

  // Para desenvolvimento, também verificar localStorage via header customizado
  const hasStorageToken = request.headers.get('x-has-token') === 'true';

  const isAuthenticated = Boolean(token || hasStorageToken);

  // Se estiver em uma rota pública
  if (PUBLIC_ROUTES.includes(pathname)) {
    // Se estiver logado e tentando acessar login, redirecionar para dashboard
    if (isAuthenticated && pathname === '/login') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    
    // Permitir acesso a rotas públicas
    return NextResponse.next();
  }

  // Se estiver em uma rota protegida sem autenticação
  if (PROTECTED_ROUTES.some(route => pathname.startsWith(route))) {
    if (!isAuthenticated) {
      // Salvar a URL de destino para redirecionamento após login
      const loginUrl = new URL('/login', request.url);
      if (pathname !== '/') {
        loginUrl.searchParams.set('callbackUrl', pathname);
      }
      
      return NextResponse.redirect(loginUrl);
    }
  }

  // Rota não encontrada ou outras rotas - permitir Next.js lidar
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
     * - public folder files
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

export default middleware;