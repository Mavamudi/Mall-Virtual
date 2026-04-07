/* =============================================
   MR CONFECCIONES — Logic v3.0 (Modular & Secure)
   ============================================= */

import { CONFIG, ASSETS, UI_DATA } from './config.js';
import { escapeHTML, formatCLP } from './utils.js';

// --- STATE MANAGEMENT ---
const state = {
    allErpProducts: [],
    cart: JSON.parse(localStorage.getItem('mr_confecciones_cart_real')) || [],
    isAdmin: false,
    editMode: false,
    currentSlide: 0,
    supabase: null,
    erp: null,
    mp: null,
    dom: {},
    editingImageEl: null,
    theme: localStorage.getItem('mr_theme') || 'dark',
    storeId: 'mr_confecciones', // Default fallback
    storeConfig: {}
};

/**
 * Gestión de Autenticación Admin
 */
async function initAuth() {
    if (!state.supabase) return;

    // Escuchar cambios de sesión
    state.supabase.auth.onAuthStateChange((event, session) => {
        state.isAdmin = !!session;
        updateAdminUI();
        console.info(`Auth Event: ${event}`, state.isAdmin ? '(Admin Logged In)' : '(Guest Mode)');
    });

    // Verificar sesión inicial
    const { data: { session } } = await state.supabase.auth.getSession();
    state.isAdmin = !!session;
    updateAdminUI();
    initTheme();
}

function initTheme() {
    const savedTheme = localStorage.getItem('mr_theme') || 'dark';
    applyTheme(savedTheme);
}

function applyTheme(theme) {
    const body = document.body;
    const darkIcon = document.getElementById('theme-icon-dark');
    const lightIcon = document.getElementById('theme-icon-light');

    if (theme === 'light') {
        body.classList.add('light-theme');
        if (darkIcon) darkIcon.classList.replace('scale-100', 'scale-0'), darkIcon.classList.add('opacity-0');
        if (lightIcon) lightIcon.classList.replace('scale-0', 'scale-100'), lightIcon.classList.remove('opacity-0');
    } else {
        body.classList.remove('light-theme');
        if (darkIcon) darkIcon.classList.replace('scale-0', 'scale-100'), darkIcon.classList.remove('opacity-0');
        if (lightIcon) lightIcon.classList.replace('scale-100', 'scale-0'), lightIcon.classList.add('opacity-0');
    }
}

window.toggleTheme = () => {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('mr_theme', state.theme);
    applyTheme(state.theme);
};

function updateAdminUI() {
    const sidebar = document.getElementById('admin-sidebar');
    const trigger = document.getElementById('admin-sidebar-trigger');

    if (state.isAdmin) {
        sidebar.classList.remove('-translate-x-full');
        if (trigger) {
            trigger.classList.add('opacity-0', 'pointer-events-none');
        }
    } else {
        if (sidebar) sidebar.classList.add('-translate-x-full');
        if (trigger) {
            trigger.classList.add('opacity-0', 'pointer-events-none');
        }
        state.editMode = false;
        document.body.classList.remove('admin-edit-active');
    }
}

window.openAdminLogin = () => {
    const modal = document.getElementById('admin-login-modal');
    modal.classList.remove('opacity-0', 'pointer-events-none');
    modal.children[0].classList.remove('translate-y-10');
};

window.closeAdminLogin = () => {
    const modal = document.getElementById('admin-login-modal');
    modal.classList.add('opacity-0', 'pointer-events-none');
    modal.children[0].classList.add('translate-y-10');
};

window.toggleAdminSidebar = () => {
    const sidebar = document.getElementById('admin-sidebar');
    const trigger = document.getElementById('admin-sidebar-trigger');
    const isCollapsed = sidebar.classList.toggle('-translate-x-full');

    if (trigger) {
        if (isCollapsed) {
            trigger.classList.remove('opacity-0', 'pointer-events-none');
        } else {
            trigger.classList.add('opacity-0', 'pointer-events-none');
        }
    }
};

window.adminLogout = async () => {
    await state.supabase.auth.signOut();
    location.reload();
};

window.handleChangePassword = async () => {
    const newPassword = prompt("Introduce la nueva clave para el administrador (mínimo 6 caracteres):");

    if (!newPassword) return;
    if (newPassword.length < 6) {
        showToast("La clave debe tener al menos 6 caracteres", "error");
        return;
    }

    const confirmPass = confirm("¿Estás seguro de que quieres cambiar la clave? Tendrás que iniciar sesión nuevamente.");
    if (!confirmPass) return;

    const { error } = await state.supabase.auth.updateUser({ password: newPassword });

    if (error) {
        console.error("Error al cambiar clave:", error);
        showToast("Error: " + error.message, "error");
    } else {
        showToast("¡Clave actualizada correctamente! Reiniciando...");
        setTimeout(() => {
            state.supabase.auth.signOut();
            location.reload();
        }, 2000);
    }
};

window.toggleEditMode = () => {
    state.editMode = !state.editMode;
    const btn = document.getElementById('edit-mode-btn');
    if (state.editMode) {
        btn.classList.add('bg-primary', 'text-white');
        document.body.classList.add('admin-edit-active');
        enableLiveEdit();
    } else {
        btn.classList.remove('bg-primary', 'text-white');
        document.body.classList.remove('admin-edit-active');
        disableLiveEdit();
    }
};

let clickInterceptor = null;

function enableLiveEdit() {
    // Interceptor Global para bloquear navegación
    clickInterceptor = (e) => {
        if (!state.editMode) return;

        const isAdminUI = e.target.closest('#admin-sidebar') ||
            e.target.closest('#admin-login-modal') ||
            e.target.closest('#admin-sidebar-trigger') ||
            e.target.closest('#media-manager-modal') ||
            e.target.closest('#category-modal'); // Permitir navegación interna del modal
        if (isAdminUI) return;

        // Bloquear SIEMPRE la navegación por defecto (links, botones) si estamos editando
        e.preventDefault();

        // Evitar que el clic llegue a otros listeners (como el de abrir categorías)
        const isEditable = e.target.closest('.admin-editable') || e.target.closest('.admin-editable-img');
        if (!isEditable) {
            e.stopPropagation();
        }
    };
    window.addEventListener('click', clickInterceptor, true);

    // Texto
    const editables = document.querySelectorAll('h1, h2, h3, h4, p, span, button');
    editables.forEach(el => {
        if (el.closest('#admin-sidebar') || el.closest('#admin-login-modal')) return;

        el.dataset.oldContent = el.innerHTML;
        el.contentEditable = 'true';
        el.classList.add('admin-editable');

        el.onblur = async () => {
            if (el.innerHTML !== el.dataset.oldContent) {
                await saveContent(el);
            }
        };
    });

    // --- IMAGES EDITING ---
    const images = document.querySelectorAll('img');
    images.forEach((img, i) => {
        if (img.closest('#admin-sidebar') || img.closest('#admin-login-modal') || img.closest('#media-manager-modal')) return;

        if (!img.id) img.id = `editable-img-${i}`;
        img.classList.add('admin-editable-img');

        img.onclick = (e) => {
            if (!state.editMode) return;
            e.preventDefault();
            e.stopPropagation();
            window.openMediaManager(img);
        };
    });
}

function disableLiveEdit() {
    if (clickInterceptor) {
        window.removeEventListener('click', clickInterceptor, true);
        clickInterceptor = null;
    }

    const editables = document.querySelectorAll('.admin-editable');
    editables.forEach(el => {
        el.contentEditable = 'false';
        el.classList.remove('admin-editable');
    });

    const images = document.querySelectorAll('.admin-editable-img');
    images.forEach(img => {
        img.classList.remove('admin-editable-img');
        img.onclick = null;
    });
}

/**
 * GESTIÓN DE MULTIMEDIA (STORAGE)
 */
window.openMediaManager = async (targetEl = null) => {
    state.editingImageEl = targetEl;
    const modal = document.getElementById('media-manager-modal');
    if (!modal) return;
    modal.classList.remove('opacity-0', 'pointer-events-none');

    const footer = document.getElementById('media-footer');
    if (footer) footer.classList.add('hidden');

    await loadMediaGallery();
};

window.closeMediaManager = () => {
    const modal = document.getElementById('media-manager-modal');
    if (modal) modal.classList.add('opacity-0', 'pointer-events-none');
    state.editingImageEl = null;
};

