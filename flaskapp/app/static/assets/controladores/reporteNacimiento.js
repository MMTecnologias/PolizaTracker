$(function () {
  let exportForMonth = false;
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

  function fillTableNacimientos(resp, month, currentPage, itemsOnPage) {
    const { data, recordsTotal } = resp;
    const table = $('#table-nacimientos');
    table.html('');
    $.each(data, function (idx, cliente) {
      table.append(
        `<tr class="tableOption">
          <td>${cliente.nombre}</td>
          <td>${cliente.correo}</td>
          <td>${cliente.telefono === null ? '' : cliente.telefono}</td>
          <td>${cliente.fecha_nacimiento}</td>
        </tr>`
      );
    });
    $('#pagination-nacimientos').pagination({
      items: recordsTotal,
      prevText: 'Anterior',
      nextText: 'Siguiente',
      itemsOnPage,
      currentPage,
      onPageClick: (pageNumber, e) => {
        const start = (pageNumber - 1) * itemsOnPage;
        getNacimientos(month, pageNumber, start);
      },
    });
  }

  function getNacimientos(month = null, pageNumber = 1, start = 0) {
    const length = 15;
    const params = $.param({ start, length });
    exportForMonth = month ? true : false;
    $.ajax({
      ...ajaxConfig,
      url: '/reportes/fecha_nacimientos',
      data: month ? 'current_report=month' + '&' + params : params,
      success: (resp) => fillTableNacimientos(resp, month, pageNumber, length),
      error: (xhr, status, error) => console.error(error),
    });
  }

  $('#btnMonth').click((e) => {
    e.preventDefault();
    getNacimientos('month');
  });

  $('#btnExportar').click((e) => {
    e.preventDefault();
    let params = $.param({ export_csv: true });
    if (exportForMonth) params = 'current_report=month&' + params;
    $.ajax({
      type: 'POST',
      url: '/reportes/fecha_nacimientos',
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
    if (exportForMonth) params = 'current_report=month&' + params;
    $.ajax({
      type: 'POST',
      url: '/reportes/fecha_nacimientos',
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

  $('#searchClient').on('keyup', function (e) {
    e.preventDefault();
    const search_client_name = e.target.value;
    if (search_client_name == '') return getNacimientos();
    if (search_client_name.length >= 3)
      $.ajax({
        ...ajaxConfig,
        url: '/reportes/fecha_nacimientos',
        data: $.param({ start: 0, length: 0, search_client_name }),
        success: (resp) => fillTableNacimientos(resp, 1, 15),
        error: (xhr, status, error) => console.error(error),
      });
  });

  // $('#sortByName').click((e) => {
  //   e.preventDefault();
  //   ordered = !ordered;
  //   getNacimientos(ordered);
  // });

  getNacimientos();
});
