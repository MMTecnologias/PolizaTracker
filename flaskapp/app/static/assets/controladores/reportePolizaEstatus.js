$(function () {
  function getBarChart(data, tipo = 'year') {
    if (!data.length) return;
    $('#chart-container').html(
      '<div id="bar_chart" style="width: 100%;height:400px;"></div>'
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

  function getBarChart2(data) {
    if (!data.length) return;
    $('#chart_container_2').html(
      '<div id="bar_chart_2" style="width: 100%;height:400px;"></div>'
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
    const dom = document.getElementById('bar_chart_2');
    const myChart = echarts.init(dom);
    const by = $('#by').val();
    if (by === 'aseguradora') {
      const xValues = ['Emitidas', 'Renovadas', 'Canceladas', 'Renovaciones'];
      series = xValues.map((item) => ({ type: 'bar' }));
      for (const dat of data) {
        mesesMatrix[dat.month - 1][1] = dat.polizas_nuevas;
        mesesMatrix[dat.month - 1][2] = dat.polizas_renovadas;
        mesesMatrix[dat.month - 1][3] = dat.polizas_canceladas;
        mesesMatrix[dat.month - 1][4] = dat.renovaciones;
      }
      source = [['Aseguradora', ...xValues], ...mesesMatrix];
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
    if (by === 'grupo') {
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
    if (by === 'ramo') {
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
    if (by === 'agente') {
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
    if (by === 'vendedor') {
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
    // if (tipo === 'year') {
    //   let years = data.map((item) => [String(item.year).trim()]);
    //   const yearsTuple = data.map((item) => [String(item.year).trim()]);
    //   const status = ['Emitidas', 'Renovadas', 'Canceladas', 'Renovaciones'];
    //   series = status.map((item) => ({ type: 'bar' }));
    //   for (const dat of data) {
    //     const i = yearsTuple
    //       .flat()
    //       .findIndex((y) => y === String(dat.year).trim());
    //     if (i !== -1) {
    //       years[i][1] = dat.polizas_nuevas;
    //       years[i][2] = dat.polizas_renovadas;
    //       years[i][3] = dat.polizas_canceladas;
    //       years[i][4] = dat.renovaciones;
    //     }
    //   }
    //   source = [['Año', ...status], ...years];
    //   option = {
    //     legend: {},
    //     tooltip: {},
    //     dataset: {
    //       source: source,
    //     },
    //     xAxis: { type: 'category' },
    //     yAxis: {},
    //     series,
    //   };
    // }
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
    let dataTable = data;
    if (formMultiple && formMultiple.includes('type_report=month')) {
      dataTable = data.reduce((acc, curr) => {
        const i = acc.findIndex((item) => item.year === curr.year);
        if (i !== -1) {
          acc[i].polizas_nuevas += curr.polizas_nuevas;
          acc[i].polizas_renovadas += curr.polizas_renovadas;
          acc[i].polizas_canceladas += curr.polizas_canceladas;
          acc[i].renovaciones += curr.renovaciones;
          acc[i].polizas_totales += curr.polizas_totales;
          acc[i].year = curr.year;
        } else {
          acc.push(curr);
        }
        return acc;
      }, []);
    }
    const table = $('#table-polizastatus');
    table.html('');
    $.each(dataTable, function (idx, poliza) {
      table.append(
        `<tr class="tableOption">
          <td>${poliza.year}</td>
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

  function fillTablePolizastatus2(
    resp,
    formDataFechas,
    currentPage,
    itemsOnPage,
    formMultiple = null
  ) {
    const { data, recordsTotal } = resp;
    let dataTable = data;
    if (formMultiple && formMultiple.includes('type_report=month')) {
      dataTable = data.reduce((acc, curr) => {
        const i = acc.findIndex((item) => item.year === curr.year);
        if (i !== -1) {
          acc[i].polizas_nuevas += curr.polizas_nuevas;
          acc[i].polizas_renovadas += curr.polizas_renovadas;
          acc[i].polizas_canceladas += curr.polizas_canceladas;
          acc[i].renovaciones += curr.renovaciones;
          acc[i].polizas_totales += curr.polizas_totales;
          acc[i].year = curr.year;
        } else {
          acc.push(curr);
        }
        return acc;
      }, []);
    }
    const table = $('#table_poliza_status');
    table.html('');
    $.each(dataTable, function (idx, poliza) {
      table.append(
        `<tr class="tableOption">
          <td>${poliza.year}</td>
          <td>${poliza.polizas_totales}</td>
        </tr>`
      );
    });
    $('#pagination_poliza_status_2').pagination({
      items: recordsTotal,
      prevText: 'Anterior',
      nextText: 'Siguiente',
      itemsOnPage,
      currentPage,
      onPageClick: (pageNumber, e) => {
        const start = (pageNumber - 1) * itemsOnPage;
        getPolizaStatus2(formDataFechas, pageNumber, start, formMultiple);
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
        if (formMultiple && formMultiple.includes('type_report=month')) {
          getBarChart(resp.data, 'month');
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

  function getPolizaStatus2(
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
        if (formMultiple && formMultiple.includes('type_report=month')) {
          getBarChart2(resp.data, 'month');
        } else {
          getBarChart2(resp.data);
        }
        fillTablePolizastatus2(
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

  $('#form_multiple_2').submit(function (e) {
    e.preventDefault();
    let years = '';
    if ($('#years_2').val()) {
      years = $('#years_2')
        .val()
        .reduce((acc, cur, i, arr) => {
          let yerarStr = (acc += cur);
          if (i !== arr.length - 1) {
            yerarStr += ',';
          }
          return yerarStr;
        }, 'years=');
    }
    let multiple = $($('#form_multiple_2')[0].elements)
      .not('#years_2')
      .serialize();
    if (years) multiple = `${multiple}&${years}`;
    getPolizaStatus2(null, 1, 0, multiple);
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

  // $('#years_2').select2({
  //   placeholder: 'seleciona los años',
  //   tags: true,
  // });

  getMultipleIds();
  getPolizaStatus();
  // getPolizaStatus2();
});