async function loadMediaGallery() {
    const grid = document.getElementById('media-grid');
    if (!grid) return;
    grid.innerHTML = '<div class="col-span-full text-center py-20 text-slate-500 italic">Cargando biblioteca...</div>';

    try {
        const { data, error } = await state.supabase.storage.from('site-assets').list('', {
            limit: 100,
            offset: 0,
            sortBy: { column: 'created_at', order: 'desc' }
        });

        if (error) throw error;

        if (!data || data.length === 0) {
            grid.innerHTML = '<div class="col-span-full text-center py-20 text-slate-500 italic">No hay archivos aún. ¡Sube tu primera foto!</div>';
            return;
        }

        grid.innerHTML = data.map(file => {
            const { data: { publicUrl } } = state.supabase.storage.from('site-assets').getPublicUrl(file.name);
            return `
                <div class="group relative aspect-square bg-white/5 rounded-3xl overflow-hidden border border-white/5 hover:border-primary/50 transition-all cursor-pointer" 
                     onclick="selectMedia('${publicUrl}', '${file.name}')">
                    <img src="${publicUrl}" class="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-all">
                    
                    <!-- Botón Eliminar -->
                    <button onclick="event.stopPropagation(); deleteMedia('${file.name}', '${publicUrl}')" 
                            class="absolute top-3 right-3 w-8 h-8 rounded-full bg-red-500/20 text-red-400 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center hover:bg-red-500 hover:text-white border border-red-500/20">
                        <span class="material-symbols-outlined text-sm">delete</span>
                    </button>

                    <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all flex items-end p-4 pointer-events-none">
                        <p class="text-[8px] text-white truncate font-bold uppercase tracking-widest">${file.name}</p>
                    </div>
                </div>
            `;
        }).join('');

    } catch (err) {
        console.error("Error al cargar galería:", err);
        grid.innerHTML = `<div class="col-span-full text-center py-20 text-red-400 italic">Error al conectar con Storage. Asegúrate de que el bucket 'site-assets' existe y es público.</div>`;
    }
}

window.uploadMedia = async (input) => {
    if (!input.files || input.files.length === 0) return;
    const files = Array.from(input.files);
    const statusEl = document.getElementById('save-status');
    let totalFiles = files.length;
    let uploadedCount = 0;

    try {
        for (const file of files) {
            uploadedCount++;
            if (statusEl) {
                statusEl.innerHTML = `<span class="material-symbols-outlined text-lg animate-spin">cloud_upload</span><span class="text-[10px] uppercase font-bold tracking-widest text-primary">Subiendo ${uploadedCount}/${totalFiles}...</span>`;
            }

            const fileName = `${Date.now()}-${file.name.replace(/\s/g, '_')}`;
            const { error } = await state.supabase.storage
                .from('site-assets')
                .upload(fileName, file);

            if (error) {
                console.error(`Error subiendo ${file.name}:`, error);
                showToast(`Error con "${file.name}"`);
            }
        }

        showToast(totalFiles > 1 ? `¡${totalFiles} imágenes subidas con éxito!` : "¡Imagen subida con éxito!");
        await loadMediaGallery();
    } catch (err) {
        console.error("Error masivo de subida:", err);
        showToast("Ocurrió un error inesperado al subir archivos.");
    } finally {
        input.value = '';
        if (statusEl) {
            statusEl.innerHTML = `<span class="material-symbols-outlined text-lg">cloud_done</span><span class="text-[10px] uppercase font-bold tracking-widest">Cambios Sincronizados</span>`;
        }
    }
};

window.deleteMedia = async (name, url) => {
    // 1. Verificar si la imagen está en uso EN EL DOM actual (ignorando la propia galería)
    const inUseInDOM = Array.from(document.querySelectorAll('img:not(#media-grid img):not(#media-selection-preview)'))
        .some(img => img.src === url);

    // 2. Verificar si la imagen está en uso EN LA BASE DE DATOS
    const { data: inDb, error: dbError } = await state.supabase
        .from('site_content')
        .select('id')
        .eq('content', url);

    if (inUseInDOM || (inDb && inDb.length > 0)) {
        showToast("No se puede eliminar: Esta imagen está siendo usada en la página.", "error");
        return;
    }

    // 3. Confirmar eliminación
    if (!confirm(`¿Estás seguro de que quieres eliminar "${name}"? Esta acción no se puede deshacer.`)) return;

    try {
        const { error } = await state.supabase.storage
            .from('site-assets')
            .remove([name]);

        if (error) throw error;

        showToast("Imagen eliminada correctamente");
        await loadMediaGallery();

        // Limpiar preview si era la misma
        const preview = document.getElementById('media-selection-preview');
        if (preview && preview.src === url) {
            const footer = document.getElementById('media-footer');
            if (footer) footer.classList.add('hidden');
        }
    } catch (err) {
        console.error("Error al eliminar:", err);
        showToast("Error al eliminar el archivo.");
    }
};

window.selectMedia = (url, name) => {
    const footer = document.getElementById('media-footer');
    const preview = document.getElementById('media-selection-preview');
    const nameEl = document.getElementById('media-selection-name');
    const selectBtn = document.getElementById('media-select-btn');

    if (footer) footer.classList.remove('hidden');
    if (preview) preview.src = url;
    if (nameEl) nameEl.textContent = name;

    if (selectBtn) {
        selectBtn.onclick = async () => {
            if (state.editingImageEl) {
                state.editingImageEl.src = url;
                await saveContent(state.editingImageEl, 'src');
            }
            closeMediaManager();
        };
    }
};

async function saveContent(el, type = 'html') {
    const statusEl = document.getElementById('save-status');
    if (statusEl) {
        statusEl.innerHTML = `<span class="material-symbols-outlined text-lg animate-spin">sync</span><span class="text-[10px] uppercase font-bold tracking-widest text-primary">Guardando...</span>`;
        statusEl.className = "flex items-center gap-3 px-4 py-3 rounded-xl bg-primary/10 border border-primary/20 text-primary";
    }

    if (!el.id) {
        el.id = 'txt-' + Math.random().toString(36).substr(2, 5);
    }

    const content = type === 'src' ? el.src : el.innerHTML;

    const { error } = await state.supabase
        .from('site_content')
        .upsert({ id: el.id, content: content, store_id: state.storeId });

    if (error) {
        console.error('Error al guardar:', error);
        if (statusEl) {
            statusEl.innerHTML = `<span class="material-symbols-outlined text-lg">error</span><span class="text-[10px] uppercase font-bold tracking-widest text-red-500">Error al guardar</span>`;
            statusEl.className = "flex items-center gap-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500";
        }
    } else {
        if (type === 'html') el.dataset.oldContent = el.innerHTML;
        console.log('Guardado:', el.id);
        
        // Si el elemento pertenece a la sección dinámica, actualizar el layout global
        if (el.closest('#dynamic-sections')) {
            await saveDynamicLayout();
        }

        if (statusEl) {
            statusEl.innerHTML = `<span class="material-symbols-outlined text-lg">cloud_done</span><span class="text-[10px] uppercase font-bold tracking-widest">Cambios Sincronizados</span>`;
            statusEl.className = "flex items-center gap-3 px-4 py-3 rounded-xl bg-green-500/10 border border-green-500/20 text-green-500";
        }
        await loadDynamicContent();
    }
}

window.forceSaveAll = async () => {
    const statusEl = document.getElementById('save-status');
    if (statusEl) {
        statusEl.innerHTML = `<span class="material-symbols-outlined text-lg animate-spin">database</span><span class="text-[10px] uppercase font-bold tracking-widest">Verificando...</span>`;
    }
    await loadDynamicContent();
    showToast("¡Persistencia verificada con la base de datos!");
};

async function loadDynamicContent() {
    if (!state.supabase) return;
    const { data, error } = await state.supabase
        .from('site_content')
        .select('*')
        .eq('store_id', state.storeId);

    if (data) {
        data.forEach(item => {
            if (item.id === 'dynamic-layout') {
                const container = document.getElementById('dynamic-sections');
                if (container) {
                    container.innerHTML = item.content;
                    // Re-habilitar edición si estamos en modo editor
                    if (state.editMode) enableLiveEdit();
                }
                return;
            }
            const el = document.getElementById(item.id);
            if (el) {
                if (el.tagName === 'IMG') {
                    el.src = item.content;
                } else {
                    el.innerHTML = item.content;
                }
            }
        });
    }
}

