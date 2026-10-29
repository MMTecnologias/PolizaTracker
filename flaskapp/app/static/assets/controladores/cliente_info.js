// Muestra un modal con los datos del cliente al dar clic en su nombre
// (cualquier elemento con la clase .cliente-link y data-cliente-id).
(function () {
  $(document).on('click', '.cliente-link', function (e) {
    e.preventDefault();
    e.stopPropagation();
    const id = $(this).data('cliente-id');
    if (!id) return;
    const $m = $('#cliente-info-modal');
    $('#cliente-info-titulo').text($(this).text().trim() || 'Datos del cliente');
    $('#cliente-info-tabla').hide();
    $('#cliente-info-error').hide();
    $('#cliente-info-cargando').show();
    $m.modal('show');
    $.ajax({
      url: '/clientes/get',
      method: 'POST',
      data: { start: 0, length: 1, searchValue: '', order: '', cliente_id: id },
      success: function (resp) {
        $('#cliente-info-cargando').hide();
        const c = resp && resp.data && resp.data[0];
        if (!c) {
          $('#cliente-info-error').text('No se encontró el cliente.').show();
          return;
        }
        $('#cliente-info-tabla [data-campo]').each(function () {
          const v = c[$(this).data('campo')];
          $(this).text(v === null || v === undefined || v === '' ? '—' : v);
        });
        $('#cliente-info-tabla').show();
      },
      error: function () {
        $('#cliente-info-cargando').hide();
        $('#cliente-info-error').text('No se pudieron cargar los datos del cliente.').show();
      },
    });
  });
})();
