import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Primary - Sage Green
        primary: {
          50: '#f0f4f3',
          100: '#e6ece8',
          200: '#b8d4cc',
          300: '#8fb9a8',
          400: '#5fa089',
          500: '#3e6658',
          600: '#2d4d43',
          700: '#224a3d',
          800: '#1a3730',
          900: '#132b26',
          950: '#0d1e1a',
        },
        // Secondary - Soft Coral
        secondary: {
          50: '#fef3f0',
          100: '#fce8e1',
          200: '#f9d6ca',
          300: '#f4b6a6',
          400: '#f09d85',
          500: '#e8826c',
          600: '#d96d55',
          700: '#c25645',
          800: '#a0463d',
          900: '#7f3a33',
          950: '#451f1a',
        },
        // Accent - Muted Blue
        accent: {
          50: '#f5f8fb',
          100: '#eaf1f8',
          200: '#dae5f2',
          300: '#6e8ca0',
          400: '#5a7b91',
          500: '#466a82',
          600: '#3a5873',
          700: '#2e4964',
          800: '#223a52',
          900: '#162b42',
          950: '#0f1e2f',
        },
        // Background colors
        surface: {
          50: '#f6faff',
          100: '#f0f8ff',
          200: '#eaf5ff',
          300: '#dff0ff',
          400: '#d8ebfa',
          500: '#d3e5f5',
        },
        // Text
        text: {
          primary: '#0b1d29',
          secondary: '#414845',
        },
      },
      fontFamily: {
        sans: ['Be Vietnam Pro', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        xs: '0.25rem',
        sm: '0.5rem',
        base: '1rem',
        md: '1.5rem',
        lg: '2rem',
        xl: '3rem',
      },
      spacing: {
        xs: '4px',
        sm: '12px',
        base: '8px',
        md: '24px',
        lg: '48px',
        xl: '80px',
      },
      boxShadow: {
        soft: '0px 4px 20px rgba(143, 185, 168, 0.1)',
        'soft-lg': '0px 12px 32px rgba(143, 185, 168, 0.15)',
        none: 'none',
      },
    },
  },
  plugins: [],
};
export default config;
