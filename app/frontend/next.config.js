const fs = require('fs');
const path = require('path');

const pdfWorkerSrc = path.join(__dirname, 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs');
const pdfWorkerDest = path.join(__dirname, 'public/pdf.worker.min.mjs');
if (fs.existsSync(pdfWorkerSrc)) {
  fs.mkdirSync(path.dirname(pdfWorkerDest), { recursive: true });
  fs.copyFileSync(pdfWorkerSrc, pdfWorkerDest);
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  transpilePackages: ['pdfjs-dist'],
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  experimental: {
    optimizeCss: true,
  },
  // Dev: proxy /api → backend para cookie HttpOnly na mesma origem (localhost:3000)
  async rewrites() {
    if (process.env.NODE_ENV !== 'development') {
      return [];
    }
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000';
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
  // Otimizações de performance
  poweredByHeader: false,
  compress: true,
  // Desabilitar mensagens de Fast Refresh no console
  onDemandEntries: {
    maxInactiveAge: 25 * 1000,
    pagesBufferLength: 2,
  },
}

module.exports = nextConfig