window.addDynamicBlock = async (type) => {
    const container = document.getElementById('dynamic-sections');
    if (!container) return;

    let html = '';
    const id = 'block-' + Date.now();

    if (type === 'gallery') {
        html = `
            <section id="${id}" class="py-20 px-6 lg:px-20 group relative">
                <div class="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div class="aspect-video rounded-3xl overflow-hidden bg-white/5 border border-white/10">
                        <img id="${id}-img-1" src="${ASSETS.telas}" class="w-full h-full object-cover opacity-80">
                    </div>
                    <div class="aspect-video rounded-3xl overflow-hidden bg-white/5 border border-white/10">
                        <img id="${id}-img-2" src="${ASSETS.manteleria}" class="w-full h-full object-cover opacity-80">
                    </div>
                </div>
                ${renderAdminBlockControls(id)}
            </section>
        `;
    } else if (type === 'text') {
        html = `
            <section id="${id}" class="py-20 px-6 lg:px-20 group relative text-center">
                <div class="max-w-3xl mx-auto space-y-6">
                    <h2 id="${id}-title" class="text-4xl font-light heading-luxury luxury-text-gradient">Título de la Sección</h2>
                    <p id="${id}-desc" class="text-slate-400 text-lg font-light italic leading-relaxed">Escribe aquí tu contenido personalizado de alta gama...</p>
                </div>
                ${renderAdminBlockControls(id)}
            </section>
        `;
    } else if (type === 'spacer') {
        html = `
            <div id="${id}" class="py-10 group relative">
                <div class="max-w-7xl mx-auto h-[1px] bg-gradient-to-r from-transparent via-primary/30 to-transparent"></div>
                ${renderAdminBlockControls(id)}
            </div>
        `;
    }

    container.insertAdjacentHTML('beforeend', html);
    await saveDynamicLayout();
    if (state.editMode) enableLiveEdit();
    showToast("Bloque añadido con éxito");
};

function renderAdminBlockControls(id) {
    return `
        <div class="admin-only absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
            <button onclick="removeDynamicBlock('${id}')" class="w-10 h-10 rounded-full bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white flex items-center justify-center transition-all">
                <span class="material-symbols-outlined text-lg">delete</span>
            </button>
        </div>
    `;
}

window.removeDynamicBlock = async (id) => {
    if (!confirm("¿Eliminar este bloque permanentemente?")) return;
    const el = document.getElementById(id);
    if (el) {
        el.remove();
        await saveDynamicLayout();
        showToast("Bloque eliminado");
    }
};

async function saveDynamicLayout() {
    const container = document.getElementById('dynamic-sections');
    if (!container) return;

    // Clonar para limpiar elementos temporales antes de guardar
    const clone = container.cloneNode(true);
    clone.querySelectorAll('.admin-only').forEach(el => el.remove());
    clone.querySelectorAll('.admin-editable').forEach(el => {
        el.classList.remove('admin-editable');
        el.contentEditable = 'false';
    });
    clone.querySelectorAll('.admin-editable-img').forEach(el => el.classList.remove('admin-editable-img'));

    const { error } = await state.supabase
        .from('site_content')
        .upsert({ id: 'dynamic-layout', content: clone.innerHTML, store_id: state.storeId });

    if (error) console.error("Error al guardar layout:", error);
}

/**
 * Detecta el contexto de la tienda basado en la URL (?s=nombre_tienda)
 */
async function detectStoreContext() {
    const params = new URLSearchParams(window.location.search);
    const storeSlug = params.get('s') || 'mr_confecciones';
    state.storeId = storeSlug;

    // Intentar cargar configuración de la tienda desde Supabase
    if (state.supabase) {
        const { data, error } = await state.supabase
            .from('stores')
            .select('*')
            .eq('slug', storeSlug)
            .maybeSingle();

        if (data) {
            state.storeConfig = data;
            console.info(`Contexto Cargado: ${data.name} (Modo: ${data.checkout_mode || 'WhatsApp'})`);
            applyStoreBranding(data);
        } else {
            console.warn(`Tienda "${storeSlug}" no encontrada. Usando modo de compatibilidad.`);
            // Mock default config for MR Confecciones
            state.storeConfig = {
                name: 'MR Confecciones',
                whatsapp: CONFIG.WHATSAPP,
                checkout_mode: 'mercadopago'
            };
        }
    }
}

function applyStoreBranding(config) {
    if (!config) return;
    // Actualizar títulos y elementos de marca si existen en el DOM
    if (config.name) {
        document.title = `${config.name} | Mall de Emprendimientos`;
        const logoText = document.querySelector('.luxury-text-gradient');
        if (logoText) logoText.textContent = config.name.toUpperCase();
    }
    
    // Inyectar CSS dinámico para colores si la tienda tiene marca propia
    if (config.primary_color) {
        document.documentElement.style.setProperty('--primary', config.primary_color);
    }
}

/**
 * Inicialización principal de la aplicación.
 */
async function init() {
    console.info("Multi-Tenant Engine: v1.0 initializing...");

    // Hacer globales para acceso desde controladores inline (HTML)
    window.UI_DATA = UI_DATA;
    window.state = state;

    cacheDOM();
    initClients();
    
    // Detectar tienda ANTES de cargar contenido
    await detectStoreContext();
    
    await initAuth();

    // Sincronización inicial
    await syncERPInventory();

    renderCarousel();
    renderCategories();
    updateCartUI();
    setupEventListeners();

    // Cargar contenido dinámico DESPUÉS de renderizar todo
    await loadDynamicContent();

    // Timers de fondo
    setInterval(syncERPInventory, 5 * 60 * 1000); // 5 min
    setInterval(nextSlide, 6000); // 6 sec
}

/**
 * Guarda referencias del DOM para evitar lookups repetidos.
 */
function cacheDOM() {
    state.dom = {
        productsGrid: document.getElementById('products-grid'),
        cartSidebar: document.getElementById('cart-sidebar'),
        cartOverlay: document.getElementById('cart-overlay'),
        cartItems: document.getElementById('cart-items'),
        cartCount: document.getElementById('cart-count'),
        cartTotal: document.getElementById('cart-total'),
        cartFooter: document.getElementById('cart-footer'),
        openCart: document.getElementById('open-cart'),
        closeCart: document.getElementById('close-cart'),
        toast: document.getElementById('toast'),
        toastMsg: document.getElementById('toast-msg'),
        contactForm: document.getElementById('contact-form'),
        slides: document.getElementById('carousel-slides'),
        dots: document.getElementById('carousel-dots'),
        categoryModal: document.getElementById('category-modal'),
        categoryOverlay: document.getElementById('category-overlay'),
        catModalTitle: document.getElementById('cat-modal-title'),
        catModalItems: document.getElementById('cat-modal-items'),
        closeCategory: document.getElementById('close-category'),
        mainHeader: document.getElementById('main-header'),
        checkoutBtn: document.getElementById('checkout-btn')
    };
}

/**
 * Inicializa clientes de servicios externos.
 */
function initClients() {
    if (window.supabase) {
        state.supabase = window.supabase.createClient(CONFIG.SUPABASE.URL, CONFIG.SUPABASE.ANON_KEY);
    }
    if (window.MercadoPago) {
        state.mp = new MercadoPago(CONFIG.MERCADOPAGO.PUBLIC_KEY, { locale: 'es-CL' });
    }
}

/**
 * Sincroniza el inventario desde el ERP vía Edge Function.
 */
async function syncERPInventory() {
    if (!state.supabase) return;
    try {
        console.info('Iniciando sincronización con ERP...');
        const { data, error } = await state.supabase.functions.invoke('get-erp-inventory');

        if (error) {
            console.error('Error invocando función Edge get-erp-inventory:', error);
            return;
        }

        if (!data) {
            console.warn('La función Edge no devolvió datos.');
            return;
        }

        if (data.error) {
            console.error('Error reportado por el ERP:', data.error);
            return;
        }

        if (!Array.isArray(data)) {
            console.error('Los datos del ERP no tienen el formato esperado (array):', data);
            return;
        }

        state.allErpProducts = data.map(p => ({
            id: p.code || 'S/C',
            name: p.name || 'Producto sin nombre',
            price: p.total || 0,
            stock: p.stock || 0,
            image: ASSETS.logo
        }));

        console.info(`Sincronización exitosa: ${state.allErpProducts.length} productos cargados.`);
        renderCategories();
        await loadDynamicContent();
    } catch (error) {
        console.error('Excepción crítica en syncERPInventory:', error);
    }
}

// --- RENDERING MODULES (SECURE) ---

