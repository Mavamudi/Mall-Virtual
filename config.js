/**
 * Configuración centralizada para MR Confecciones
 * ADVERTENCIA: Las claves deben moverse a variables de entorno en producción (Vercel/Supabase).
 */

export const CONFIG = {
    SUPABASE: {
        URL: 'https://kcfuixvrwbnizspgtmtr.supabase.co',
        ANON_KEY: 'sb_publishable_-H23KD1xJafE_DFpBFZlyA_CL9sNlpG'
    },
    EMAILJS: {
        SERVICE_ID: 'service_cpbelnt',
        TEMPLATE_ID: 'template_3uzu4by',
        PUBLIC_KEY: 'h95_EWCJMHAz-OBUq'
    },
    MERCADOPAGO: {
        PUBLIC_KEY: 'APP_USR-bf94019e-d379-4f27-a242-0f60177dcddf'
    },
    WHATSAPP: '56998745436'
};

export const ASSETS = {
    manteleria: "assets/manteleria.png",
    turbante: "assets/turbante.png",
    poncho: "assets/hero-poncho.png",
    telas: "assets/telas-naranja.png",
    logo: "assets/logo-circular.png"
};

export const UI_DATA = {
    heroBanners: [
        { title: "MANTELERÍA INSTITUCIONAL", subtitle: "Elegancia y durabilidad para eventos y hogar.", btnText: "Ver Catálogo", image: ASSETS.manteleria, tag: "Calidad Premium" },
        { title: "TURBANTES DE MICROFIBRA", subtitle: "Secado ultra rápido que cuida tu cabello.", btnText: "Comprar Ahora", image: ASSETS.turbante, tag: "Secado Rápido" },
        { title: "CONFECCIÓN PERSONALIZADA", subtitle: "Trabajos a medida con las mejores telas del mercado.", btnText: "Cotizar Ahora", image: ASSETS.poncho, tag: "Hecho a Mano" }
    ],
    categories: [
        { id: 'manteleria', name: "MANTELERÍA GALA", description: "Tejidos exclusivos antimanchas y diseños personalizados para instituciones.", image: ASSETS.manteleria, tag: "Institucional", pattern: 'Mantel' },
        { id: 'microfibra', name: "MICROFIBRA PREMIUM", description: "Tecnología de secado rápido en toallas, turbantes y accesorios de alta gama.", image: ASSETS.turbante, tag: "Secado Rápido", pattern: 'Toalla,Turbante,Poncho' }
    ]
};
