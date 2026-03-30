/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./public/**/*.{html,js}",
    "./public/*.html"
  ],
  theme: {
    extend: {
      colors: {
        "surface-container-highest": "#e1e3e3",
        "background": "#f8fafa",
        "surface-tint": "#29695b",
        "on-secondary-fixed-variant": "#2e4b57",
        "on-error-container": "#93000a",
        "on-tertiary-fixed-variant": "#3c494f",
        "on-primary-fixed-variant": "#065043",
        "on-tertiary-fixed": "#101d23",
        "outline": "#707975",
        "tertiary-container": "#38454b",
        "inverse-on-surface": "#eff1f1",
        "secondary-container": "#c6e4f4",
        "surface-container": "#eceeee",
        "surface-dim": "#d8dada",
        "outline-variant": "#bfc9c4",
        "tertiary-fixed-dim": "#bbc9d0",
        "surface-variant": "#e1e3e3",
        "on-background": "#191c1d",
        "surface-container-lowest": "#ffffff",
        "tertiary-fixed": "#d7e5ec",
        "on-tertiary": "#ffffff",
        "on-primary": "#ffffff",
        "surface-bright": "#f8fafa",
        "surface-container-low": "#f2f4f4",
        "primary-fixed-dim": "#94d3c1",
        "secondary": "#466270",
        "on-surface-variant": "#3f4945",
        "on-tertiary-container": "#a4b2b9",
        "primary-fixed": "#afefdd",
        "on-secondary-container": "#4a6774",
        "error-container": "#ffdad6",
        "primary-container": "#004d40",
        "surface": "#f8fafa",
        "primary": "#00342b",
        "error": "#ba1a1a",
        "on-secondary-fixed": "#001f2a",
        "on-primary-container": "#7ebdac",
        "on-surface": "#191c1d",
        "on-secondary": "#ffffff",
        "secondary-fixed-dim": "#adcbda",
        "on-error": "#ffffff",
        "secondary-fixed": "#c9e7f7",
        "surface-container-high": "#e6e8e9",
        "inverse-surface": "#2e3131",
        "inverse-primary": "#94d3c1",
        "tertiary": "#222f34",
        "on-primary-fixed": "#00201a"
      },
      fontFamily: {
        "headline": ["Manrope"],
        "body": ["Inter"],
        "label": ["Inter"]
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/container-queries')
  ],
}
