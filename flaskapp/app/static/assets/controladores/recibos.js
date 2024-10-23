$(function () {
  const ajaxConfig = {
    url: '',
    type: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    dataType: 'json',
  };

  function alert(text = '', icon = 'success', title = '') {
    Swal.fire({ title, text, icon });
  }

  function fillTableRecibos(resp, formDataFechas, currentPage, itemsOnPage) {
    const { data, recordsTotal } = resp;
    const table = $('#table-receipts');
    table.html('');
    $.each(data, function (idx, poliza) {
      table.append(
        `<tr class="tableOption">
          <td>
            <p class="td-clickable" id="td-clickable_${poliza.id}">
                ${poliza.no_de_recibo}
            </p>
          </td>
          <td>${poliza.endoso !== null ? 'Endoso' : 'Poliza'}</td>
          <td>${poliza.endoso !== null ? poliza.endoso : poliza.poliza}</td>
          <td>${poliza.aseguradora}</td>
          <td>${poliza.prima_neta}</td>
          <td>${poliza.prima_total}</td>
          <td>${poliza.moneda}</td>
          <td>${poliza.fecha_inicio}</td>
          <td>${poliza.cliente}</td>
          <td>${poliza.agente}</td>
          <td>${poliza.ramo}</td>
          <td>${poliza.subramo}</td>
          <td>${poliza.forma_pago}</td>
        </tr>`
      );
    });
    $('#pagination-receipts').pagination({
      items: recordsTotal,
      prevText: 'Anterior',
      nextText: 'Siguiente',
      itemsOnPage,
      currentPage,
      onPageClick: (pageNumber, e) => {
        const start = (pageNumber - 1) * itemsOnPage;
        getRecibos(formDataFechas, pageNumber, start);
      },
    });
  }

  function getRecibos(formDataFechas = null, pageNumber = 1, start = 0) {
    const length = 10;
    const params = $.param({ start, length });
    $.ajax({
      ...ajaxConfig,
      url: '/polizas/get_all_receipts',
      data: formDataFechas ? formDataFechas + '&' + params : params,
      success: (resp) =>
        fillTableRecibos(resp, formDataFechas, pageNumber, length),
      error: (xhr, status, error) => console.error(error),
    });
  }

  $('#form-fechas').submit(function (e) {
    e.preventDefault();
    if (!this.checkValidity())
      return alert('Debes llenar los dos campos de fecha', 'warning');
    const formDataFechas = $('#form-fechas').serialize();
    getRecibos(formDataFechas);
  });

  getRecibos();
});
