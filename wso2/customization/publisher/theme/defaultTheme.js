/**
 * WSO2 Publisher Portal - Custom Theme
 * Edit file ini untuk mengubah tampilan Publisher Portal
 */

const Configurations = {
    custom: {
        appBar: {
            logo: '/site/public/images/logo.png',
            logoHeight: 40,
            logoWidth: 160,
            background: '#0f172a',
            activeBackground: '#1e293b',
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
                },
                typography: {
                    fontFamily: '"Plus Jakarta Sans", "Segoe UI", sans-serif',
                },
                overrides: {
                    MuiButton: {
                        containedPrimary: {
                            borderRadius: '8px',
                            textTransform: 'none',
                            fontWeight: 600,
                        },
                    },
                    MuiDrawer: {
                        paper: {
                            background: '#0f172a',
                            color: '#e2e8f0',
                        },
                    },
                },
            },
        },
        globalCSSStyles: `
            @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap');
            body { font-family: 'Plus Jakarta Sans', sans-serif !important; }
            .MuiButton-containedPrimary {
                background: linear-gradient(135deg, #3b82f6, #2563eb) !important;
                border-radius: 8px !important;
                font-weight: 600 !important;
            }
        `,
    },
};
