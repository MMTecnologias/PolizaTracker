$(function () {
  function getBarChart(data, tipo = 'month') {
    if (!data.length) return;
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
    const years = data
      .map((item) => String(item.year))
      .reduce((acc, cur) => {
        if (!acc.includes(cur)) acc.push(cur);
        return acc;
      }, []);
    if (tipo === 'month') {
      series = years.map((item) => ({ type: 'bar' }));
      for (const dat of data) {
        if (!dat.month) continue;
        const i = years.findIndex((year) => year == String(dat.year));
        if (i !== -1) {
          mesesMatrix[dat.month - 1][i + 1] = dat.total_prima_neta_pagada;
        }
      }
      source = [['Mes', ...years], ...mesesMatrix];
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
      option = {
        tooltip: {
          trigger: 'axis',
          axisPointer: {
            type: 'shadow',
          },
        },
        xAxis: {
          type: 'category',
          data: years,
        },
        yAxis: {
          type: 'value',
        },
        series: [
          {
            data: data.map((item) => String(item.total_prima_neta_pagada)),
            type: 'bar',
          },
        ],
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

  function alert(text = '', icon = 'success', title = '') {
    Swal.fire({ title, text, icon });
  }

  function fillTablePrimaNeta(
    resp,
    formDataFechas,
    currentPage,
    itemsOnPage,
    formMultiple
  ) {
    const { data, recordsTotal } = resp;
    const table = $('#table-primaneta');
    table.html('');
    $.each(data, function (idx, poliza) {
      table.append(
        `<tr class="tableOption">
          <td>${poliza.year}</td>
          <td>${poliza.month ? poliza.month : ''}</td>
          <td>${poliza.total_prima_neta_pagada}</td>
        </tr>`
      );
    });
    $('#pagination-primaneta').pagination({
      items: recordsTotal,
      prevText: 'Anterior',
      nextText: 'Siguiente',
      itemsOnPage,
      currentPage,
      onPageClick: (pageNumber, e) => {
        const start = (pageNumber - 1) * itemsOnPage;
        getPrimaNeta(formDataFechas, pageNumber, start, formMultiple);
      },
    });
  }

  function getPrimaNeta(
    formDataFechas = null,
    pageNumber = 1,
    start = 0,
    formMultiple = null
  ) {
    const length = 10;
    let params = $.param({ start, length });
    if (formMultiple) {
      params = formMultiple + '&' + params;
    }
    console.log(params);
    $.ajax({
      ...ajaxConfig,
      url: '/reportes/prima_neta',
      data: formDataFechas ? formDataFechas + '&' + params : params,
      success: (resp) => {
        if (formMultiple && formMultiple.includes('year')) {
          getBarChart(resp.data, 'year');
        } else {
          getBarChart(resp.data);
        }
        console.log(resp);
        fillTablePrimaNeta(
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

  $('#form-fechas').submit(function (e) {
    e.preventDefault();
    if (!this.checkValidity())
      return alert('Debes llenar los dos campos de fecha', 'warning');
    const formDataFechas = $('#form-fechas').serialize();
    getPrimaNeta(formDataFechas);
  });

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
    getPrimaNeta(null, 1, 0, multiple);
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
      url: '/reportes/prima_neta',
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
      url: '/reportes/prima_neta',
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
  getPrimaNeta();
});
