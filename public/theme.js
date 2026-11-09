tailwind.config = {
  theme: {
    extend: {
      colors: {
        'primary': '#871919',
        'primary-container': '#a8322d',
        'on-primary': '#ffffff',
        'on-primary-container': '#ffc9c3',
        'secondary': '#605e5a',
        'tertiary-container': '#974417',
        'surface': '#fdf9f1',
        'surface-bright': '#fdf9f1',
        'surface-container-lowest': '#ffffff',
        'surface-container-low': '#f7f3eb',
        'surface-container': '#f1ede5',
        'surface-container-high': '#ece8e0',
        'on-surface': '#1c1c17',
        'on-surface-variant': '#58413f',
        'outline': '#8c716e',
        'outline-variant': '#dfbfbc',
        'error': '#ba1a1a'
      },
      borderRadius: { DEFAULT: '0.125rem', lg: '0.25rem', xl: '0.5rem', full: '0.75rem' },
      spacing: {
        'space-xs': '0.25rem', 'space-sm': '0.5rem', 'space-md': '1rem', 'space-lg': '1.5rem',
        'space-xl': '2.5rem', 'gutter': '1.5rem', 'gutter-sm': '1rem', 'margin': '2rem', 'margin-sm': '1rem'
      },
      fontFamily: {
        'headline-xl': ['Space Mono'], 'headline-lg': ['Space Mono'], 'headline-md': ['Space Mono'],
        'headline-sm': ['Space Mono'], 'label-md': ['Space Mono'], 'label-sm': ['Space Mono'],
        'mono-data': ['Space Mono'], 'body-lg': ['DM Sans'], 'body-md': ['DM Sans'], 'body-sm': ['DM Sans']
      },
      fontSize: {
        'headline-xl': ['40px', { lineHeight: '48px', letterSpacing: '-0.02em', fontWeight: '700' }],
        'headline-xl-mobile': ['28px', { lineHeight: '36px', letterSpacing: '-0.01em', fontWeight: '700' }],
        'headline-lg': ['32px', { lineHeight: '40px', letterSpacing: '-0.01em', fontWeight: '700' }],
        'headline-md': ['22px', { lineHeight: '28px', fontWeight: '700' }],
        'headline-sm': ['18px', { lineHeight: '24px', fontWeight: '700' }],
        'label-md': ['13px', { lineHeight: '18px', letterSpacing: '0.08em', fontWeight: '700' }],
        'label-sm': ['11px', { lineHeight: '16px', letterSpacing: '0.12em', fontWeight: '700' }],
        'mono-data': ['14px', { lineHeight: '20px', fontWeight: '400' }],
        'body-lg': ['18px', { lineHeight: '28px', fontWeight: '400' }],
        'body-md': ['15px', { lineHeight: '22px', fontWeight: '400' }],
        'body-sm': ['13px', { lineHeight: '18px', fontWeight: '400' }]
      }
    }
  }
};
