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

  function fillTableVencimientos(
    resp,
    formDataFechas,
    currentPage,
    itemsOnPage,
    formMultiple = null
  ) {
    const { data, recordsTotal } = resp;
    const table = $('#table-vencimientos');
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
    $('#pagination').pagination({
      items: recordsTotal,
      prevText: 'Anterior',
      nextText: 'Siguiente',
      itemsOnPage,
      currentPage,
      onPageClick: (pageNumber, e) => {
        const start = (pageNumber - 1) * itemsOnPage;
        getVencimientos(formDataFechas, pageNumber, start, formMultiple);
      },
    });
  }

  function getVencimientos(
    formDataFechas = null,
    pageNumber = 1,
    start = 0,
    formMultiple = null
  ) {
    const length = 15;
    let params = $.param({ start, length });
    if (formMultiple) {
      params = formMultiple + '&' + params;
    }
    console.log(params);
    $.ajax({
      ...ajaxConfig,
      url: '/vencimientos/get_upcoming_receipts',
      data: formDataFechas ? formDataFechas + '&' + params : params,
      success: (resp) =>
        fillTableVencimientos(
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
      success: ({ Aseguradora, Cliente, Grupo, Vendedor, Agente }) => {
        $('#aseguradora_id').append(
          `<option value="">Selecciona aseguradora</option>`
        );
        for (const aseg of Aseguradora.data) {
          $('#aseguradora_id').append(
            `<option value='${aseg.id}'>${aseg.aseguradora}</option>`
          );
        }
        $('#cliente_id').append(`<option value="">Selecciona cliente</option>`);
        for (const cliente of Cliente.data) {
          $('#cliente_id').append(
            `<option value='${cliente.id}'>${cliente.nombre}</option>`
          );
        }
        $('#grupo_id').append(`<option value="">Selecciona grupo</option>`);
        for (const grupo of Grupo.data) {
          $('#grupo_id').append(
            `<option value='${grupo.id}'>${grupo.grupo}</option>`
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

  $('#form-multiple').submit(function (e) {
    e.preventDefault();
    const cliente_id = $('#cliente_id').val();
    const grupo_id = $('#grupo_id').val();
    if (cliente_id && grupo_id)
      return alert('No puedes filtrar combinando cliente y grupo', 'warning');
    const formMultiple = $('#form-multiple').serialize();
    getVencimientos(null, 1, 0, formMultiple);
  });

  $('#btnExportar').click((e) => {
    e.preventDefault();
    let params = $.param({ export_csv: true });
    const formMultiple = $('#form-multiple').serialize();
    params = `${params}&${formMultiple}`;
    $.ajax({
      type: 'POST',
      url: '/vencimientos/get_upcoming_receipts',
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
    const formMultiple = $('#form-multiple').serialize();
    params = `${params}&${formMultiple}`;
    $.ajax({
      type: 'POST',
      url: '/vencimientos/get_upcoming_receipts',
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
  getVencimientos();
});