function renderCarousel() {
    const { slides, dots } = state.dom;
    if (!slides) return;

    slides.innerHTML = UI_DATA.heroBanners.map((banner, i) => `
        <div class="min-w-full h-full relative flex items-center px-6 lg:px-20 py-20 overflow-hidden">
            <div class="absolute inset-0 z-0">
                <img id="banner-img-${i}" src="${banner.image}" class="w-full h-full object-cover opacity-60 scale-105" onerror="this.src='https://via.placeholder.com/1920x1080'">
                <div class="absolute inset-0 bg-background-dark/40"></div>
            </div>
            <div class="max-w-7xl mx-auto w-full relative z-20">
                <div class="flex flex-col gap-8 max-w-4xl text-left">
                    <div class="inline-flex items-center gap-2 bg-primary/20 px-5 py-2 rounded-full w-fit border border-primary/30">
                        <span id="banner-tag-${i}" class="text-xs font-bold uppercase tracking-[0.2em] text-primary">${escapeHTML(banner.tag)}</span>
                    </div>
                    <h1 id="banner-title-${i}" class="text-5xl lg:text-8xl font-light leading-tight tracking-tight text-white heading-luxury">
                        ${banner.title.split(' ').map((word, j) => j === 1 ? `<span class="luxury-text-gradient italic">${escapeHTML(word)}</span>` : escapeHTML(word)).join(' ')}
                    </h1>
                    <p id="banner-desc-${i}" class="text-lg lg:text-xl text-slate-400 max-w-lg font-light italic leading-relaxed">${escapeHTML(banner.subtitle)}</p>
                    <a id="banner-btn-${i}" href="#shop" class="btn-gradient w-fit text-white px-14 py-6 rounded-3xl font-black text-[10px] uppercase tracking-[0.4em] shadow-2xl mt-4">${escapeHTML(banner.btnText)}</a>
                </div>
            </div>
        </div>
    `).join('');

    if (dots) {
        dots.innerHTML = UI_DATA.heroBanners.map((_, i) => `
            <button data-index="${i}" class="carousel-dot w-3 h-3 rounded-full transition-all ${i === 0 ? 'bg-primary w-10' : 'bg-white/20'}"></button>
        `).join('');
    }
}

