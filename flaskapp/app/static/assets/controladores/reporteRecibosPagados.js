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

  function fillTableRecibosPagados(
    resp,
    formDataFechas,
    currentPage,
    itemsOnPage
  ) {
    const { data, recordsTotal } = resp;
    const table = $('#table-recibos');
    table.html('');
    $.each(data, function (idx, recibo) {
      table.append(
        `<tr class="tableOption">
          <td>
            <p class="td-clickable" id="td-clickable_${recibo.id}">
                ${recibo.no_de_recibo}
            </p>
          </td>
          <td>${recibo.endoso !== null ? 'Endoso' : 'Poliza'}</td>
          <td>${recibo.endoso !== null ? recibo.endoso : recibo.poliza}</td>
          <td>${recibo.aseguradora}</td>
          <td>${recibo.prima_neta}</td>
          <td>${recibo.prima_total}</td>
          <td>${recibo.moneda}</td>
          <td>${recibo.fecha_inicio}</td>
          <td>${recibo.cliente}</td>
          <td>${recibo.agente}</td>
          <td>${recibo.ramo}</td>
          <td>${recibo.subramo}</td>
          <td>${recibo.forma_pago}</td>
        </tr>`
      );
    });
    $('#pagination-recibos').pagination({
      items: recordsTotal,
      prevText: 'Anterior',
      nextText: 'Siguiente',
      itemsOnPage,
      currentPage,
      onPageClick: (pageNumber, e) => {
        const start = (pageNumber - 1) * itemsOnPage;
        getRecibosPagados(formDataFechas, pageNumber, start);
      },
    });
  }

  function getRecibosPagados(formDataFechas = null, pageNumber = 1, start = 0) {
    const length = 15;
    const params = $.param({ start, length });
    $.ajax({
      ...ajaxConfig,
      url: '/reportes/recibos_pagados',
      data: formDataFechas ? formDataFechas + '&' + params : params,
      success: (resp) => {
        console.log(resp.data);
        fillTableRecibosPagados(resp, formDataFechas, pageNumber, length);
      },
      error: (xhr, status, error) => console.error(error),
    });
  }

  $('#form-fechas').submit(function (e) {
    e.preventDefault();
    if (!this.checkValidity())
      return alert('Debes llenar los dos campos de fecha', 'warning');
    const formDataFechas = $('#form-fechas').serialize();
    getRecibosPagados(formDataFechas);
  });

  $('#btnExportar').click((e) => {
    e.preventDefault();
    let params = $.param({ export_csv: true });
    if ($('#start_date').val() && $('#end_date').val()) {
      const formDataFechas = $('#form-fechas').serialize();
      params = `${params}&${formDataFechas}`;
    }
    $.ajax({
      type: 'POST',
      url: '/reportes/recibos_pagados',
      data: params,
      xhrFields: {
        responseType: 'blob',
      },
      success: function (blob, status, xhr) {
        let a = document.createElement('a');
        let url = window.URL.createObjectURL(blob);
        a.href = url;
        a.download = `reporte_cobranza_${new Date().toLocaleDateString()}.csv`;
        document.body.append(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
      },
      error: (xhr, status, error) => console.error(error),
    });
  });

  $('#btnPdf').click((e) => {
    e.preventDefault();
    let params = $.param({ export_pdf: true });
    if ($('#start_date').val() && $('#end_date').val()) {
      const formDataFechas = $('#form-fechas').serialize();
      params = `${params}&${formDataFechas}`;
    }
    $.ajax({
      type: 'POST',
      url: '/reportes/recibos_pagados',
      data: params,
      xhrFields: {
        responseType: 'blob',
      },
      success: function (blob, status, xhr) {
        let a = document.createElement('a');
        let url = window.URL.createObjectURL(blob);
        a.href = url;
        a.download = `reporte_cobranza_${new Date().toLocaleDateString()}.pdf`;
        document.body.append(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
      },
      error: (xhr, status, error) => console.error(error),
    });
  });

  getRecibosPagados();
});
