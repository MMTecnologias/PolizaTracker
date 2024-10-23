$(function () {
  const series = [
    {
      name: 'sales',
      type: 'bar',
      data: [5, 20, 36, 10, 10, 20],
    },
  ];
  const seriesPie = [
    {
      name: 'Access From',
      type: 'pie',
      radius: '50%',
      data: [
        { value: 1048, name: 'Search Engine' },
        { value: 735, name: 'Direct' },
        { value: 580, name: 'Email' },
        { value: 484, name: 'Union Ads' },
        { value: 300, name: 'Video Ads' },
      ],
      emphasis: {
        itemStyle: {
          shadowBlur: 10,
          shadowOffsetX: 0,
          shadowColor: 'rgba(0, 0, 0, 0.5)',
        },
      },
    },
  ];
  function getBarChart(series) {
    if (!series) return;
    const dom = document.getElementById('bar_chart');
    const myChart = echarts.init(dom);
    const option = {
      title: {
        text: 'Pólizas canceladas',
      },
      tooltip: {},
      legend: {
        data: ['sales'],
      },
      xAxis: {
        data: ['Shirts', 'Cardigans', 'Chiffons', 'Pants', 'Heels', 'Socks'],
      },
      yAxis: {},
      series,
    };
    option && myChart.setOption(option);
  }
  function getPieChart(series) {
    if (!series) return;
    const dom = document.getElementById('pie_chart');
    const myChart = echarts.init(dom);
    const option = {
      title: {
        text: 'Pólizas canceladas',
        subtext: 'Fake Data',
        left: 'center',
      },
      tooltip: {
        trigger: 'item',
      },
      legend: {
        orient: 'vertical',
        left: 'left',
      },
      series,
    };
    option && myChart.setOption(option);
  }

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
                ${poliza.no_de_recibo}
            </p>
          </td>
          <td>${poliza.endoso !== null ? 'Endoso' : 'Poliza'}</td>
          <td>${poliza.endoso !== null ? poliza.endoso : poliza.poliza}</td>
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
      url: '/vencimientos/get_upcoming_receipts',
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
    if ($('#start_date').val() && $('#end_date').val()) {
      const formDataFechas = $('#form-fechas').serialize();
      params = `${params}&${formDataFechas}`;
    }
    $.ajax({
      type: 'POST',
      url: '/vencimientos/get_upcoming_receipts',
      data: params,
      xhrFields: {
        responseType: 'blob',
      },
      success: function (blob, status, xhr) {
        // Crear un enlace temporal para descargar el archivo
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
  getBarChart(series);
  getPieChart(seriesPie);
});