function renderCategories() {
    const { productsGrid } = state.dom;
    if (!productsGrid) return;

    productsGrid.innerHTML = UI_DATA.categories.map(cat => `
        <div data-cat="${cat.id}" class="category-card glass-card p-6 flex flex-col h-full hover:border-primary/50 transition-all duration-700 group cursor-pointer relative">
            <div class="absolute -top-10 -right-10 w-32 h-32 bg-primary/5 blur-[50px] rounded-full group-hover:bg-primary/10 transition-colors"></div>
            <div class="relative overflow-hidden rounded-[40px] mb-8 aspect-video image-soft-gradient flex items-center justify-center p-4">
                <img id="cat-img-${cat.id}" src="${cat.image}" alt="${cat.name}" class="w-full h-full object-cover opacity-90 transition-all duration-1000 group-hover:scale-105 group-hover:opacity-100" onerror="this.src='https://via.placeholder.com/600x400'">
                <div class="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
                <span id="cat-tag-${cat.id}" class="absolute top-6 left-6 bg-primary text-white text-[8px] font-black px-4 py-2 rounded-full uppercase tracking-[0.3em] shadow-2xl backdrop-blur-md">${escapeHTML(cat.tag)}</span>
            </div>
            <div class="flex flex-col flex-grow px-4">
                <span class="text-[9px] font-black text-primary uppercase tracking-[0.4em] mb-3 opacity-60">Colección</span>
                <h3 id="cat-title-${cat.id}" class="text-3xl font-light mb-4 heading-luxury luxury-text-gradient">${escapeHTML(cat.name)}</h3>
                <p id="cat-desc-${cat.id}" class="text-slate-500 text-xs font-light leading-relaxed mb-8 line-clamp-2 italic">${escapeHTML(cat.description)}</p>
                <div class="mt-auto flex items-center justify-between pt-8 border-t border-white/5">
                    <span class="text-[8px] font-black text-slate-600 uppercase tracking-[0.3em]">Explorar Variedad</span>
                    <div class="w-14 h-14 bg-white/[0.02] group-hover:bg-primary text-white rounded-full transition-all duration-700 flex items-center justify-center border border-white/5 group-hover:border-primary">
                        <span class="material-symbols-outlined text-2xl group-hover:rotate-45 transition-transform">arrow_outward</span>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

function openCategory(catId) {
    const cat = UI_DATA.categories.find(c => c.id === catId);
    if (!cat) return;

    state.dom.catModalTitle.textContent = cat.name;

    // Aplicar navegación por sub-menú (Portafolio vs Catálogo) a ambas categorías principales
    if (catId === 'manteleria' || catId === 'microfibra') {
        renderCategorySubmenu(cat);
    } else {
        renderProductList(cat);
    }

    state.dom.categoryOverlay.classList.remove('opacity-0', 'pointer-events-none');
    state.dom.categoryModal.classList.remove('opacity-0', 'pointer-events-none', 'translate-y-10');
}

// Hacer globales para acceso desde HTML (onclick)
window.renderCategorySubmenu = renderCategorySubmenu;
window.renderPortfolio = renderPortfolio;
window.renderProductList = renderProductList;
window.openCategory = openCategory; 
window.openErpLinker = openErpLinker;
window.addMatrixAttribute = addMatrixAttribute;
window.selectErpProduct = selectErpProduct;

function renderCategorySubmenu(cat) {
    state.dom.catModalItems.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-8 py-10">
            <button onclick="renderPortfolio('${cat.id}')" class="group relative aspect-video rounded-[2.5rem] overflow-hidden border border-white/10 hover:border-primary transition-all">
                <img src="${cat.image}" class="absolute inset-0 w-full h-full object-cover opacity-30 group-hover:opacity-50 transition-opacity">
                <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
                <div class="relative h-full flex flex-col items-center justify-center p-10 text-center">
                    <span class="material-symbols-outlined text-5xl text-primary mb-4">collections</span>
                    <h4 class="text-2xl font-bold uppercase tracking-widest text-white">Productos Realizados</h4>
                    <p class="text-[10px] text-slate-400 mt-2 uppercase tracking-widest">Galería de trabajos con ${escapeHTML(cat.name.split(' ')[0])}</p>
                </div>
            </button>
            <button onclick="renderProductList(UI_DATA.categories.find(c => c.id === '${cat.id}'))" class="group relative aspect-video rounded-[2.5rem] overflow-hidden border border-white/10 hover:border-primary transition-all">
                <img src="${cat.image}" class="absolute inset-0 w-full h-full object-cover opacity-20 group-hover:opacity-40 transition-opacity">
                <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
                <div class="relative h-full flex flex-col items-center justify-center p-10 text-center">
                    <span class="material-symbols-outlined text-5xl text-primary mb-4">inventory_2</span>
                    <h4 class="text-2xl font-bold uppercase tracking-widest text-white">Catálogo de Productos</h4>
                    <p class="text-[10px] text-slate-400 mt-2 uppercase tracking-widest">Stock disponible vía ERP</p>
                </div>
            </button>
        </div>
    `;
}

function renderPortfolio(catId) {
    state.dom.catModalItems.innerHTML = `
        <div class="flex flex-col gap-8">
            <button onclick="renderCategorySubmenu(UI_DATA.categories.find(c => c.id === '${catId}'))" class="flex items-center gap-2 text-primary font-bold uppercase tracking-widest text-[10px] hover:translate-x-[-10px] transition-transform">
                <span class="material-symbols-outlined">west</span> Volver al menú
            </button>
            <div id="portfolio-grid" class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="col-span-full text-center py-20 text-slate-500 italic">
                    <span class="material-symbols-outlined text-5xl mb-4">photo_library</span><br>
                    Cargando galería de trabajos...
                </div>
            </div>
        </div>
    `;
    loadPortfolioImages(catId);
}

async function loadPortfolioImages(catId = 'manteleria') {
    const grid = document.getElementById('portfolio-grid');
    if (!grid) return;

    try {
        // Buscamos en una subcarpeta según la categoría (portfolio/manteleria o portfolio/microfibra)
        const path = `portfolio/${catId}`;
        const { data, error } = await state.supabase.storage.from('site-assets').list(path, {
            limit: 20,
            sortBy: { column: 'created_at', order: 'desc' }
        });

        if (error || !data || data.length === 0) {
            grid.innerHTML = `
                <div class="col-span-full text-center py-20 px-10 rounded-[2rem] bg-white/[0.02] border border-white/5 space-y-4">
                    <span class="material-symbols-outlined text-4xl text-primary/40">photo_library</span>
                    <p class="text-xs text-slate-500 uppercase tracking-widest leading-relaxed">No hay fotos en el portafolio de ${escapeHTML(catId)}.<br>Sube fotos a la carpeta 'portfolio/${catId}' en Storage.</p>
                    ${state.isAdmin ? `<button onclick="window.openMediaManager()" class="btn-gradient text-[8px] font-black px-6 py-3 rounded-xl uppercase tracking-widest mt-4">Subir ahora</button>` : ''}
                </div>
            `;
            return;
        }

        grid.innerHTML = data.map(file => {
            const { data: { publicUrl } } = state.supabase.storage.from('site-assets').getPublicUrl(`${path}/${file.name}`);
            const descId = `port-desc-${catId}-${file.name.replace(/\.[^/.]+$/, "")}`;
            
            return `
                <div class="group relative flex flex-col gap-4">
                    <div class="aspect-video rounded-[2rem] overflow-hidden border border-white/5 bg-navy-blue shadow-2xl relative">
                        <img src="${publicUrl}" class="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110">
                    </div>
                    <div class="px-2">
                        <p id="${descId}" class="text-[10px] text-slate-400 font-light italic leading-relaxed admin-editable">Cargando descripción...</p>
                    </div>
                </div>
            `;
        }).join('');
        await loadDynamicContent();

    } catch (err) {
        console.error("Error cargando portafolio:", err);
        grid.innerHTML = `<p class="col-span-full text-center text-red-400 py-10">Error al conectar con la galería.</p>`;
    }
}

function renderProductList(cat) {
    if (!cat) return;
    
    // Mostramos un spinner inicial mientras cargamos definiciones si existen
    state.dom.catModalItems.innerHTML = `
        <div class="py-20 flex flex-col items-center justify-center space-y-4">
            <div class="animate-spin text-primary font-black italic">Sincronizando...</div>
            <p class="text-[9px] uppercase tracking-widest text-slate-500">Cargando definición de matriz...</p>
        </div>
    `;

    loadProductMatrixStep2(cat);
}

async function loadProductMatrixStep2(cat) {
    try {
        // Si por alguna razón no hay productos, intentar sincronizar de nuevo una vez
        if (state.allErpProducts.length === 0) {
            console.warn("Sin productos cargados, re-intentando sincronización...");
            await syncERPInventory();
        }

        const patternStr = cat.pattern || "";
        const patterns = patternStr.split(',').filter(p => p.trim() !== "");
        const erpVariants = state.allErpProducts.filter(p =>
            (patterns.length > 0 && patterns.some(pat => p.name.toLowerCase().includes(pat.toLowerCase()))) ||
            p.id.toLowerCase().startsWith(cat.id.substring(0, 2).toLowerCase())
        );

        const backButton = `
            <button onclick="renderCategorySubmenu(UI_DATA.categories.find(c => c.id === '${cat.id}'))" class="flex items-center gap-2 text-primary font-bold uppercase tracking-widest text-[10px] hover:translate-x-[-10px] transition-transform mb-8">
                <span class="material-symbols-outlined">west</span> Volver al menú
            </button>
        `;

        // Intentar cargar estructura manual de site_content (por categoría)
        let groups = {};
        const contentId = `matrix-def-${cat.id}`;
        
        try {
            const { data: matrixDef, error } = await state.supabase.from('site_content').select('content').eq('id', contentId).maybeSingle();
            
            if (!error && matrixDef && matrixDef.content) {
                const manual = (typeof matrixDef.content === 'string') ? JSON.parse(matrixDef.content) : matrixDef.content;
                groups = manual;

                // MODO HÍBRIDO: Si hay productos en el ERP que no están en la definición manual, los añadimos automáticamente
                erpVariants.forEach(p => {
                    const parts = p.name.split(' - ').map(s => s.trim());
                    const base = parts[0] || 'Producto';
                    
                    if (!groups[base]) {
                        if (!groups[base]) groups[base] = { rows: new Set(), cols: new Set(), mapping: {} };
                        const attr = parts[1] || 'Estándar';
                        const size = parts[2] || 'Única';
                        groups[base].rows.add(attr);
                        groups[base].cols.add(size);
                        groups[base].mapping[`${attr}-${size}`] = p.id;
                    }
                });

                // Limpieza de Sets a Arrays
                Object.values(groups).forEach(g => {
                    if (g.rows instanceof Set) g.rows = Array.from(g.rows).sort();
                    if (g.cols instanceof Set) g.cols = Array.from(g.cols).sort();
                    if (!g.rows) g.rows = [];
                    if (!g.cols) g.cols = [];
                    if (!g.mapping) g.mapping = {};
                });
            } else {
                throw new Error("No hay definición manual");
            }
        } catch (err) {
            console.warn("Falló la carga de definición manual, usando ERP Fallback:", err.message);
            groups = {};
            erpVariants.forEach(p => {
                const parts = p.name.split(' - ').map(s => s.trim());
                const base = parts[0] || 'Producto';
                const attr = parts[1] || 'Estándar';
                const size = parts[2] || 'Única';

                if (!groups[base]) groups[base] = { rows: new Set(), cols: new Set(), mapping: {} };
                groups[base].rows.add(attr);
                groups[base].cols.add(size);
                groups[base].mapping[`${attr}-${size}`] = p.id;
            });

            Object.keys(groups).forEach(k => {
                groups[k].rows = Array.from(groups[k].rows).sort();
                groups[k].cols = Array.from(groups[k].cols).sort();
            });

            // Mostrar aviso de fallback para modo Admin
            if (state.isAdmin) {
                const debugInfo = document.createElement('div');
                debugInfo.className = 'text-[7px] uppercase tracking-widest text-slate-700 mt-10 p-4 border border-white/5 rounded-xl';
                debugInfo.innerHTML = `MODO AUTOMÁTICO (ERP) <br> <span class="opacity-40">Motivo: ${err.message}</span>`;
                state.dom.catModalItems.appendChild(debugInfo);
            }
        }

        // SI NO HAY GRUPOS Y NO HAY PRODUCTOS, MOSTRAR ERROR
        if (Object.keys(groups).length === 0) {
            state.dom.catModalItems.innerHTML = `
                <div class="flex flex-col gap-8">
                    ${backButton}
                    <div class="py-20 text-center space-y-6">
                        <span class="material-symbols-outlined text-6xl text-slate-700">inventory_2</span>
                        <p class="text-slate-500 uppercase tracking-widest text-[10px]">No se encontraron productos disponibles en esta categoría.</p>
                        ${state.isAdmin ? `<p class="text-primary text-[9px] uppercase font-bold tracking-widest">Atención Admin: Verifica los patrones de búsqueda o vincula manualmente.</p>` : ''}
                    </div>
                </div>
            `;
            return;
        }

        state.dom.catModalItems.innerHTML = `
            <div class="flex flex-col gap-16">
                ${backButton}
            ${Object.entries(groups).map(([name, data]) => {
        return `
                <div class="space-y-8" id="product-group-${name.replace(/\s+/g, '-')}">
                    <div class="flex items-center justify-between border-l-2 border-primary pl-6">
                        <h3 class="text-2xl font-light heading-luxury text-white/90 uppercase tracking-widest">${escapeHTML(name)}</h3>
                        ${state.isAdmin ? `
                            <div class="flex items-center gap-3">
                                <button onclick="addMatrixAttribute('${cat.id}', '${name}', 'rows')" class="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-[8px] font-black uppercase tracking-widest border border-white/5 transition-all">+ Añadir Color</button>
                                <button onclick="addMatrixAttribute('${cat.id}', '${name}', 'cols')" class="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-[8px] font-black uppercase tracking-widest border border-white/5 transition-all">+ Añadir Talla</button>
                            </div>
                        ` : ''}
                    </div>
                    
                    <div class="overflow-x-auto rounded-3xl border border-white/10 bg-black/40 backdrop-blur-md shadow-2xl">
                        <table class="w-full text-left border-collapse min-w-[600px] matrix-table">
                            <thead>
                                <tr class="bg-primary/5 border-b border-white/10">
                                    <th rowspan="2" class="p-8 text-[11px] font-black uppercase tracking-[0.4em] text-primary border-r border-white/5">Atributo</th>
                                    <th colspan="${data.cols.length}" class="p-4 text-[10px] font-black uppercase tracking-[0.5em] text-center text-slate-400 border-b border-white/5 italic">Tamaño</th>
                                </tr>
                                <tr class="bg-white/[0.02]">
                                    ${data.cols.map(s => `
                                        <th class="p-4 py-6 border-r border-white/5 last:border-r-0">
                                            <div class="flex flex-col items-center gap-3">
                                                <span class="text-[10px] font-black uppercase tracking-[0.3em] text-center text-white/80">${escapeHTML(s)}</span>
                                                ${state.isAdmin ? `
                                                    <div class="flex gap-3">
                                                        <button onclick="editMatrixAttribute('${cat.id}', '${name}', 'cols', '${s.replace(/'/g, "\\'")}')" class="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center hover:bg-primary transition-all">
                                                            <span class="material-symbols-outlined text-[10px]">edit</span>
                                                        </button>
                                                        <button onclick="deleteMatrixAttribute('${cat.id}', '${name}', 'cols', '${s.replace(/'/g, "\\'")}')" class="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center hover:bg-red-500/20 hover:text-red-400 transition-all">
                                                            <span class="material-symbols-outlined text-[10px]">delete</span>
                                                        </button>
                                                    </div>
                                                ` : ''}
                                            </div>
                                        </th>
                                    `).join('')}
                                </tr>
                            </thead>
                            <tbody>
                                ${data.rows.map(c => `
                                    <tr class="hover:bg-primary/[0.03] transition-colors border-b border-white/5 last:border-b-0">
                                        <td class="p-8 bg-white/[0.01] border-r border-white/5">
                                            <div class="flex items-center justify-between gap-6">
                                                <span class="text-[11px] font-bold uppercase tracking-widest text-white/90">${escapeHTML(c)}</span>
                                                ${state.isAdmin ? `
                                                    <div class="flex gap-2">
                                                        <button onclick="editMatrixAttribute('${cat.id}', '${name}', 'rows', '${c.replace(/'/g, "\\'")}')" class="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center hover:bg-primary transition-all">
                                                            <span class="material-symbols-outlined text-[12px]">edit</span>
                                                        </button>
                                                        <button onclick="deleteMatrixAttribute('${cat.id}', '${name}', 'rows', '${c.replace(/'/g, "\\'")}')" class="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center hover:bg-red-500/20 hover:text-red-400 transition-all">
                                                            <span class="material-symbols-outlined text-[12px]">delete</span>
                                                        </button>
                                                    </div>
                                                ` : ''}
                                            </div>
                                        </td>
                                        ${data.cols.map(s => {
            const linkedId = data.mapping[`${c}-${s}`];
            const item = linkedId ? state.allErpProducts.find(x => x.id === linkedId) : null;
            
            if (!item) {
                return `
                    <td class="p-4 border-r border-white/5 last:border-r-0">
                        <div class="flex flex-col items-center justify-center opacity-40 hover:opacity-100 transition-opacity">
                            <p class="text-[8px] uppercase tracking-widest mb-2">Sin Vincular</p>
                            ${state.isAdmin ? `
                                <button onclick="openErpLinker('${cat.id}', '${name}', '${c}', '${s}')" class="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-primary transition-all">
                                    <span class="material-symbols-outlined text-sm">link</span>
                                </button>
                            ` : '—'}
                        </div>
                    </td>`;
            }

            const outOfStock = item.stock <= 0;

            return `
                <td class="p-4 border-r border-white/5 last:border-r-0 relative">
                    <div class="flex flex-col items-center gap-3">
                        <span class="text-[11px] font-black text-primary">${formatCLP(item.price)}</span>
                        <button data-add="${item.id}" 
                            ${outOfStock ? 'disabled' : ''}
                            class="group/btn relative w-full h-12 flex flex-col items-center justify-center rounded-xl transition-all ${outOfStock ? 'bg-red-500/5 opacity-40 border-red-500/10' : 'bg-white/5 hover:bg-primary active:scale-95 border border-white/10 hover:border-primary'}">
                            <div class="flex items-center gap-2">
                                <span class="material-symbols-outlined text-sm">${outOfStock ? 'close' : 'add_shopping_cart'}</span>
                                <span class="text-[8px] font-black uppercase tracking-widest">${outOfStock ? 'Agotado' : `${item.stock} UN`}</span>
                            </div>
                        </button>
                    </div>
                    ${state.isAdmin ? `
                        <button onclick="openErpLinker('${cat.id}', '${name}', '${c}', '${s}')" class="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/40 text-[9px] flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                            <span class="material-symbols-outlined text-xs">edit</span>
                        </button>
                    ` : ''}
                </td>`;
        }).join('')}
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
    }).join('')}
        </div>
    `;
    } catch (err) {
        console.error("Error crítico cargando matriz:", err);
        state.dom.catModalItems.innerHTML = `
            <div class="py-20 text-center text-red-500/80 bg-red-500/5 rounded-3xl border border-red-500/10 p-10">
                <span class="material-symbols-outlined text-4xl mb-4">error</span>
                <p class="text-sm font-bold uppercase tracking-widest mb-2">Error al cargar el catálogo</p>
                <p class="text-[10px] opacity-60 uppercase tracking-widest">${err.message}</p>
                <button onclick="location.reload()" class="mt-8 px-6 py-3 bg-red-500/20 rounded-xl text-[8px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all">Reiniciar Aplicación</button>
            </div>
        `;
    }
}

