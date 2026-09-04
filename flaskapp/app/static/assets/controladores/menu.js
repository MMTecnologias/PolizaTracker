$(function () {
  if (nivelUsuario === 'Desarollador') {
    $('#polizas').show();
    $('#endosos').show();
    $('#clientes').show();
    $('#recibos').show();
    $('#vencimientos').show();
    $('#reportes').show();
    $('#usuarios').show();
    $('#reportesG').show();
    $('#utilerias').show();
    $('#solicitudes').show();
    // $('#acerca').show();
  } else if (nivelUsuario === 'Administrador') {
    $('#utilerias').show();
    $('#usuarios').show();
    $('#solicitudes').show();
  } else if (nivelUsuario === 'Gerente') {
    $('#polizas').show();
    $('#endosos').show();
    $('#recibos').show();
    $('#vencimientos').show();
    $('#reportesG').show();
    $('#solicitudes').show();
  } else if (nivelUsuario === 'Usuario') {
    $('#polizas').show();
    $('#endosos').show();
    $('#clientes').show();
    $('#recibos').show();
    $('#vencimientos').show();
    $('#reportes').show();
    $('#utilerias').show();
  }

  const numberOfRequests = async () => {
    const response = await fetch('/solicitudes/get_pending');
    const data = await response.json();
    const bubble = document.querySelector('.numberOfRequests');
    const bubbleTxt = document.querySelector('#numberOfRequests');
    data.recordsTotal == 0
      ? bubble.classList.add('hidden')
      : bubble.classList.remove('hidden');
    bubbleTxt.innerHTML = data.recordsTotal;
  };
  numberOfRequests();
});
