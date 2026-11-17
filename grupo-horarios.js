// Gestión de bloques de clases grupales. Los datos viven solo en el navegador actual.
(() => {
    const CLAVE = 'quinesiomed-bloques-grupales-v1';
    const CLAVE_RESERVAS = 'quinesiomed-reservas-v1';
    const leer = clave => {
        try { const valor = JSON.parse(localStorage.getItem(clave) || '[]'); return Array.isArray(valor) ? valor : []; }
        catch { return []; }
    };
    const guardar = datos => localStorage.setItem(CLAVE, JSON.stringify(datos));
    const hoyISO = () => { const hoy = new Date(); return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`; };
    const horaAMinutos = hora => { const [h, m] = hora.split(':').map(Number); return h * 60 + m; };
    const minutosAHora = minutos => `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`;
    const bloques = () => leer(CLAVE);
    const reservas = () => leer(CLAVE_RESERVAS);

    function slotsDe(bloque) {
        const slots = [];
        const inicio = horaAMinutos(bloque.desde);
        const termino = horaAMinutos(bloque.hasta);
        const duracion = Number(bloque.duracion);
        if (!duracion || termino <= inicio) return slots;
        for (let minuto = inicio; minuto + duracion <= termino; minuto += duracion) slots.push(minutosAHora(minuto));
        return slots;
    }

    function ocupados(bloqueId, fecha, hora) {
        const idSlot = `${bloqueId}|${fecha}|${hora}`;
        return reservas().filter(reserva => reserva.tipoSesion === 'grupal' && reserva.grupoSlotId === idSlot).length;
    }

    function formatoFecha(fecha) {
        return new Date(`${fecha}T12:00:00`).toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });
    }

    // Inyecta en la agenda el selector de plan grupal y sus cupos disponibles.
    const formularioReserva = document.querySelector('#formulario-reserva');
    if (formularioReserva && !formularioReserva.querySelector('#modo-reserva-grupal')) {
        const camposHorario = formularioReserva.querySelector('.campos-horario');
        if (camposHorario) {
            const caja = document.createElement('section');
            caja.className = 'selector-clase-grupal';
            caja.innerHTML = `
                <h3>Tipo de entrenamiento</h3>
                <label for="modo-reserva-grupal">¿Cómo quieres reservar?</label>
                <select id="modo-reserva-grupal" name="tipoSesion"><option value="individual">Sesión individual</option><option value="grupal">Plan de clases grupales</option></select>
                <div id="opciones-grupales" hidden>
                    <label for="plan-grupal">Plan</label><select id="plan-grupal"><option value="">Selecciona un plan</option></select>
                    <label for="slot-grupal">Horario grupal disponible</label><select id="slot-grupal"><option value="">Primero selecciona un plan</option></select>
                    <p class="ayuda-grupal">Cada opción indica cuántos cupos quedan en esa clase.</p><p id="aviso-acceso-grupal" class="aviso-acceso-grupal" aria-live="polite"></p>
                </div>`;
            formularioReserva.insertBefore(caja, camposHorario);
            const modo = caja.querySelector('#modo-reserva-grupal');
            const opciones = caja.querySelector('#opciones-grupales');
            const plan = caja.querySelector('#plan-grupal');
            const slot = caja.querySelector('#slot-grupal');
            const fecha = formularioReserva.querySelector('#fecha');
            const hora = formularioReserva.querySelector('#hora');
            const avisoAcceso = caja.querySelector('#aviso-acceso-grupal');
            function cuentaActiva() {
                const username = sessionStorage.getItem('quinesiomed-usuario-activo-v1');
                if (!username) return null;
                try { return JSON.parse(localStorage.getItem('quinesiomed-cuentas-demo-v1') || '[]').find(item => item.username === username) || null; } catch { return null; }
            }
            function inicioSemana(fecha) {
                const dia = new Date(`${fecha}T12:00:00`);
                dia.setDate(dia.getDate() - ((dia.getDay() + 6) % 7));
                return `${dia.getFullYear()}-${String(dia.getMonth() + 1).padStart(2, '0')}-${String(dia.getDate()).padStart(2, '0')}`;
            }
            function clasesReservadas(cuenta, nombrePlan, fecha) {
                return reservas().filter(item => item.usuarioCuenta === cuenta.username && item.tipoSesion === 'grupal' && inicioSemana(item.fecha) === inicioSemana(fecha)).length;
            }

            function cargarSlots() {
                const elegido = plan.value;
                slot.replaceChildren(new Option(elegido ? 'Selecciona un horario' : 'Primero selecciona un plan', ''));
                if (!elegido) return;
                bloques().filter(bloque => bloque.plan === elegido && bloque.fecha >= hoyISO())
                    .sort((a, b) => `${a.fecha}${a.desde}`.localeCompare(`${b.fecha}${b.desde}`))
                    .forEach(bloque => slotsDe(bloque).forEach(horaSlot => {
                        const cuenta = cuentaActiva();
                        if (cuenta && (!(Array.isArray(cuenta.grupos) ? cuenta.grupos : cuenta.plan ? [cuenta.plan] : []).includes(elegido) || clasesReservadas(cuenta, elegido, bloque.fecha) >= Number(cuenta.weeklyClasses))) return;
                        const quedan = Number(bloque.cupos) - ocupados(bloque.id, bloque.fecha, horaSlot);
                        if (quedan <= 0) return;
                        const value = `${bloque.id}|${bloque.fecha}|${horaSlot}`;
                        slot.add(new Option(`${formatoFecha(bloque.fecha)} · ${horaSlot} · ${quedan} ${quedan === 1 ? 'cupo' : 'cupos'}`, value));
                    }));
                if (slot.options.length === 1) slot.options[0].textContent = 'No hay cupos disponibles para este plan';
            }

            function cargarPlanes() {
                const cuenta = cuentaActiva();
                const nombres = [...new Set(bloques().filter(bloque => bloque.fecha >= hoyISO() && (!cuenta || (Array.isArray(cuenta.grupos) ? cuenta.grupos : cuenta.plan ? [cuenta.plan] : []).includes(bloque.plan))).map(bloque => bloque.plan).filter(Boolean))].sort();
                const anterior = plan.value;
                plan.replaceChildren(new Option('Selecciona un plan', ''));
                nombres.forEach(nombre => plan.add(new Option(nombre, nombre)));
                if (nombres.includes(anterior)) plan.value = anterior;
                cargarSlots();
            }

            function actualizarModo() {
                const grupal = modo.value === 'grupal';
                opciones.hidden = !grupal;
                camposHorario.hidden = grupal;
                fecha.required = !grupal;
                hora.required = !grupal;
                plan.required = grupal;
                slot.required = grupal;
                formularioReserva.dataset.tipoSesion = grupal ? 'grupal' : 'individual';
                if (grupal) {
                    const cuenta = cuentaActiva();
                    avisoAcceso.textContent = cuenta ? `Clases contratadas por semana: ${Number(cuenta.weeklyClasses) || 0}. Solo podrás reservar para el plan asignado a tu cuenta.` : 'Para reservar clases grupales, inicia sesión con la cuenta que te entregó secretaría.';
                    cargarPlanes();
                }
                else {
                    delete formularioReserva.dataset.planGrupo;
                    delete formularioReserva.dataset.grupoBloqueId;
                    delete formularioReserva.dataset.grupoSlotId;
                }
            }

            modo.addEventListener('change', actualizarModo);
            formularioReserva.addEventListener('submit', evento => {
                if (modo.value !== 'grupal') return;
                const cuenta = cuentaActiva();
                if (!cuenta) {
                    evento.preventDefault(); evento.stopImmediatePropagation();
                    avisoAcceso.innerHTML = 'Para reservar clases grupales necesitas una cuenta creada por secretaría. <a href="./usuario.html">Inicia sesión aquí</a>.';
                    return;
                }
                if (!(Array.isArray(cuenta.grupos) ? cuenta.grupos : cuenta.plan ? [cuenta.plan] : []).includes(plan.value) || !Number(cuenta.weeklyClasses)) {
                    evento.preventDefault(); evento.stopImmediatePropagation();
                    avisoAcceso.textContent = 'Tu cuenta no tiene asignado este plan o una cantidad semanal de clases. Contacta a secretaría.';
                }
            }, true);
            plan.addEventListener('change', cargarSlots);
            slot.addEventListener('change', () => {
                if (!slot.value) return;
                const [bloqueId, fechaElegida, horaElegida] = slot.value.split('|');
                const bloque = bloques().find(item => item.id === bloqueId);
                if (!bloque) return;
                fecha.value = fechaElegida;
                hora.value = horaElegida;
                formularioReserva.dataset.tipoSesion = 'grupal';
                formularioReserva.dataset.planGrupo = bloque.plan;
                formularioReserva.dataset.grupoBloqueId = bloque.id;
                formularioReserva.dataset.grupoSlotId = slot.value;
            });
            formularioReserva.addEventListener('reset', () => window.setTimeout(() => { modo.value = 'individual'; actualizarModo(); }, 0));
            window.addEventListener('storage', evento => { if (evento.key === CLAVE || evento.key === CLAVE_RESERVAS) cargarPlanes(); });
            window.addEventListener('quinesiomed:reserva-guardada', cargarPlanes);
            window.addEventListener('quinesiomed:bloques-actualizados', cargarPlanes);
            actualizarModo();
            const parametros = new URLSearchParams(window.location.search);
            if (parametros.get('tipo') === 'grupal') {
                modo.value = 'grupal';
                actualizarModo();
                const planSolicitado = parametros.get('plan') || '';
                if ([...plan.options].some(opcion => opcion.value === planSolicitado)) {
                    plan.value = planSolicitado;
                    cargarSlots();
                }
            }
        }
    }

    // Añade al panel autenticado de secretaría el formulario de configuración de horarios.
    const panel = document.querySelector('#vista-agenda-secretaria');
    const encabezado = panel?.querySelector('.encabezado-panel');
    if (panel && encabezado && !panel.querySelector('#gestion-horarios-grupales')) {
        const seccion = document.createElement('section');
        seccion.id = 'gestion-horarios-grupales';
        seccion.className = 'gestion-horarios-grupales';
        seccion.setAttribute('aria-labelledby', 'titulo-horarios-grupales');
        seccion.innerHTML = `
            <span class="etiqueta-inicio">ACONDICIONAMIENTO FÍSICO</span>
            <h2 id="titulo-horarios-grupales">Horarios para clases grupales</h2>
            <p>Define el plan, la fecha, el rango horario, la duración de cada clase y cuántos alumnos pueden reservar cada horario.</p>
            <form id="formulario-bloque-grupal" class="formulario-bloque-grupal">
                <label>Nombre del plan<input name="plan" maxlength="60" placeholder="Ej.: Plan grupal 3 veces por semana" required></label>
                <label>Fecha de las clases<input name="fecha" type="date" required></label>
                <label>Desde<input name="desde" type="time" required></label>
                <label>Hasta<input name="hasta" type="time" required></label>
                <label>Duración de cada clase<select name="duracion"><option value="30">30 minutos</option><option value="45">45 minutos</option><option value="60" selected>60 minutos</option><option value="90">90 minutos</option></select></label>
                <label>Cupos por clase<input name="cupos" type="number" min="1" max="30" value="6" required></label>
                <button class="boton-inicio" type="submit">Agregar horarios disponibles</button>
                <p id="mensaje-bloque-grupal" role="status" aria-live="polite"></p>
            </form>
            <h3>Bloques configurados</h3><ul id="lista-bloques-grupales" class="lista-bloques-grupales"></ul>
            <p class="aviso-grupos-local">Modo de demostración: los horarios se guardan solo en este navegador. Para compartir disponibilidad y reservas con alumnos desde otros dispositivos se necesita un servidor y una base de datos.</p>`;
        encabezado.insertAdjacentElement('afterend', seccion);
        const formulario = seccion.querySelector('#formulario-bloque-grupal');
        const lista = seccion.querySelector('#lista-bloques-grupales');
        const mensaje = seccion.querySelector('#mensaje-bloque-grupal');
        const fechaInput = formulario.elements.fecha;
        fechaInput.min = hoyISO();
        fechaInput.value = fechaInput.min;

        function dibujarBloques() {
            lista.replaceChildren();
            const listaBloques = bloques().sort((a, b) => `${a.fecha}${a.desde}`.localeCompare(`${b.fecha}${b.desde}`));
            if (!listaBloques.length) {
                const vacio = document.createElement('li'); vacio.className = 'sin-bloques'; vacio.textContent = 'Todavía no hay horarios configurados.'; lista.append(vacio); return;
            }
            listaBloques.forEach(bloque => {
                const item = document.createElement('li'); item.className = 'bloque-grupal-item';
                const detalle = document.createElement('div');
                const nombre = document.createElement('strong'); nombre.textContent = bloque.plan;
                const info = document.createElement('span'); info.textContent = `${formatoFecha(bloque.fecha)} · ${bloque.desde} a ${bloque.hasta} · clases de ${bloque.duracion} min · ${bloque.cupos} cupos por clase`;
                const ocupacion = document.createElement('span'); ocupacion.textContent = slotsDe(bloque).map(h => `${h}: ${ocupados(bloque.id, bloque.fecha, h)}/${bloque.cupos}`).join(' | ');
                detalle.append(nombre, info, ocupacion);
                const eliminar = document.createElement('button'); eliminar.type = 'button'; eliminar.textContent = 'Eliminar bloque';
                eliminar.addEventListener('click', () => {
                    if (reservas().some(reserva => reserva.grupoBloqueId === bloque.id)) { mensaje.textContent = 'No se puede eliminar porque este bloque ya tiene reservas.'; return; }
                    guardar(bloques().filter(actual => actual.id !== bloque.id));
                    mensaje.textContent = 'Bloque eliminado.'; dibujarBloques();
                    window.dispatchEvent(new Event('quinesiomed:bloques-actualizados'));
                });
                item.append(detalle, eliminar); lista.append(item);
            });
        }

        formulario.addEventListener('submit', evento => {
            evento.preventDefault(); mensaje.textContent = '';
            const desde = formulario.elements.desde.value;
            const hasta = formulario.elements.hasta.value;
            const duracion = Number(formulario.elements.duracion.value);
            if (horaAMinutos(hasta) <= horaAMinutos(desde)) { mensaje.textContent = 'La hora “Hasta” debe ser posterior a “Desde”.'; return; }
            if (horaAMinutos(hasta) - horaAMinutos(desde) < duracion) { mensaje.textContent = 'El rango debe alcanzar al menos la duración de una clase.'; return; }
            const bloque = { id: `grupo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, plan: formulario.elements.plan.value.trim(), fecha: formulario.elements.fecha.value, desde, hasta, duracion, cupos: Number(formulario.elements.cupos.value) };
            const actualizados = bloques(); actualizados.push(bloque); guardar(actualizados);
            mensaje.textContent = 'Horarios agregados. Ya aparecen como opciones para reservar en este navegador.';
            formulario.reset(); fechaInput.value = fechaInput.min; formulario.elements.cupos.value = '6';
            dibujarBloques(); window.dispatchEvent(new Event('quinesiomed:bloques-actualizados'));
        });
        window.addEventListener('storage', evento => { if (evento.key === CLAVE || evento.key === CLAVE_RESERVAS) dibujarBloques(); });
        window.addEventListener('quinesiomed:reserva-guardada', dibujarBloques);
        dibujarBloques();
    }
})();