// --- MATRIX MANAGEMENT FUNCTIONS ---

async function addMatrixAttribute(catId, baseName, type) {
    const val = prompt(`Introduce el nuevo ${type === 'rows' ? 'Color' : 'Tamaño'}:`);
    if (!val) return;

    const contentId = `matrix-def-${catId}`;
    const { data: existing } = await state.supabase.from('site_content').select('content').eq('id', contentId).maybeSingle();
    let def = {};
    if (existing && existing.content) {
        def = (typeof existing.content === 'string') ? JSON.parse(existing.content) : existing.content;
    }

    if (!def[baseName]) {
        // PRE-POBLAR: Si es la primera vez, rescatamos lo que ya hay en el ERP para este producto
        const cat = UI_DATA.categories.find(c => c.id === catId);
        const patternStr = cat.pattern || "";
        const patterns = patternStr.split(',').filter(p => p.trim() !== "");
        const erpVariants = state.allErpProducts.filter(p =>
            (patterns.length > 0 && patterns.some(pat => p.name.toLowerCase().includes(pat.toLowerCase()))) ||
            p.id.toLowerCase().startsWith(cat.id.substring(0, 2).toLowerCase())
        );

        const currentItems = erpVariants.filter(p => p.name.startsWith(baseName));
        const rows = new Set(currentItems.map(p => p.name.split(' - ')[1] || 'Estándar'));
        const cols = new Set(currentItems.map(p => p.name.split(' - ')[2] || 'Única'));
        const mapping = {};
        currentItems.forEach(p => {
            const r = p.name.split(' - ')[1] || 'Estándar';
            const c = p.name.split(' - ')[2] || 'Única';
            mapping[`${r}-${c}`] = p.id;
        });

        def[baseName] = { 
            rows: Array.from(rows).sort(), 
            cols: Array.from(cols).sort(), 
            mapping 
        };
    }

    if (!def[baseName][type].includes(val)) {
        def[baseName][type].push(val);
        def[baseName][type].sort();
        
        const { error } = await state.supabase.from('site_content').upsert({ id: contentId, content: def });
        
        if (error) {
            alert(`Error de base de datos: ${error.message}`);
            return;
        }

        showToast("¡Matriz guardada! Sincronizando...");
        setTimeout(() => {
            loadProductMatrixStep2(UI_DATA.categories.find(c => c.id === catId));
        }, 500);
    }
}

window.addMatrixAttribute = addMatrixAttribute;
window.editMatrixAttribute = editMatrixAttribute;
window.deleteMatrixAttribute = deleteMatrixAttribute;
window.selectErpProduct = selectErpProduct;

async function editMatrixAttribute(catId, baseName, type, oldVal) {
    const newVal = prompt(`Editar ${type === 'rows' ? 'Color' : 'Tamaño'}:`, oldVal);
    if (!newVal || newVal === oldVal) return;

    const contentId = `matrix-def-${catId}`;
    const { data: existing } = await state.supabase.from('site_content').select('content').eq('id', contentId).maybeSingle();
    let def = {};
    if (existing && existing.content) {
        def = (typeof existing.content === 'string') ? JSON.parse(existing.content) : existing.content;
    }

    if (def[baseName] && def[baseName][type].includes(oldVal)) {
        // 1. Reemplazar en la lista (rows o cols)
        const idx = def[baseName][type].indexOf(oldVal);
        def[baseName][type][idx] = newVal;
        def[baseName][type].sort();

        // 2. Actualizar las claves del mapping
        const newMapping = {};
        Object.entries(def[baseName].mapping).forEach(([key, val]) => {
            const [r, s] = key.split('-');
            const newKey = (type === 'rows' && r === oldVal) ? `${newVal}-${s}` : 
                          (type === 'cols' && s === oldVal) ? `${r}-${newVal}` : key;
            newMapping[newKey] = val;
        });
        def[baseName].mapping = newMapping;

        await state.supabase.from('site_content').upsert({ id: contentId, content: def });
        showToast("¡Actualizado correctamente!");
        loadProductMatrixStep2(UI_DATA.categories.find(c => c.id === catId));
    }
}

