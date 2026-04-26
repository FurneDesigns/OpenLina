/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: [
      'node-pty',
      '@xenova/transformers',
      'onnxruntime-node',
      'sharp',
    ],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = config.externals || []
      config.externals.push(
        'node-pty',
        '@xenova/transformers',
        'onnxruntime-node',
        'sharp',
      )
    }
    return config
  },
}

export default nextConfig
