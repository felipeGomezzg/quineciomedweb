// Acceso local de socios. El servidor deberá autenticar las cuentas en la versión publicada.
(() => {
    const KEY='quinesiomed-cuentas-demo-v1', RES='quinesiomed-reservas-v1', SESSION='quinesiomed-usuario-activo-v1';
    const read=key=>{try{const value=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(value)?value:[]}catch{return[]}};
    const form=document.querySelector('#formulario-entrar'), loginView=document.querySelector('#vista-cuenta'), panel=document.querySelector('#vista-mi-cuenta');
    function mondayISO(date){const day=new Date(`${date}T12:00:00`);const weekday=(day.getDay()+6)%7;day.setDate(day.getDate()-weekday);return `${day.getFullYear()}-${String(day.getMonth()+1).padStart(2,'0')}-${String(day.getDate()).padStart(2,'0')}`}
    async function passwordHash(password,salt){const material=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt:Uint8Array.from(atob(salt),c=>c.charCodeAt(0)),iterations:120000,hash:'SHA-256'},material,256);return btoa(String.fromCharCode(...new Uint8Array(bits)))}
    function show(username){
        const account=read(KEY).find(item=>item.username===username);
        if(!account){sessionStorage.removeItem(SESSION);return}
        const groups=Array.isArray(account.grupos)?account.grupos.filter(Boolean):(account.plan?[account.plan]:[]);
        loginView.hidden=true;panel.hidden=false;
        document.querySelector('#nombre-cuenta').textContent=account.fullName||account.username;
        document.querySelector('#plan-cuenta').textContent=groups.join(' · ')||'Sin grupos asignados';
        const limit=Number(account.weeklyClasses)||0;
        document.querySelector('#detalle-plan-cuenta').textContent=limit?`Tienes ${limit} ${limit===1?'clase contratada':'clases contratadas'} por semana.`:'Secretaría debe asignarte una cantidad semanal de clases.';
        const groupLinks=document.querySelector('#accesos-grupos');groupLinks.replaceChildren();
        groups.forEach(group=>{const link=document.createElement('a');link.className='enlace-cuenta';link.href=`./agenda.html?tipo=grupal&plan=${encodeURIComponent(group)}#formulario-reserva`;link.textContent=`Reservar en ${group}`;groupLinks.append(link)});
        const generalLink=document.querySelector('#enlace-reservar-grupal');generalLink.hidden=groups.length>0;generalLink.href='./agenda.html#formulario-reserva';
        drawReservations(account)
    }
    function drawReservations(account){const all=read(RES).filter(item=>item.usuarioCuenta===account.username&&item.tipoSesion==='grupal');const monday=mondayISO(new Date().toLocaleDateString('en-CA'));const thisWeek=all.filter(item=>mondayISO(item.fecha)===monday).sort((a,b)=>`${a.fecha}${a.hora}`.localeCompare(`${b.fecha}${b.hora}`));const limit=Number(account.weeklyClasses)||0;document.querySelector('#resumen-cupos-semana').textContent=`Clases reservadas esta semana: ${thisWeek.length} de ${limit}. ${Math.max(0,limit-thisWeek.length)} disponibles.`;const list=document.querySelector('#reservas-cuenta'),empty=document.querySelector('#sin-reservas-cuenta');list.replaceChildren();empty.hidden=thisWeek.length>0;thisWeek.forEach(item=>{const li=document.createElement('li');const date=new Date(`${item.fecha}T12:00:00`).toLocaleDateString('es-CL',{weekday:'long',day:'numeric',month:'long'});li.textContent=`${item.planGrupo||account.plan} · ${date} · ${item.hora}`;list.append(li)})}
    form.elements.rut.addEventListener('blur',()=>{if(form.elements.rut.value.trim())form.elements.rut.value=window.QuinesiomedRut.formatear(form.elements.rut.value)});
    form.addEventListener('submit',async event=>{event.preventDefault();const message=document.querySelector('#mensaje-entrar');message.textContent='';if(!globalThis.crypto?.subtle){message.textContent='Abre esta página con Live Server o HTTPS para iniciar sesión en esta demostración.';return}const rut=form.elements.rut.value.trim(),normalizedRut=window.QuinesiomedRut.normalizar(rut),password=form.elements.clave.value;const expectedVerifier=window.QuinesiomedRut.verificadorEsperado(rut);if(!expectedVerifier){message.textContent='Ingresa el RUT completo, incluido su dígito verificador.';return}if(!window.QuinesiomedRut.valido(rut)){
            const candidate=window.QuinesiomedRut.formatear(normalizedRut.slice(0,-1)+expectedVerifier);
            message.textContent='El dígito verificador no coincide. Para ese número base sería '+candidate+'. Revisa el RUT ingresado.';
            return;
        }const account=read(KEY).find(item=>window.QuinesiomedRut.normalizar(item.rut||item.username)===normalizedRut);if(!account){message.textContent='Secretaría debe registrar o actualizar tu RUT antes de iniciar sesión.';return}try{if(await passwordHash(password,account.salt)!==account.hash){message.textContent='La contraseña no coincide.';return}sessionStorage.setItem(SESSION,account.username);show(account.username)}catch{message.textContent='No se pudo verificar la cuenta.'}});
    document.querySelector('#form-cambiar-clave').addEventListener('submit',async event=>{
        event.preventDefault();const form=event.currentTarget,message=document.querySelector('#mensaje-cambio-clave');message.textContent='';
        const username=sessionStorage.getItem(SESSION),accounts=read(KEY),account=accounts.find(item=>item.username===username);
        if(!account){message.textContent='Vuelve a iniciar sesión para cambiar la contraseña.';return}
        const current=form.elements.actual.value,next=form.elements.nueva.value,confirm=form.elements.confirmar.value;
        if(next.length<10){message.textContent='Usa al menos 10 caracteres.';return}if(next!==confirm){message.textContent='Las nuevas contraseñas no coinciden.';return}
        try{if(await passwordHash(current,account.salt)!==account.hash){message.textContent='La contraseña actual no coincide.';return}const salt=btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));account.salt=salt;account.hash=await passwordHash(next,salt);localStorage.setItem(KEY,JSON.stringify(accounts));form.reset();message.textContent='Contraseña actualizada en este navegador.'}catch{message.textContent='No se pudo actualizar la contraseña.'}
    });    document.querySelector('#cerrar-cuenta').addEventListener('click',()=>{sessionStorage.removeItem(SESSION);panel.hidden=true;loginView.hidden=false;form.reset()});
    window.addEventListener('storage',event=>{if(event.key===KEY){const active=sessionStorage.getItem(SESSION);if(active)show(active)}});
    const username=sessionStorage.getItem(SESSION);if(username)show(username);
})();