async function deleteMatrixAttribute(catId, baseName, type, val) {
    if (!confirm(`¿Estás seguro de eliminar "${val}"? Se perderán las vinculaciones asociadas.`)) return;

    const contentId = `matrix-def-${catId}`;
    const { data: existing } = await state.supabase.from('site_content').select('content').eq('id', contentId).maybeSingle();
    let def = {};
    if (existing && existing.content) {
        def = (typeof existing.content === 'string') ? JSON.parse(existing.content) : existing.content;
    }

    if (def[baseName] && def[baseName][type].includes(val)) {
        // 1. Quitar de la lista
        def[baseName][type] = def[baseName][type].filter(x => x !== val);

        // 2. Limpiar mappings afectados
        const newMapping = {};
        Object.entries(def[baseName].mapping).forEach(([key, pId]) => {
            const [r, s] = key.split('-');
            if ((type === 'rows' && r === val) || (type === 'cols' && s === val)) {
                // Se descarta
            } else {
                newMapping[key] = pId;
            }
        });
        def[baseName].mapping = newMapping;

        await state.supabase.from('site_content').upsert({ id: contentId, content: def });
        showToast("Eliminado correctamente.");
        loadProductMatrixStep2(UI_DATA.categories.find(c => c.id === catId));
    }
}

let activeLinking = null;

function openErpLinker(catId, baseName, row, col) {
    activeLinking = { catId, baseName, row, col };
    
    // Crear el modal del linker si no existe
    let modal = document.getElementById('erp-linker-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'erp-linker-modal';
        modal.className = 'fixed inset-0 z-[120] flex items-center justify-center bg-black/90 backdrop-blur-xl p-4 lg:p-20 overflow-hidden';
        document.body.appendChild(modal);
    }
    
    modal.style.display = 'flex';
    modal.innerHTML = `
        <div class="glass-card w-full h-full max-w-4xl flex flex-col">
            <div class="p-8 border-b border-white/5 flex items-center justify-between">
                <div>
                    <h3 class="text-xl font-light heading-luxury luxury-text-gradient">Vinculador ERP</h3>
                    <p class="text-[9px] uppercase font-black tracking-widest text-slate-500 mt-2">Buscando producto para: ${baseName} (${row} / ${col})</p>
                </div>
                <button onclick="document.getElementById('erp-linker-modal').style.display='none'" class="w-10 h-10 rounded-full hover:bg-white/5 flex items-center justify-center">
                    <span class="material-symbols-outlined">close</span>
                </button>
            </div>
            <div class="p-6 border-b border-white/5">
                <input type="text" id="erp-search-matrix" placeholder="Buscar por nombre o código en el ERP..." onkeyup="filterErpMatrixList(this.value)"
                    class="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white focus:border-primary/50 outline-none transition-all">
            </div>
            <div id="erp-matrix-list" class="flex-grow overflow-y-auto p-8 grid grid-cols-1 gap-4">
                ${state.allErpProducts.map(p => `
                    <button onclick="selectErpProduct('${p.id}')" class="flex items-center justify-between p-6 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-primary/40 text-left transition-all group">
                        <div class="flex flex-col gap-1">
                            <span class="text-[10px] font-black tracking-widest text-primary italic">${p.id}</span>
                            <span class="text-sm font-light text-white/80 group-hover:text-white">${escapeHTML(p.name)}</span>
                        </div>
                        <div class="text-right">
                             <span class="text-[9px] font-bold text-slate-500 uppercase">${p.stock} UN DISP.</span>
                        </div>
                    </button>
                `).join('')}
            </div>
        </div>
    `;
}

window.filterErpMatrixList = (val) => {
    const term = val.toLowerCase();
    const btns = document.querySelectorAll('#erp-matrix-list button');
    btns.forEach(b => {
        const text = b.innerText.toLowerCase();
        b.style.display = text.includes(term) ? 'flex' : 'none';
    });
};

async function selectErpProduct(pId) {
    if (!activeLinking) return;
    const { catId, baseName, row, col } = activeLinking;

    const contentId = `matrix-def-${catId}`;
    const { data: existing } = await state.supabase.from('site_content').select('content').eq('id', contentId).maybeSingle();
    let def = {};
    if (existing && existing.content) {
        def = (typeof existing.content === 'string') ? JSON.parse(existing.content) : existing.content;
    }
    
    if (!def[baseName]) def[baseName] = { rows: [], cols: [], mapping: {} };
    
    // Si la estructura no tenía esta fila/columna por manual, los añadimos
    if (!def[baseName].rows.includes(row)) def[baseName].rows.push(row);
    if (!def[baseName].cols.includes(col)) def[baseName].cols.push(col);
    
    // Guardamos el mapeo
    def[baseName].mapping[`${row}-${col}`] = pId;

    await state.supabase.from('site_content').upsert({ id: contentId, content: def });
    
    document.getElementById('erp-linker-modal').style.display = 'none';
    showToast(`Celda vinculada exitosamente al código ${pId}`);
    loadProductMatrixStep2(UI_DATA.categories.find(c => c.id === catId));
}

window.linkToErp = (id) => {
    const code = prompt("Introduce el código del producto en el ERP para vincular:", id);
    if (code) showToast(`Producto ${id} vinculado correctamente al código ${code} del ERP.`);
};

// --- CART LOGIC ---

function addToCart(id) {
    const p = state.allErpProducts.find(x => x.id === id);
    if (!p) return;

    if (p.stock <= 0) {
        showToast("Lo sentimos, este producto está agotado.");
        return;
    }

    const item = state.cart.find(x => x.id === id);
    if (item) {
        if (item.quantity >= p.stock) {
            showToast(`Solo quedan ${p.stock} unidades de ${p.name}.`);
            return;
        }
        item.quantity++;
    } else {
        state.cart.push({ ...p, quantity: 1 });
    }
    saveCart();
    updateCartUI();
    showToast(`${p.name} añadido`);
}

function updateCartUI() {
    const { cartCount, cartItems, cartTotal, cartFooter } = state.dom;
    if (!cartCount) return;

    cartCount.textContent = state.cart.reduce((s, i) => s + i.quantity, 0);

    if (state.cart.length === 0) {
        cartItems.innerHTML = `
            <div class="h-full flex flex-col items-center justify-center text-center space-y-6 opacity-30 py-32">
                <span class="material-symbols-outlined text-7xl font-light">shopping_basket</span>
                <div class="space-y-2">
                    <p class="text-[11px] font-black uppercase tracking-[0.5em]">Su carrito está vacío</p>
                    <p class="text-[9px] font-medium uppercase tracking-[0.2em] text-slate-500">Explore nuestra colección de alta gama</p>
                </div>
            </div>`;
        cartFooter.style.display = 'none';
    } else {
        cartItems.innerHTML = state.cart.map(i => `
            <div class="group relative flex items-center gap-6 p-4 rounded-3xl bg-white/[0.02] border border-white/5 hover:border-primary/30 transition-all duration-500">
                <div class="w-20 h-20 rounded-2xl overflow-hidden bg-navy-blue flex-shrink-0">
                    <img src="${i.image}" loading="lazy" class="w-full h-full object-cover opacity-80 group-hover:scale-110 transition-transform duration-700">
                </div>
                <div class="flex-1 space-y-1">
                    <h4 class="text-[10px] font-black uppercase tracking-[0.2em] text-white/90 truncate">${escapeHTML(i.name)}</h4>
                    <p class="text-primary font-black tracking-tight italic">${formatCLP(i.price * i.quantity)}</p>
                    <div class="flex items-center gap-3 pt-2">
                        <button data-qty-id="${i.id}" data-delta="-1" class="qty-btn w-6 h-6 flex items-center justify-center bg-white/5 hover:bg-primary rounded-md transition-all text-xs">-</button>
                        <span class="text-[10px] font-black w-4 text-center">${i.quantity}</span>
                        <button data-qty-id="${i.id}" data-delta="1" class="qty-btn w-6 h-6 flex items-center justify-center bg-white/5 hover:bg-primary rounded-md transition-all text-xs">+</button>
                    </div>
                </div>
            </div>
        `).join('');
        cartTotal.textContent = formatCLP(state.cart.reduce((s, i) => s + (i.price * i.quantity), 0));
        cartFooter.style.display = 'block';
    }
}

