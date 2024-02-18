document.addEventListener('DOMContentLoaded', function () {

    const Documentos = document.getElementById('documentos');
    const clientes = document.getElementById('Clientes');
    const recibos = document.getElementById('Recibos');
    const vencimientos = document.getElementById('Vencimientos');
    const reportes = document.getElementById('Reportes');
    const utilerias = document.getElementById('Utilerias')
    const acerca = document.getElementById('acerca')
    const usuario = document.getElementById('cardUser');
    const reportesG = document.getElementById('ReportesG');
    //1	Administrador
    //3	Desarollador
    //4	Gerente
    //2	Usuario
    Documentos.style.display = 'none';
    clientes.style.display = 'none';
    recibos.style.display = 'none';
    vencimientos.style.display = 'none';
    reportes.style.display = 'none';
    utilerias.style.display = 'none';
    acerca.style.display = 'none';
    usuario.style.display = 'none';
    reportesG.style.display = 'none';
    if(nivelUsuario=='Desarollador'){
        Documentos.style.display = 'block';
        clientes.style.display = 'block';
        recibos.style.display = 'block';
        vencimientos.style.display = 'block';
        reportes.style.display = 'block';
        utilerias.style.display = 'block';
        acerca.style.display = 'block';
        usuario.style.display = 'block';
        reportesG.style.display = 'block';
     }
    if (nivelUsuario === 'Administrador') {
       Documentos.style.display = 'none';
       clientes.style.display = 'none';
       recibos.style.display = 'none';
       vencimientos.style.display = 'none';
       reportes.style.display = 'none';
       utilerias.style.display = 'block';
       acerca.style.display = 'block';
       usuario.style.display = 'block';
       reportesG.style.display = 'none';
    }
    if(nivelUsuario=='Gerente'){
       Documentos.style.display = 'none';
       clientes.style.display = 'block';
       recibos.style.display = 'block';
       vencimientos.style.display = 'none';
       reportes.style.display = 'none';
       utilerias.style.display = 'none';
       acerca.style.display = 'block';
       usuario.style.display = 'none';
       reportesG.style.display = 'block';
    }
 
    if(nivelUsuario=='Usuario'){
       Documentos.style.display = 'none';
       clientes.style.display = 'block';
       recibos.style.display = 'block';
       vencimientos.style.display = 'block';
       reportes.style.display = 'block';
       utilerias.style.display = 'none';
       acerca.style.display = 'block';
       usuario.style.display = 'none';
       reportesG.style.display = 'none';
    }
 
 
 });
 