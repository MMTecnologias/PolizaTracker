document.addEventListener('DOMContentLoaded', function () {
   const nivelUsuario = sessionStorage.getItem('UserRol');
   const Documentos = document.getElementById('documentos');
   const clientes = document.getElementById('Clientes');
   const recibos = document.getElementById('Recibos');
   const vencimientos = document.getElementById('Vencimientos');
   const reportes = document.getElementById('Reportes');
   const utilerias = document.getElementById('Utilerias')
   const acerca = document.getElementById('acerca')
   const usuario = document.getElementById('cardUser');
   const reportesG = document.getElementById('ReportesG');
   if (nivelUsuario === 'admin') {
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
   if(nivelUsuario==='gerente'){
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

   if(nivelUsuario==='usuario'){
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