function saveCart() { localStorage.setItem('mr_confecciones_cart_real', JSON.stringify(state.cart)); }

// -- HELPERS ---

function showToast(msg) {
    const { toast, toastMsg } = state.dom;
    if (!toast || !toastMsg) return;
    toastMsg.textContent = msg;
    toast.className = "fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] transition-all duration-500 opacity-100 translate-y-0";
    setTimeout(() => {
        toast.className = "fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] transition-all duration-500 opacity-0 translate-y-20";
    }, 4000);
}

function nextSlide() {
    state.currentSlide = (state.currentSlide + 1) % UI_DATA.heroBanners.length;
    updateCarousel();
}

function updateCarousel() {
    const { slides, dots } = state.dom;
    if (!slides) return;
    slides.style.transform = `translateX(-${state.currentSlide * 100}%)`;
    if (dots) {
        dots.querySelectorAll('button').forEach((dot, i) => {
            dot.className = `w-3 h-3 rounded-full transition-all ${i === state.currentSlide ? 'bg-primary w-10' : 'bg-white/20'}`;
        });
    }
}

// --- EVENTS ---

function setupEventListeners() {
    const { dom } = state;

    // Delegación de eventos para botones dinámicos
    document.addEventListener('click', e => {
        // Bloquear acciones de navegación en modo edición
        if (state.editMode) {
            const isAdminUI = e.target.closest('#admin-sidebar') || e.target.closest('#admin-login-modal') || e.target.closest('#admin-sidebar-trigger');
            if (!isAdminUI) return;
        }

        const target = e.target.closest('[data-add]');
        if (target) addToCart(target.dataset.add);

        const qtyBtn = e.target.closest('[data-qty-id]');
        if (qtyBtn) {
            const id = qtyBtn.dataset.qtyId;
            const delta = parseInt(qtyBtn.dataset.delta);
            const item = state.cart.find(x => x.id === id);
            if (item) {
                item.quantity += delta;
                if (item.quantity <= 0) state.cart = state.cart.filter(x => x.id !== id);
                saveCart(); updateCartUI();
            }
        }

        const catCard = e.target.closest('[data-cat]');
        if (catCard && !e.target.closest('button')) openCategory(catCard.dataset.cat);

        const dot = e.target.closest('.carousel-dot');
        if (dot) {
            state.currentSlide = parseInt(dot.dataset.index);
            updateCarousel();
        }
    });

    if (dom.openCart) dom.openCart.onclick = () => { dom.cartSidebar.classList.add('open'); dom.cartOverlay.classList.add('open'); };
    if (dom.closeCart) dom.closeCart.onclick = () => { dom.cartSidebar.classList.remove('open'); dom.cartOverlay.classList.remove('open'); };
    if (dom.cartOverlay) dom.cartOverlay.onclick = () => { dom.cartSidebar.classList.remove('open'); dom.cartOverlay.classList.remove('open'); };
    if (dom.closeCategory) dom.closeCategory.onclick = () => {
        dom.categoryOverlay.classList.add('opacity-0', 'pointer-events-none');
        dom.categoryModal.classList.add('opacity-0', 'pointer-events-none', 'translate-y-10');
    };

    // Formulario de Contacto
    if (dom.contactForm) {
        dom.contactForm.onsubmit = async (e) => {
            e.preventDefault();
            const btn = dom.contactForm.querySelector('button');
            const formData = new FormData(dom.contactForm);
            const payload = {
                name: formData.get('name'),
                email: formData.get('email'),
                message: dom.contactForm.querySelector('textarea').value
            };

            btn.disabled = true;
            btn.textContent = "ENVIANDO...";

            try {
                if (state.supabase) {
                    await state.supabase.from('contact_messages').insert([{
                        name: payload.name, 
                        email: payload.email, 
                        requirement: payload.message, 
                        store_id: state.storeId,
                        created_at: new Date().toISOString()
                    }]);
                }
                if (window.emailjs) {
                    await emailjs.send(CONFIG.EMAILJS.SERVICE_ID, CONFIG.EMAILJS.TEMPLATE_ID, {
                        from_name: payload.name, from_email: payload.email, message: payload.message
                    }, CONFIG.EMAILJS.PUBLIC_KEY);
                }
                showToast("¡Mensaje enviado con éxito!");
                dom.contactForm.reset();
            } catch (err) {
                console.error("Error envío:", err);
                showToast("Error al enviar. Intenta vía WhatsApp.");
            } finally {
                btn.disabled = false; btn.textContent = "ENVIAR MENSAJE";
            }
        };
    }

    // Checkout Flow
    if (dom.checkoutBtn) {
        dom.checkoutBtn.onclick = async () => {
            if (state.cart.length === 0) return showToast("El carrito está vacío.");

            dom.checkoutBtn.disabled = true;
            dom.checkoutBtn.textContent = "PROCESANDO...";

            const total = state.cart.reduce((s, i) => s + (i.price * i.quantity), 0);

            try {
                let orderId = `REQ-${Date.now()}`;
                
                // Registro de la cotización en Supabase
                if (state.supabase) {
                    const { data } = await state.supabase.from('quotations').insert([{
                        items: state.cart, 
                        total, 
                        status: 'pending', 
                        store_id: state.storeId,
                        created_at: new Date().toISOString()
                    }]).select();
                    if (data) orderId = data[0].id;
                }

                // Lógica de Checkout por Fases
                const mode = state.storeConfig.checkout_mode || 'whatsapp';

                if (mode === 'mercadopago') {
                    // MODO FASE 2: Checkout Centralizado
                    let preferenceUrl = null;
                    if (state.supabase) {
                        const { data } = await state.supabase.functions.invoke('create-preference', {
                            body: { items: state.cart, orderId }
                        });
                        if (data?.init_point) preferenceUrl = data.init_point;
                    }

                    if (preferenceUrl) {
                        showToast("Redirigiendo a Mercado Pago...");
                        setTimeout(() => window.location.href = preferenceUrl, 1000);
                        return;
                    }
                }

                // MODO FASE 1: Redirección a WhatsApp (Default o Fallback)
                showToast("Generando pedido para WhatsApp...");
                const targetPhone = state.storeConfig.whatsapp || CONFIG.WHATSAPP;
                const storeName = state.storeConfig.name || "la tienda";
                
                const itemsList = state.cart.map(i => `*${i.quantity}x* ${i.name} (${formatCLP(i.price)})`).join('\n');
                const msg = `Hola! Vengo desde el Mall de Emprendedoras.\n\nQuiero realizar un pedido a *${storeName}* (ID: ${orderId}):\n\n${itemsList}\n\n*Total Estimado: ${formatCLP(total)}*\n\n¿Me podrían confirmar disponibilidad y envío?`;
                
                setTimeout(() => {
                    const waUrl = `https://wa.me/${targetPhone}?text=${encodeURIComponent(msg)}`;
                    window.location.href = waUrl;
                }, 1200);

            } catch (err) {
                console.error("Checkout Error:", err);
                showToast("Error al procesar orden.");
                dom.checkoutBtn.disabled = false;
                dom.checkoutBtn.textContent = "PROCEDER AL PAGO";
            }
        };
    }

    // Header scroll effects
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            dom.mainHeader.classList.add('nav-scrolled', 'py-4');
        } else {
            dom.mainHeader.classList.remove('nav-scrolled', 'py-4');
        }
    });

    // Reveal Animations Observer
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) entry.target.classList.add('active');
        });
    }, { threshold: 0.1 });

    document.querySelectorAll('section').forEach(s => {
        s.classList.add('section-reveal');
        observer.observe(s);
    });

    // Evento de Login Admin
    document.getElementById('login-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('admin-email').value;
        const password = document.getElementById('admin-password').value;
        const btn = e.target.querySelector('button[type="submit"]');

        btn.textContent = 'Verificando...';
        btn.disabled = true;

        const { error } = await state.supabase.auth.signInWithPassword({ email, password });

        if (error) {
            alert("Error de acceso: " + error.message);
            btn.textContent = 'Iniciar Sesión';
            btn.disabled = false;
        } else {
            closeAdminLogin();
            toggleAdminSidebar();
        }
    });

    // Botón secreto en el footer (Logo pequeño)
    const footerLogo = document.querySelector('footer img');
    if (footerLogo) {
        footerLogo.style.cursor = 'help';
        footerLogo.addEventListener('click', (e) => {
            if (e.detail === 3) { // Triple clic para abrir login
                openAdminLogin();
            }
        });
    }
}

// Boot up
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

