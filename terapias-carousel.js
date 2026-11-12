// Carrusel automático de las tarjetas de terapias de index.Html.
const carruselTerapias = document.querySelector('.tarjetas-terapia-scroll');

if (carruselTerapias) {
    const tarjetasTerapias = Array.from(carruselTerapias.querySelectorAll('.tarjeta-terapia'));
    const reducirMovimientoTerapias = window.matchMedia('(prefers-reduced-motion: reduce)');
    let indiceTerapia = 0;
    let temporizadorTerapias = null;
    let reanudarTerapias = null;

    // Calcula el ancho de una tarjeta más el espacio que la separa de la siguiente.
    function pasoTerapia() {
        if (!tarjetasTerapias.length) return 0;
        const estilo = window.getComputedStyle(carruselTerapias);
        const espacio = parseFloat(estilo.columnGap || estilo.gap) || 0;
        return tarjetasTerapias[0].getBoundingClientRect().width + espacio;
    }

    // Desplaza el carrusel una tarjeta cada vez y vuelve al inicio al llegar al final.
    function avanzarTerapia() {
        if (tarjetasTerapias.length < 2) return;
        indiceTerapia += 1;

        const finalAlcanzable = carruselTerapias.scrollWidth - carruselTerapias.clientWidth;
        if (indiceTerapia * pasoTerapia() > finalAlcanzable + 2) {
            indiceTerapia = 0;
        }

        carruselTerapias.scrollTo({
            left: indiceTerapia * pasoTerapia(),
            behavior: reducirMovimientoTerapias.matches ? 'auto' : 'smooth'
        });
    }

    // Pausa mientras el usuario observa o manipula las tarjetas.
    function pausarTerapias() {
        window.clearInterval(temporizadorTerapias);
        temporizadorTerapias = null;
        window.clearTimeout(reanudarTerapias);
        reanudarTerapias = null;
    }

    // Reinicia el avance cada 1,5 segundos si la pestaña está visible y se permite movimiento.
    function iniciarTerapias() {
        pausarTerapias();
        if (document.hidden || reducirMovimientoTerapias.matches || tarjetasTerapias.length < 2) return;
        temporizadorTerapias = window.setInterval(avanzarTerapia, 1500);
    }

    // Si el usuario desplaza a mano, sincroniza el índice con la tarjeta más cercana.
    carruselTerapias.addEventListener('scroll', () => {
        const paso = pasoTerapia();
        if (paso > 0) indiceTerapia = Math.round(carruselTerapias.scrollLeft / paso);
    }, { passive: true });

    carruselTerapias.addEventListener('mouseenter', pausarTerapias);
    carruselTerapias.addEventListener('mouseleave', iniciarTerapias);
    carruselTerapias.addEventListener('focusin', pausarTerapias);
    carruselTerapias.addEventListener('focusout', iniciarTerapias);

    // En pantallas táctiles, da unos segundos para deslizar antes de reanudar el carrusel.
    carruselTerapias.addEventListener('touchstart', () => {
        pausarTerapias();
        reanudarTerapias = window.setTimeout(iniciarTerapias, 7000);
    }, { passive: true });

    document.addEventListener('visibilitychange', iniciarTerapias);
    reducirMovimientoTerapias.addEventListener?.('change', iniciarTerapias);
    iniciarTerapias();
}