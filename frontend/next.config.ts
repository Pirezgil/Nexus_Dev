import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Configuração para rodar na porta 5000 conforme arquitetura ERP Nexus
  output: 'standalone',
  env: {
    CUSTOM_KEY: 'ERP_NEXUS_FRONTEND',
  },
  // Configurações de build otimizadas
  eslint: {
    ignoreDuringBuilds: false,
    dirs: ['src']
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  // Configurações de performance
  swcMinify: true,
  poweredByHeader: false,
  generateEtags: false,
  // Configurações para integração com backend - Todas via Gateway
  // Desenvolvimento: usa rewrites para API Gateway
  // Produção: usa URLs relativas (Nginx faz o proxy)
  async rewrites() {
    const isProduction = process.env.NODE_ENV === 'production';
    const isDevelopment = process.env.NODE_ENV === 'development';
    const gatewayUrl = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:5001';
    
    console.log('🔧 Next.js Rewrites Config:', {
      gatewayUrl,
      nodeEnv: process.env.NODE_ENV,
      port: process.env.PORT || '3000 (default)',
      isProduction,
      isDevelopment
    });
    
    // Em produção, o Nginx faz o proxy - não precisamos de rewrites
    if (isProduction) {
      console.log('🚀 Produção: Rewrites desabilitados (Nginx faz o proxy)');
      return [];
    }
    
    // Em desenvolvimento local (npm run dev), fazemos proxy para localhost
    // Em desenvolvimento Docker, as variáveis de ambiente fazem a comunicação direta
    if (isDevelopment && !process.env.NEXT_PUBLIC_API_BASE_URL) {
      console.log('🔧 Desenvolvimento local: Habilitando rewrites para localhost');
      return [
        {
          source: '/api/:path*',
          destination: `${gatewayUrl}/:path*`,
        },
        {
          source: '/uploads/:path*',
          destination: `${gatewayUrl}/uploads/:path*`,
        },
      ];
    }
    
    // Para desenvolvimento com API_BASE_URL definida, ainda precisamos dos rewrites
    // porque as chamadas do hook são para rotas relativas /api/*
    console.log('🔧 Desenvolvimento com API_BASE_URL: Habilitando rewrites para gateway');
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_BASE_URL}/:path*`,
      },
      {
        source: '/uploads/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_BASE_URL}/uploads/:path*`,
      },
    ];
  },
};

export default nextConfig;
