$(function () {
  const ajaxConfig = {
    url: '',
    type: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    dataType: 'json',
  };

  const chartConfig = {
    title: { text: 'Comparación Prima neta' },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: {},
    xAxis: {
      type: 'value',
      boundaryGap: [0, 0.01],
    },
    yAxis: { type: 'category', data: [] },
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

  function createSeriesForCategory(data, categoryName, type, baseArray) {
    const series = years.map((year) => ({
      type: 'bar',
      name: year,
      data: Array.from(meses, () => 0),
    }));
    for (const dat of data) {
      const i = dat.month - 1;
      const serieIndex = series.findIndex((c) => c.name === dat['year']);
      if (i !== -1) {
        series[serieIndex]['data'][i] += Number(dat.total_prima_neta_pagada);
      }
    }
    return series;
  }

  function getBarChart(data) {
    if (!data.length) return;
    $('#chart-container').html(
      '<div id="bar_chart" style="width: 100%;height:500px;"></div>'
    );
    const dom = document.getElementById('bar_chart');
    const myChart = echarts.init(dom);
    years = [...new Set(data.map((item) => item.year))];
    chartConfig.yAxis.data = meses;
    const series = createSeriesForCategory(data);
    console.log(series);
    chartConfig.series = series;
    fillTablePrimaNeta(series);
    myChart.setOption(chartConfig);
  }

  function fillTablePrimaNeta(series) {
    const tables_prima_neta = $('#tables_prima_neta');
    tables_prima_neta.html('');
    $.each(series, function (i, serie) {
      tables_prima_neta.append(
        `<h4 class="header-title">
          Tabla totales prima neta acomulada ${serie.name}
        </h4>
          <table class="table">
            <thead class="tableHeader">
              <tr id="tr_table1">
                ${meses.reduce(
                  (acc, curr) => (acc += `<th scope="col">${curr}</th>`),
                  ''
                )}
              </tr>
            </thead>
            <tbody id="table_table1">
              <tr class="tableOption">
                ${serie.data.reduce(
                  (acc, curr) =>
                    (acc += `<td>$
                  ${formatNumber(Number(curr?.toFixed(2) || 0))}
                </td>`),
                  ''
                )}
              </tr>
            </tbody>
          </table>
        `
      );
    });
  }

  function getPrimaNeta(pageNumber = 1, start = 0, formMultiple = null) {
    const length = 12;
    if (!formMultiple) {
      let months1 = '';
      if ($('#months1').val()) {
        months1 = $('#months1')
          .val()
          .reduce((acc, cur, i, arr) => {
            let months1Str = (acc += cur);
            if (i !== arr.length - 1) {
              months1Str += ',';
            }
            return months1Str;
          }, 'months1=');
      } else {
        months1 = 'months1=1,2,3,4,5,6,7,8,9,10,11,12';
      }
      let months2 = '';
      if ($('#months2').val()) {
        months2 = $('#months2')
          .val()
          .reduce((acc, cur, i, arr) => {
            let months2Str = (acc += cur);
            if (i !== arr.length - 1) {
              months2Str += ',';
            }
            return months2Str;
          }, 'months2=');
      } else {
        months2 = 'months2=1,2,3,4,5,6,7,8,9,10,11,12';
      }
      let multiple = $($('#form-multiple')[0].elements)
        .not('#months1')
        .not('#months2')
        .serialize();
      if (months1) multiple = `${multiple}&${months1}`;
      if (months2) multiple = `${multiple}&${months2}`;
      formMultiple = multiple;
    }
    let params = $.param({ start, length });
    if (formMultiple) {
      params = formMultiple + '&' + params;
    }
    $.ajax({
      ...ajaxConfig,
      url: '/reportes/prima_neta_compare',
      data: params,
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
    let months1 = '';
    if ($('#months1').val()) {
      months1 = $('#months1')
        .val()
        .reduce((acc, cur, i, arr) => {
          let months1Str = (acc += cur);
          if (i !== arr.length - 1) {
            months1Str += ',';
          }
          return months1Str;
        }, 'months1=');
    } else {
      months1 = 'months1=1,2,3,4,5,6,7,8,9,10,11,12';
    }
    let months2 = '';
    if ($('#months2').val()) {
      months2 = $('#months2')
        .val()
        .reduce((acc, cur, i, arr) => {
          let months2Str = (acc += cur);
          if (i !== arr.length - 1) {
            months2Str += ',';
          }
          return months2Str;
        }, 'months2=');
    } else {
      months2 = 'months2=1,2,3,4,5,6,7,8,9,10,11,12';
    }
    let multiple = $($('#form-multiple')[0].elements)
      .not('#months1')
      .not('#months2')
      .serialize();
    if (months1) multiple = `${multiple}&${months1}`;
    if (months2) multiple = `${multiple}&${months2}`;
    getPrimaNeta(1, 0, multiple);
  });

  $('#btnExportar').click((e) => {
    e.preventDefault();
    let params = $.param({ export_csv: true });
    let months1 = '';
    if ($('#months1').val()) {
      months1 = $('#months1')
        .val()
        .reduce((acc, cur, i, arr) => {
          let months1Str = (acc += cur);
          if (i !== arr.length - 1) {
            months1Str += ',';
          }
          return months1Str;
        }, 'months1=');
    }
    let months2 = '';
    if ($('#months2').val()) {
      months2 = $('#months2')
        .val()
        .reduce((acc, cur, i, arr) => {
          let months2Str = (acc += cur);
          if (i !== arr.length - 1) {
            months2Str += ',';
          }
          return months2Str;
        }, 'months2=');
    }
    let multiple = $($('#form-multiple')[0].elements)
      .not('#months1')
      .not('#months2')
      .serialize();
    if (months1) multiple = `${multiple}&${months1}`;
    if (months2) multiple = `${multiple}&${months2}`;
    if (multiple) params = `${params}&${multiple}`;
    console.log(params);
    $.ajax({
      type: 'POST',
      url: '/reportes/prima_neta_compare',
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
    let months1 = '';
    if ($('#months1').val()) {
      months1 = $('#months1')
        .val()
        .reduce((acc, cur, i, arr) => {
          let months1Str = (acc += cur);
          if (i !== arr.length - 1) {
            months1Str += ',';
          }
          return months1Str;
        }, 'months1=');
    }
    let months2 = '';
    if ($('#months2').val()) {
      months2 = $('#months2')
        .val()
        .reduce((acc, cur, i, arr) => {
          let months2Str = (acc += cur);
          if (i !== arr.length - 1) {
            months2Str += ',';
          }
          return months2Str;
        }, 'months2=');
    }
    let multiple = $($('#form-multiple')[0].elements)
      .not('#months1')
      .not('#months2')
      .serialize();
    if (months1) multiple = `${multiple}&${months1}`;
    if (months2) multiple = `${multiple}&${months2}`;
    if (multiple) params = `${params}&${multiple}`;
    console.log(params);
    $.ajax({
      type: 'POST',
      url: '/reportes/prima_neta_compare',
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

  $('#year1').select2({
    placeholder: 'seleciona año inicio',
    tags: true,
  });
  $('#months1').select2({
    placeholder: 'seleciona meses inicio',
    tags: true,
  });
  $('#year2').select2({
    placeholder: 'seleciona año fin',
    tags: true,
  });
  $('#months2').select2({
    placeholder: 'seleciona meses fin',
    tags: true,
  });

  getMultipleIds();
  getPrimaNeta();
});
