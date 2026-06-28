/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    // El editor 2D/3D se valida con el dev server; no bloqueamos el build por lint.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
