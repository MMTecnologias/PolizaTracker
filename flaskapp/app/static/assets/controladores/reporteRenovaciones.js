$(function () {
  let ordered = false;
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
    itemsOnPage
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
          <td>${poliza.fecha_fin}</td>
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
        getVencimientos(formDataFechas, pageNumber, start);
      },
    });
  }

  function getVencimientos(formDataFechas = null, pageNumber = 1, start = 0) {
    const length = 10;
    const params = $.param({ start, length });
    $.ajax({
      ...ajaxConfig,
      url: '/vencimientos/get_upcoming_policies',
      data: formDataFechas ? formDataFechas + '&' + params : params,
      success: (resp) =>
        fillTableVencimientos(resp, formDataFechas, pageNumber, length),
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
        // Crear un enlace temporal para descargar el archivo
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

  /* // Exportar a CSV al hacer click en el botón con formulario
$("#btnExportar").click((e) => {
  e.preventDefault();

  // Crear un formulario oculto
  let $form = $("<form>")
      .attr("method", "POST")
      .attr("action", "/vencimientos/get_upcoming_policies");

  // Añadir el campo export_csv al formulario
  let $input = $("<input>")
      .attr("type", "hidden")
      .attr("name", "export_csv")
      .attr("value", "true");

  $form.append($input);
  $("body").append($form);
  $form.submit();
});
*/

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

  getVencimientos();
});
