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

  let exportInProgress = false;

  function formatNumber(num, options = {}) {
    const { separator = ',', decimalPoint = '.', groupSize = 3 } = options;
    const parts = num.toString().split('.');
    const integerPart = parts[0];
    const decimalPart = parts.length > 1 ? parts[1] : '';
    let result = '';
    for (let i = 0; i < integerPart.length; i++) {
      if (i > 0 && (integerPart.length - i) % groupSize === 0) {
        result += separator;
      }
      result += integerPart[i];
    }
    if (decimalPart) {
      result += decimalPoint + decimalPart;
    }
    return result;
  }

  function fillTableRecibos(
    resp,
    formDataFechas,
    currentPage,
    itemsOnPage,
    formMultiple
  ) {
    if (resp.error) {
      alert(resp.msg || 'No se pudieron cargar los recibos', 'warning');
      return;
    }

    const { data, recordsTotal } = resp;
    const table = $('#table-receipts');
    table.html('');
    $.each(data, function (idx, poliza) {
      const tipoDocumento =
        poliza.tipo_documento || (poliza.endoso ? 'Endoso' : 'Poliza');
      const documento = poliza.documento || poliza.endoso || poliza.poliza;

      table.append(
        `<tr class="tableOption">
          <td>
            <p class="td-clickable" id="td-clickable_${poliza.id}">
                ${poliza.no_de_recibo}
            </p>
          </td>
          <td>${tipoDocumento}</td>
          <td>${documento}</td>
          <td>${poliza.serie}</td>
          <td>${poliza.notas}</td>
          <td>${poliza.status}</td>
          <td>${poliza.aseguradora}</td>
          <td>$${formatNumber(Number(poliza.prima_neta || 0))} ${
          poliza.moneda
        }</td>
          <td>$${formatNumber(Number(poliza.prima_total || 0))} ${
          poliza.moneda
        }</td>
          <td>${poliza.fecha_pago ? poliza.fecha_pago : ''}</td>
          <td>${poliza.cliente}</td>
          <td>${poliza.agente}</td>
          <td>${poliza.ramo}</td>
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

  function exportRecibos(exportParam, extension) {
    if (exportInProgress) return;

    exportInProgress = true;
    let params = $.param({ [exportParam]: true });
    const formMultiple = $('#form-multiple').serialize();
    params = `${params}&${formMultiple}`;
    const exportText = extension === 'pdf' ? 'PDF' : 'CSV';
    let exportError = null;

    $.ajax({
      type: 'POST',
      url: '/polizas/get_all_receipts',
      data: params,
      xhrFields: {
        responseType: 'blob',
      },
      beforeSend: () => {
        $('#btnExportar, #btnPdf').prop('disabled', true);
        Swal.fire({
          title: `Generando ${exportText}`,
          text: 'Esto puede tardar unos minutos si hay muchos recibos.',
          allowOutsideClick: false,
          allowEscapeKey: false,
          didOpen: () => {
            Swal.showLoading();
          },
        });
      },
      success: function (blob) {
        const a = document.createElement('a');
        const url = window.URL.createObjectURL(blob);
        a.href = url;
        a.download = `recibos_${new Date()
          .toLocaleDateString()
          .replace(/\//g, '-')}.${extension}`;
        document.body.append(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
      },
      error: (xhr, status, error) => {
        console.error(error);
        exportError = 'No se pudo generar el archivo de recibos';
      },
      complete: () => {
        exportInProgress = false;
        $('#btnExportar, #btnPdf').prop('disabled', false);
        Swal.close();
        if (exportError) {
          alert(exportError, 'error');
        }
      },
    });
  }

  $('#btnExportar').click((e) => {
    e.preventDefault();
    exportRecibos('export_csv', 'csv');
  });

  $('#btnPdf').click((e) => {
    e.preventDefault();
    exportRecibos('export_pdf', 'pdf');
  });

  getMultipleIds();
  getRecibos();
});
