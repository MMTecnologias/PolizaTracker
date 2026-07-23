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

  function fillTableRecibosPagados(
    resp,
    formDataFechas,
    currentPage,
    itemsOnPage,
    formMultiple
  ) {
    if (resp.error) {
      alert(resp.msg || 'No se pudieron cargar los recibos pagados', 'warning');
      return;
    }

    const { data, recordsTotal } = resp;
    const table = $('#table-recibos');
    table.html('');
    $.each(data, function (idx, recibo) {
      const tipoDocumento =
        recibo.tipo_documento || (recibo.endoso ? 'Endoso' : 'Poliza');
      const documento = recibo.documento || recibo.endoso || recibo.poliza;

      table.append(
        `<tr class="tableOption">
          <td>
            <p class="td-clickable" id="td-clickable_${recibo.id}">
                ${recibo.no_de_recibo}
            </p>
          </td>
          <td>${tipoDocumento}</td>
          <td>${documento}</td>
          <td>${recibo.serie}</td>
          <td>${recibo.notas}</td>
          <td>${recibo.aseguradora}</td>
          <td>$${formatNumber(Number(recibo.prima_neta || 0))}</td>
          <td>$${formatNumber(Number(recibo.prima_total || 0))}</td>
          <td>${recibo.moneda}</td>
          <td>${recibo.fecha_pago}</td>
          <td>${recibo.cliente}</td>
          <td>${recibo.agente}</td>
          <td>${recibo.ramo}</td>
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
        getRecibosPagados(formDataFechas, pageNumber, start, formMultiple);
      },
    });
  }

  function getRecibosPagados(
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
    $.ajax({
      ...ajaxConfig,
      url: '/reportes/recibos_pagados',
      data: formDataFechas ? formDataFechas + '&' + params : params,
      success: (resp) => {
        fillTableRecibosPagados(
          resp,
          formDataFechas,
          pageNumber,
          length,
          formMultiple
        );
      },
      error: (xhr, status, error) => console.error(error),
    });
  }

  function validateFilters() {
    const clienteId = $('#cliente_id').val();
    const grupoId = $('#grupo_id').val();
    if (clienteId && grupoId) {
      alert('No puedes filtrar combinando cliente y grupo', 'warning');
      return false;
    }
    return true;
  }

  function getMultipleIds() {
    $.ajax({
      ...ajaxConfig,
      type: 'GET',
      url: '/reportes/get_multiple_ids',
      data: {},
      success: (resp) => {
        const { Aseguradora, Grupo, Ramo, Agente, Vendedor, Cliente } = resp;
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
        $('#agente_id').append(`<option value="">Selecciona agente</option>`);
        for (const agente of Agente.data) {
          $('#agente_id').append(
            `<option value='${agente.id}'>${agente.nombre}</option>`
          );
        }
        $('#vendedor_id').append(
          `<option value="">Selecciona vendedor</option>`
        );
        for (const vendedor of Vendedor.data) {
          $('#vendedor_id').append(
            `<option value='${vendedor.id}'>${vendedor.nombre}</option>`
          );
        }
        $('#cliente_id').append(`<option value="">Selecciona cliente</option>`);
        for (const cliente of Cliente.data) {
          $('#cliente_id').append(
            `<option value='${cliente.id}'>${cliente.nombre}</option>`
          );
        }
      },
      error: (xhr, status, error) => console.error(error),
    });
  }

  $('#form-multiple').submit(function (e) {
    e.preventDefault();
    if (!validateFilters()) return;
    const formMultiple = $('#form-multiple').serialize();
    getRecibosPagados(null, 1, 0, formMultiple);
  });

  function exportRecibosPagados(exportParam, extension) {
    if (exportInProgress || !validateFilters()) return;

    exportInProgress = true;
    let params = $.param({ [exportParam]: true });
    const formMultiple = $('#form-multiple').serialize();
    params = `${params}&${formMultiple}`;
    const exportText = extension === 'pdf' ? 'PDF' : 'CSV';
    let exportError = null;

    $.ajax({
      type: 'POST',
      url: '/reportes/recibos_pagados',
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
        a.download = `recibos_pagados_${new Date()
          .toLocaleDateString()
          .replace(/\//g, '-')}.${extension}`;
        document.body.append(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
      },
      error: (xhr, status, error) => {
        console.error(error);
        exportError = 'No se pudo generar el reporte de recibos pagados';
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
    exportRecibosPagados('export_csv', 'csv');
  });

  $('#btnPdf').click((e) => {
    e.preventDefault();
    exportRecibosPagados('export_pdf', 'pdf');
  });

  getMultipleIds();
  getRecibosPagados();
});
