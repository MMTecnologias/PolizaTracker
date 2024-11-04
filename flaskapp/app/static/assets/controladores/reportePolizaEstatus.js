$(function () {
  function getBarChart(data, tipo = 'month') {
    if (!data.length) return;
    console.log(data, tipo);
    $('#chart-container').html(
      '<div id="bar_chart" style="width: 100%;height:500px;"></div>'
    );
    let option = {};
    let source = [];
    let series = [];
    const mesesMatrix = [
      ['Enero'],
      ['Febrero'],
      ['Marzo'],
      ['Abril'],
      ['Mayo'],
      ['Junio'],
      ['Julio'],
      ['Agosto'],
      ['Septiembre'],
      ['Octubre'],
      ['Noviembre'],
      ['Diciembre'],
    ];
    const dom = document.getElementById('bar_chart');
    const myChart = echarts.init(dom);
    if (tipo === 'month') {
      const status = ['Emitidas', 'Renovadas', 'Canceladas', 'Renovaciones'];
      series = status.map((item) => ({ type: 'bar' }));
      for (const dat of data) {
        mesesMatrix[dat.month - 1][1] = dat.polizas_nuevas;
        mesesMatrix[dat.month - 1][2] = dat.polizas_renovadas;
        mesesMatrix[dat.month - 1][3] = dat.polizas_canceladas;
        mesesMatrix[dat.month - 1][4] = dat.renovaciones;
      }
      source = [['Mes', ...status], ...mesesMatrix];
      option = {
        legend: {},
        tooltip: {},
        dataset: {
          source: source,
        },
        xAxis: { type: 'category' },
        yAxis: {},
        series,
      };
    }
    if (tipo === 'year') {
      let years = data.map((item) => [String(item.year).trim()]);
      const yearsTuple = data.map((item) => [String(item.year).trim()]);
      const status = ['Emitidas', 'Renovadas', 'Canceladas', 'Renovaciones'];
      series = status.map((item) => ({ type: 'bar' }));
      for (const dat of data) {
        const i = yearsTuple
          .flat()
          .findIndex((y) => y === String(dat.year).trim());
        if (i !== -1) {
          years[i][1] = dat.polizas_nuevas;
          years[i][2] = dat.polizas_renovadas;
          years[i][3] = dat.polizas_canceladas;
          years[i][4] = dat.renovaciones;
        }
      }
      source = [['Año', ...status], ...years];
      option = {
        legend: {},
        tooltip: {},
        dataset: {
          source: source,
        },
        xAxis: { type: 'category' },
        yAxis: {},
        series,
      };
    }
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

  function fillTablePolizastatus(
    resp,
    formDataFechas,
    currentPage,
    itemsOnPage,
    formMultiple = null
  ) {
    const { data, recordsTotal } = resp;
    const table = $('#table-polizastatus');
    table.html('');
    $.each(data, function (idx, poliza) {
      table.append(
        `<tr class="tableOption">
          <td>${poliza.year}</td>
          <td>${poliza.month ? poliza.month : ''}</td>
          <td>${poliza.polizas_nuevas}</td>
          <td>${poliza.polizas_renovadas}</td>
          <td>${poliza.polizas_canceladas}</td>
          <td>${poliza.renovaciones}</td>
          <td>${poliza.polizas_totales}</td>
        </tr>`
      );
    });
    $('#pagination-polizastatus').pagination({
      items: recordsTotal,
      prevText: 'Anterior',
      nextText: 'Siguiente',
      itemsOnPage,
      currentPage,
      onPageClick: (pageNumber, e) => {
        const start = (pageNumber - 1) * itemsOnPage;
        getPolizaStatus(formDataFechas, pageNumber, start, formMultiple);
      },
    });
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
      url: '/reportes/polizas',
      data: formDataFechas ? formDataFechas + '&' + params : params,
      success: (resp) => {
        if (formMultiple && formMultiple.includes('type_report=year')) {
          getBarChart(resp.data, 'year');
        } else {
          getBarChart(resp.data);
        }
        fillTablePolizastatus(
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
    const multiple = $($('#form-multiple')[0].elements)
      .not('#years')
      .serialize();
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
    const multiple = $($('#form-multiple')[0].elements)
      .not('#years')
      .serialize();
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
