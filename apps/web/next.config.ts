import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@atleti/ui', '@atleti/db', '@atleti/types'],
}

export default nextConfig
