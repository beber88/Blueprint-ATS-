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

// Operations Intelligence module top-level routes mounted under /hr/operations.
// Files live in app/(main)/operations/* — this rewrite block exposes them
// under the namespaced HR URL.
const OPERATIONS_ROUTES = [
  'dashboard',
  'intake',
  'issues',
  'hr-issues',
  'ceo-items',
  'missing-info',
  'attendance',
  'followups',
  'alerts',
  'archive',
  'projects',
  'departments',
  'employees',
  'ai-agent',
  'inbox',
  'digest',
];

// Contracts module top-level routes mounted under /hr/contracts. Files live in
// app/(main)/contracts/* — this rewrite block exposes them under the
// namespaced HR URL. Mirrors the OPERATIONS_ROUTES block above.
const CONTRACTS_ROUTES = [
  'dashboard',
  'intake',
  'drafts',
  'preview',
  'contracts',
  'alerts',
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['pdf-parse'],
  },
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

      // Bare /hr/operations lands on the operations dashboard.
      { source: '/hr/operations', destination: '/operations/dashboard' },
      ...OPERATIONS_ROUTES.flatMap((route) => [
        { source: `/hr/operations/${route}`, destination: `/operations/${route}` },
        { source: `/hr/operations/${route}/:path*`, destination: `/operations/${route}/:path*` },
      ]),

      // Bare /hr/contracts lands on the contracts dashboard.
      { source: '/hr/contracts', destination: '/contracts/dashboard' },
      ...CONTRACTS_ROUTES.flatMap((route) => [
        { source: `/hr/contracts/${route}`, destination: `/contracts/${route}` },
        { source: `/hr/contracts/${route}/:path*`, destination: `/contracts/${route}/:path*` },
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
