// Funciones comunes para normalizar, validar y presentar RUT chilenos.
window.QuinesiomedRut = Object.freeze({
    normalizar(valor) { return String(valor || '').replace(/[.\-\s]/g, '').toUpperCase(); },
    verificadorEsperado(valor) {
        const rut = this.normalizar(valor);
        const cuerpo = rut.slice(0, -1);
        if (!/^\d{7,8}$/.test(cuerpo)) return '';
        let suma = 0, factor = 2;
        for (let i = cuerpo.length - 1; i >= 0; i--) {
            suma += Number(cuerpo[i]) * factor;
            factor = factor === 7 ? 2 : factor + 1;
        }
        const resto = 11 - (suma % 11);
        return resto === 11 ? '0' : resto === 10 ? 'K' : String(resto);
    },
    valido(valor) {
        const rut = this.normalizar(valor);
        const esperado = this.verificadorEsperado(rut);
        return Boolean(esperado) && rut.endsWith(esperado);
    },
    formatear(valor) {
        const rut = this.normalizar(valor);
        if (rut.length < 2) return rut;
        return `${rut.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}-${rut.slice(-1)}`;
    }
});