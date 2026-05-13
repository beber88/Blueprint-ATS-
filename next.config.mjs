// Recruitment module top-level routes that should be reachable under
// the new /hr/recruitment/* URL prefix. Files stay where they are; the
// prefix is mapped via Next.js rewrites so legacy URLs keep working too.
const RECRUITMENT_ROUTES = [
  'dashboard',
  'candidates',
  'jobs',
  'interviews',
  'chat',
  'messages',
  'templates',
  'ai-agent',
  'categories',
  'files',
  'reports',
  'settings',
  'users',
  'guide',
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['pdf-parse'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
  },
  async rewrites() {
    return [
      // Bare /hr/recruitment lands on the recruitment dashboard.
      { source: '/hr/recruitment', destination: '/dashboard' },
      ...RECRUITMENT_ROUTES.flatMap((route) => [
        { source: `/hr/recruitment/${route}`, destination: `/${route}` },
        { source: `/hr/recruitment/${route}/:path*`, destination: `/${route}/:path*` },
      ]),
    ];
  },
  async redirects() {
    return [
      { source: '/hr', destination: '/hr/recruitment/dashboard', permanent: false },
    ];
  },
};

export default nextConfig;
