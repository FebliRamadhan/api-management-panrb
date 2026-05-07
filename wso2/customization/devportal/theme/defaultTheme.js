/**
 * WSO2 Developer Portal - Custom Theme
 * Edit file ini untuk mengubah tampilan Developer Portal
 * Restart container WSO2 setelah perubahan: docker restart wso2-apim
 */

const Configurations = {
    custom: {
        appBar: {
            logo: '/site/public/images/logo.png',
            logoHeight: 40,
            logoWidth: 160,
            background: '#0f172a',
            activeBackground: '#1e293b',
            showSearch: true,
            showEnvironmentMenu: false,
        },
        footer: {
            active: true,
            text: '© 2024 Perusahaan Anda. Powered by WSO2 API Manager.',
            background: '#0f172a',
            color: '#94a3b8',
        },
        title: {
            prefix: '',
            sufix: '- API Portal',
        },
        landingPage: {
            active: true,
            carousel: {
                active: false,
            },
            listByTag: {
                active: true,
                displayName: 'Browse by Category',
                tags: ['finance', 'payment', 'data', 'internal'],
            },
            welcome: {
                active: false,
            },
        },
        themes: {
            light: {
                palette: {
                    primary: {
                        main: '#3b82f6',
                        light: '#60a5fa',
                        dark: '#1d4ed8',
                        contrastText: '#ffffff',
                    },
                    secondary: {
                        main: '#f59e0b',
                        light: '#fcd34d',
                        dark: '#b45309',
                        contrastText: '#000000',
                    },
                    background: {
                        default: '#f8fafc',
                        paper: '#ffffff',
                    },
                    text: {
                        primary: '#0f172a',
                        secondary: '#64748b',
                    },
                },
                typography: {
                    fontFamily: '"Plus Jakarta Sans", "Segoe UI", sans-serif',
                    h4: { fontWeight: 700 },
                    h5: { fontWeight: 600 },
                    h6: { fontWeight: 600 },
                },
                overrides: {
                    MuiButton: {
                        containedPrimary: {
                            borderRadius: '8px',
                            textTransform: 'none',
                            fontWeight: 600,
                            boxShadow: '0 1px 3px rgba(59,130,246,0.3)',
                        },
                    },
                    MuiCard: {
                        root: {
                            borderRadius: '12px',
                            border: '1px solid #e2e8f0',
                            boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                            transition: 'all 0.2s ease',
                            '&:hover': {
                                boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
                                transform: 'translateY(-2px)',
                            },
                        },
                    },
                    MuiChip: {
                        root: { borderRadius: '6px' },
                    },
                },
            },
        },
        globalCSSStyles: `
            @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap');

            * { box-sizing: border-box; }

            body {
                font-family: 'Plus Jakarta Sans', sans-serif !important;
                background: #f8fafc !important;
            }

            /* Navbar */
            header, .app-bar-header {
                box-shadow: 0 1px 0 #e2e8f0 !important;
                backdrop-filter: blur(8px);
            }

            /* API Cards hover */
            .MuiCard-root:hover {
                transform: translateY(-3px) !important;
                box-shadow: 0 12px 32px rgba(0,0,0,0.1) !important;
            }

            /* Tags */
            .MuiChip-root {
                font-weight: 500 !important;
                font-size: 0.75rem !important;
            }

            /* Buttons */
            .MuiButton-containedPrimary {
                background: linear-gradient(135deg, #3b82f6, #2563eb) !important;
                border-radius: 8px !important;
                font-weight: 600 !important;
                letter-spacing: 0.01em !important;
            }

            .MuiButton-containedPrimary:hover {
                background: linear-gradient(135deg, #2563eb, #1d4ed8) !important;
                box-shadow: 0 4px 12px rgba(59,130,246,0.4) !important;
            }

            /* Search bar */
            .MuiInputBase-root {
                border-radius: 10px !important;
            }

            /* Scrollbar */
            ::-webkit-scrollbar { width: 6px; }
            ::-webkit-scrollbar-track { background: #f1f5f9; }
            ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
            ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
        `,
    },
};
