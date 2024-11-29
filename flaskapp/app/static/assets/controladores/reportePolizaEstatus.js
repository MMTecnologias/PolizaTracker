$(function () {
  function getBarChart(data) {
    if (!data.length) return;
    $('#chart-container').html(
      '<div id="bar_chart" style="width: 100%;height:500px;"></div>'
    );
    const dom = document.getElementById('bar_chart');
    const myChart = echarts.init(dom);
    const by = $('#by').val();
    const status = ['Emitidas', 'Renovadas', 'Canceladas', 'Renovaciones'];
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
    let option = {
      legend: {},
      tooltip: {},
      yAxis: [{ type: 'value' }],
    };
    const serieStatic = {
      type: 'bar',
      stack: 'Add',
      emphasis: { focus: 'series' },
    };
    if (by === 'month') {
      const series = status.map((stat) => ({
        ...serieStatic,
        name: stat,
        data: Array.from(meses, (v, i) => i * 0),
      }));
      for (const dat of data) {
        if (dat.month && !isNaN(dat.month)) {
          series[0]['data'][dat.month - 1] += Number(dat.polizas_nuevas);
          series[1]['data'][dat.month - 1] += Number(dat.polizas_renovadas);
          series[2]['data'][dat.month - 1] += Number(dat.polizas_canceladas);
          series[3]['data'][dat.month - 1] += Number(dat.renovaciones);
        }
      }
      option = {
        ...option,
        xAxis: [{ type: 'category', data: meses }],
        series,
      };
    }
    if (by === 'year') {
      const years = [...new Set(data.map(({ year }) => String(year).trim()))];
      const series = status.map((stat) => ({
        ...serieStatic,
        name: stat,
        data: Array.from(years, (v, i) => i * 0),
      }));
      for (const dat of data) {
        const i = years.findIndex((y) => y === String(dat.year).trim());
        if (i !== -1) {
          series[0]['data'][i] += Number(dat.polizas_nuevas);
          series[1]['data'][i] += Number(dat.polizas_renovadas);
          series[2]['data'][i] += Number(dat.polizas_canceladas);
          series[3]['data'][i] += Number(dat.renovaciones);
        }
      }
      option = {
        ...option,
        xAxis: [{ type: 'category', data: years }],
        series,
      };
    }
    if (by === 'aseguradora') {
      const asegs = [...new Set(data.map((item) => item.aseguradora))];
      const series = status.map((stat) => ({
        ...serieStatic,
        name: stat,
        data: Array.from(asegs, (v, i) => i * 0),
      }));
      for (const dat of data) {
        const iA = asegs.findIndex((a) => a === dat.aseguradora);
        if (iA !== -1) {
          series[0]['data'][iA] += Number(dat.polizas_nuevas);
          series[1]['data'][iA] += Number(dat.polizas_renovadas);
          series[2]['data'][iA] += Number(dat.polizas_canceladas);
          series[3]['data'][iA] += Number(dat.renovaciones);
        }
      }
      option = {
        ...option,
        xAxis: [{ type: 'category', data: asegs }],
        series,
      };
    }
    if (by === 'grupo') {
      const groups = [...new Set(data.map((item) => item.grupo))];
      const series = status.map((stat) => ({
        ...serieStatic,
        name: stat,
        data: Array.from(groups, (v, i) => i * 0),
      }));
      for (const dat of data) {
        const iG = groups.findIndex((a) => a === dat.grupo);
        if (iG !== -1) {
          series[0]['data'][iG] += Number(dat.polizas_nuevas);
          series[1]['data'][iG] += Number(dat.polizas_renovadas);
          series[2]['data'][iG] += Number(dat.polizas_canceladas);
          series[3]['data'][iG] += Number(dat.renovaciones);
        }
      }
      option = {
        ...option,
        xAxis: [{ type: 'category', data: groups }],
        series,
      };
    }
    if (by === 'ramo') {
      const ramos = [...new Set(data.map((item) => item.ramo))];
      const series = status.map((stat) => ({
        ...serieStatic,
        name: stat,
        data: Array.from(ramos, (v, i) => i * 0),
      }));
      for (const dat of data) {
        const iR = ramos.findIndex((a) => a === dat.ramo);
        if (iR !== -1) {
          series[0]['data'][iR] += Number(dat.polizas_nuevas);
          series[1]['data'][iR] += Number(dat.polizas_renovadas);
          series[2]['data'][iR] += Number(dat.polizas_canceladas);
          series[3]['data'][iR] += Number(dat.renovaciones);
        }
      }
      option = {
        ...option,
        xAxis: [{ type: 'category', data: ramos }],
        series,
      };
    }
    if (by === 'agente') {
      const agentes = [...new Set(data.map((item) => item.agente))];
      const series = status.map((stat) => ({
        ...serieStatic,
        name: stat,
        data: Array.from(agentes, (v, i) => i * 0),
      }));
      for (const dat of data) {
        const iA = agentes.findIndex((a) => a === dat.agente);
        if (iA !== -1) {
          series[0]['data'][iA] += Number(dat.polizas_nuevas);
          series[1]['data'][iA] += Number(dat.polizas_renovadas);
          series[2]['data'][iA] += Number(dat.polizas_canceladas);
          series[3]['data'][iA] += Number(dat.renovaciones);
        }
      }
      option = {
        ...option,
        xAxis: [{ type: 'category', data: agentes }],
        series,
      };
    }
    if (by === 'vendedor') {
      const vendedores = [...new Set(data.map((item) => item.vendedor))];
      const series = status.map((stat) => ({
        ...serieStatic,
        name: stat,
        data: Array.from(vendedores, (v, i) => i * 0),
      }));
      for (const dat of data) {
        const iV = vendedores.findIndex((a) => a === dat.vendedor);
        if (iV !== -1) {
          series[0]['data'][iV] += Number(dat.polizas_nuevas);
          series[1]['data'][iV] += Number(dat.polizas_renovadas);
          series[2]['data'][iV] += Number(dat.polizas_canceladas);
          series[3]['data'][iV] += Number(dat.renovaciones);
        }
      }
      option = {
        ...option,
        xAxis: [{ type: 'category', data: vendedores }],
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
        console.log(resp);
        getBarChart(resp.data);
        // fillTablePolizastatus(
        //   resp,
        //   formDataFechas,
        //   pageNumber,
        //   length,
        //   formMultiple
        // );
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
