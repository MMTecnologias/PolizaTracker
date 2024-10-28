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
                ${poliza['Poliza o Endoso']}
            </p>
          </td>
          <td>${poliza.endoso ? poliza.endoso : ''}</td>
          <td>${poliza.poliza}</td>
          <td>${poliza.prima_neta}</td>
          <td>${poliza.prima_total}</td>
          <td>${poliza.fecha_inicio}</td>
          <td>${poliza.fecha_fin}</td>
          <td>${poliza.cliente}</td>
          <td>${poliza.vendedor}</td>
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
    $.ajax({
      ...ajaxConfig,
      url: '/vencimientos/get_upcoming_policies',
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
      success: ({ Aseguradora, Cliente, Grupo }) => {
        $('#aseguradora').append(
          `<option value="">Selecciona aseguradora</option>`
        );
        for (const aseg of Aseguradora.data) {
          $('#aseguradora').append(
            `<option value='${aseg.id}'>${aseg.aseguradora}</option>`
          );
        }
        $('#cliente').append(`<option value="">Selecciona cliente</option>`);
        for (const cliente of Cliente.data) {
          $('#cliente').append(
            `<option value='${cliente.id}'>${cliente.nombre}</option>`
          );
        }
        $('#grupo').append(`<option value="">Selecciona grupo</option>`);
        for (const grupo of Grupo.data) {
          $('#grupo').append(
            `<option value='${grupo.id}'>${grupo.grupo}</option>`
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
    getVencimientos(formDataFechas);
  });

  $('#form-multiple').submit(function (e) {
    e.preventDefault();
    const multiple = $('#form-multiple').serialize();
    if ($('#cliente').val() && $('#grupo').val())
      return alert('No puedes filtrar combinando cliente y grupo', 'warning');
    getVencimientos(null, 1, 0, multiple);
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
      url: '/vencimientos/get_upcoming_policies',
      data: params,
      xhrFields: {
        responseType: 'blob',
      },
      success: function (blob, status, xhr) {
        // Crear un enlace temporal para descargar el archivo
        let a = document.createElement('a');
        let url = window.URL.createObjectURL(blob);
        a.href = url;
        a.download = `reporte_renovaciones_${new Date().toLocaleDateString()}.csv`;
        document.body.append(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
      },
      error: function (xhr, status, error) {
        console.error(error);
      },
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
      url: '/vencimientos/get_upcoming_policies',
      data: params,
      xhrFields: {
        responseType: 'blob',
      },
      success: function (blob, status, xhr) {
        let a = document.createElement('a');
        let url = window.URL.createObjectURL(blob);
        a.href = url;
        a.download = `reporte_renovaciones_${new Date().toLocaleDateString()}.pdf`;
        document.body.append(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
      },
      error: function (xhr, status, error) {
        console.error(error);
      },
    });
  });

  $('#btnImprimir').click((e) => {
    e.preventDefault();
    $.ajax({
      type: 'POST',
      url: '/vencimientos/get_upcoming_policies',
      data: { export_pdf: true },
      xhrFields: {
        responseType: 'blob',
      },
      success: function (blob, status, xhr) {
        const fileURL = URL.createObjectURL(blob);
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = fileURL;
        document.body.appendChild(iframe);
        iframe.contentWindow.print();
      },
      error: function (xhr, status, error) {
        console.error(error);
      },
    });
  });

  //   $("#searchPoliza").on("keyup", function (e) {
  //     e.preventDefault();
  //     const searchValue = e.target.value;
  //     if (searchValue == "") return getVencimientos();
  //     if (searchValue.length >= 3)
  //       $.ajax({
  //         ...ajaxConfig,
  //         url: "/polizas/get",
  //         data: $.param({ start: 0, length: 0, searchValue }),
  //         success: fillTableVencimientos,
  //         error: (xhr, status, error) => console.error(error),
  //       });
  //   });
  getMultipleIds();
  getVencimientos();
});
