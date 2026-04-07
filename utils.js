/**
 * Utilerías de Seguridad y Ayuda para MR Confecciones
 */

/**
 * Escapa caracteres especiales de HTML para prevenir XSS.
 * @param {string} str 
 * @returns {string}
 */
export function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, function (m) {
        return {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[m];
    });
}

/**
 * Formatea moneda CLP.
 * @param {number} num 
 * @returns {string}
 */
export function formatCLP(num) {
    return new Intl.NumberFormat('es-CL', {
        style: 'currency',
        currency: 'CLP',
    }).format(num);
}
