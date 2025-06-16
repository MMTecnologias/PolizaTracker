$(function () {
  const ajaxConfig = {
    url: '',
    type: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    dataType: 'json',
  };

  const chartConfig = {
    title: { text: 'Stacked Line' },
    tooltip: { trigger: 'axis' },
    legend: { data: [] },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true,
    },
    toolbox: { feature: { aveAsImage: {} } },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: [],
    },
    yAxis: { type: 'value' },
    series: [],
  };

  const meses = [
    'Enero',
    'Febrero',
    'Marzo',
    'Abril',
    'Mayo',
    'Junio',
    'Julio',
    'Agosto',
    'Septiembre',
    'Octubre',
    'Noviembre',
    'Diciembre',
  ];

  let years = [];

  function createSeriesForCategory(data) {
    const series = years.map((year) => ({
      type: 'line',
      stack: 'Total',
      name: year,
      data: Array.from(meses, () => 0),
    }));
    for (const dat of data) {
      const i = dat.month - 1;
      const serieIndex = series.findIndex((c) => c.name === dat['year']);
      if (i !== -1) {
        series[serieIndex]['data'][i] += Number(dat.polizas_totales);
      }
    }
    return series;
  }

  function getBarChart(data, type = 'year') {
    if (!data.length) return;
    $('#chart-container').html(
      '<div id="bar_chart" style="width: 100%;height:500px;"></div>'
    );
    const dom = document.getElementById('bar_chart');
    const myChart = echarts.init(dom);
    const by = $('#by').val();
    years = [...new Set(data.map((item) => item.year))];
    chartConfig.legend.data = years;
    chartConfig.xAxis.data = meses;
    const series = createSeriesForCategory(data);
    chartConfig.series = series;
    console.log(series);
    // myChart.on('mouseover', 'series.bar', (params) => {
    //   const { name, seriesName } = params;
    //   let filteredData = data;
    //   if (meses.includes(name)) {
    //     filteredData = filteredData.filter(
    //       (item) => item.month === meses.findIndex((m) => m === name) + 1
    //     );
    //   } else {
    //     filteredData = filteredData.filter(
    //       (item) => item.year === Number(name)
    //     );
    //   }
    //   filteredData = filteredData.filter(
    //     (item) => item[categoryMap[by]] === seriesName
    //   );
    //   fillTablePolizastatus(filteredData);
    // });
    // myChart.on('mouseout', 'series.bar', () => {
    //   $('#table-polizastatus').html('');
    // });
    myChart.setOption(chartConfig);
  }

  function getPolizaStatus(
    formDataFechas = null,
    pageNumber = 1,
    start = 0,
    formMultiple = null
  ) {
    const length = 12;
    let params = $.param({ start, length });
    if (formMultiple) {
      params = formMultiple + '&' + params;
    }
    $.ajax({
      ...ajaxConfig,
      url: '/reportes/polizas_preprocessed',
      data: formDataFechas ? formDataFechas + '&' + params : params,
      success: (resp) => {
        getBarChart(resp.data);
      },
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
        const { Aseguradora, Grupo, Ramo, Agente, Vendedor } = resp;
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
    let years = '';
    if ($('#years').val()) {
      years = $('#years')
        .val()
        .reduce((acc, cur, i, arr) => {
          let yerarStr = (acc += cur);
          if (i !== arr.length - 1) {
            yerarStr += ',';
          }
          return yerarStr;
        }, 'years=');
    }
    let multiple = $($('#form-multiple')[0].elements).not('#years').serialize();
    if (years) multiple = `${multiple}&${years}`;
    getPolizaStatus(null, 1, 0, multiple);
  });

  $('#btnExportar').click((e) => {
    e.preventDefault();
    let params = $.param({ export_csv: true });
    let years = '';
    if ($('#years').val()) {
      years = $('#years')
        .val()
        .reduce((acc, cur, i, arr) => {
          let yerarStr = (acc += cur);
          if (i !== arr.length - 1) {
            yerarStr += ',';
          }
          return yerarStr;
        }, 'years=');
    }
    let multiple = $($('#form-multiple')[0].elements).not('#years').serialize();
    if (years) multiple = `${multiple}&${years}`;
    if (multiple) params = `${params}&${multiple}`;
    $.ajax({
      type: 'POST',
      url: '/reportes/polizas',
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
    let years = '';
    if ($('#years').val()) {
      years = $('#years')
        .val()
        .reduce((acc, cur, i, arr) => {
          let yerarStr = (acc += cur);
          if (i !== arr.length - 1) {
            yerarStr += ',';
          }
          return yerarStr;
        }, 'years=');
    }
    let multiple = $($('#form-multiple')[0].elements).not('#years').serialize();
    if (years) multiple = `${multiple}&${years}`;
    if (multiple) params = `${params}&${multiple}`;
    $.ajax({
      type: 'POST',
      url: '/reportes/polizas',
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

  $('#years').select2({
    placeholder: 'seleciona los años',
    tags: true,
  });

  getMultipleIds();
  getPolizaStatus();
});
