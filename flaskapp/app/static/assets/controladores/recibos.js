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

  function fillTableRecibos(
    resp,
    formDataFechas,
    currentPage,
    itemsOnPage,
    formMultiple
  ) {
    const { data, recordsTotal } = resp;
    console.log(data);

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
          <td>${poliza.status}</td>
          <td>${poliza.aseguradora}</td>
          <td>${poliza.prima_neta}</td>
          <td>${poliza.prima_total}</td>
          <td>${poliza.moneda}</td>
          <td>${poliza.fecha_pago ? poliza.fecha_pago : ''}</td>
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
        getRecibos(formDataFechas, pageNumber, start, formMultiple);
      },
    });
  }

  function getRecibos(
    formDataFechas = null,
    pageNumber = 1,
    start = 0,
    formMultiple = null
  ) {
    const length = 10;
    let params = $.param({ start, length });
    if (formMultiple) {
      params = formMultiple + '&' + params;
    }
    $.ajax({
      ...ajaxConfig,
      url: '/polizas/get_all_receipts',
      data: formDataFechas ? formDataFechas + '&' + params : params,
      success: (resp) =>
        fillTableRecibos(
          resp,
          formDataFechas,
          pageNumber,
          length,
          formMultiple
        ),
      error: (xhr, status, error) => console.error(error),
    });
  }

  function getMultipleIds() {
    $.ajax({
      ...ajaxConfig,
      type: 'GET',
      url: '/reportes/get_multiple_ids',
      data: {},
      success: (resp) => {
        const { Aseguradora, Grupo, Ramo, Agente, Cliente, Vendedor } = resp;
        $('#aseguradora_id').append(
          `<option value="">Selecciona aseguradora</option>`
        );
        for (const aseg of Aseguradora.data) {
          $('#aseguradora_id').append(
            `<option value='${aseg.id}'>${aseg.aseguradora}</option>`
          );
        }
        $('#grupo_id').append(`<option value="">Selecciona grupo</option>`);
        for (const grupo of Grupo.data) {
          $('#grupo_id').append(
            `<option value='${grupo.id}'>${grupo.grupo}</option>`
          );
        }
        $('#ramo_id').append(`<option value="">Selecciona ramo</option>`);
        for (const ramo of Ramo.data) {
          $('#ramo_id').append(
            `<option value='${ramo.id}'>${ramo.ramo}</option>`
          );
        }
        $('#cliente_id').append(`<option value="">Selecciona Cliente</option>`);
        for (const cliente of Cliente.data) {
          $('#cliente_id').append(
            `<option value='${cliente.id}'>${
              cliente.nombre + ' ' + cliente.apellido
            }</option>`
          );
        }
        $('#agente_id').append(`<option value="">Selecciona agente</option>`);
        for (const agente of Agente.data) {
          $('#agente_id').append(
            `<option value='${agente.id}'>${agente.nombre}</option>`
          );
        }
        $('#vendedor_id').append(
          `<option value="">Selecciona Vendedor</option>`
        );
        for (const vendedor of Vendedor.data) {
          $('#vendedor_id').append(
            `<option value='${vendedor.id}'>${vendedor.nombre}</option>`
          );
        }
      },
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

  $('#form-multiple').submit(function (e) {
    e.preventDefault();
    const multiple = $('#form-multiple').serialize();
    getRecibos(null, 1, 0, multiple);
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
      url: '/reportes/prima_neta',
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
      url: '/reportes/prima_neta',
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

  getMultipleIds();
  getRecibos();
});
