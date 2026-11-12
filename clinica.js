// Carrusel para las tarjetas de tratamientos de Clinica.html.
const carruselClinica = document.querySelector('.consultas-clinica');

if (carruselClinica) {
    const tarjetas = Array.from(carruselClinica.querySelectorAll('.tarjeta-consulta'));
    const reducirMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)');
    let indiceActual = 0;
    let temporizador = null;
    let reanudarTemporizador = null;

    // Calcula el espacio entre tarjetas para desplazar una tarjeta completa.
    function obtenerPaso() {
        const estilos = window.getComputedStyle(carruselClinica);
        const espacio = parseFloat(estilos.columnGap || estilos.gap) || 0;
        return tarjetas[0].getBoundingClientRect().width + espacio;
    }

    // Avanza una tarjeta; al llegar al final, vuelve al inicio del carrusel.
    function avanzarTarjeta() {
        if (tarjetas.length < 2) return;

        indiceActual += 1;
        if (indiceActual >= tarjetas.length) indiceActual = 0;

        carruselClinica.scrollTo({
            left: indiceActual * obtenerPaso(),
            behavior: reducirMovimiento.matches ? 'auto' : 'smooth'
        });
    }

    // Detiene el avance automático durante interacción o cuando la pestaña está oculta.
    function pausar() {
        window.clearInterval(temporizador);
        temporizador = null;
        window.clearTimeout(reanudarTemporizador);
        reanudarTemporizador = null;
    }

    // Inicia un intervalo único, salvo que haya una preferencia de movimiento reducido.
    function iniciar() {
        pausar();
        if (reducirMovimiento.matches || document.hidden || tarjetas.length < 2) return;
        temporizador = window.setInterval(avanzarTarjeta, 3000);
    }

    // Al deslizar manualmente, ajusta el índice para continuar desde la tarjeta visible.
    carruselClinica.addEventListener('scroll', () => {
        const paso = obtenerPaso();
        if (paso > 0) indiceActual = Math.round(carruselClinica.scrollLeft / paso);
    }, { passive: true });

    carruselClinica.addEventListener('mouseenter', pausar);
    carruselClinica.addEventListener('mouseleave', iniciar);
    carruselClinica.addEventListener('focusin', pausar);
    carruselClinica.addEventListener('focusout', iniciar);

    // En móviles, pausa tras el toque para que el usuario pueda deslizar sin interferencias.
    carruselClinica.addEventListener('touchstart', () => {
        pausar();
        reanudarTemporizador = window.setTimeout(iniciar, 7000);
    }, { passive: true });

    document.addEventListener('visibilitychange', iniciar);
    reducirMovimiento.addEventListener?.('change', iniciar);
    iniciar();
}