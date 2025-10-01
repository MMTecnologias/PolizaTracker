$(function () {
  let razonInput = '';
  let totalPolizas = 0;

  const ajaxConfig = {
    url: '',
    type: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    dataType: 'json',
  };

  function getBackColor(status) {
    if (!status) return '';
    switch (status) {
      case 'Cancelada':
        return '#ee0e0e';
      case 'Finalizada':
        return '#565656';
      default:
        return '';
    }
  }

  function getTextColor(status) {
    if (!status) return '';
    switch (status) {
      case 'Cancelada':
        return '#ffffff';
      case 'Finalizada':
        return '#ffffff';
      default:
        return '';
    }
  }

  function alert(text = '', icon = 'success', title = '') {
    Swal.fire({ title, text, icon });
  }

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

  function alertConfirm(text = '') {
    return Swal.fire({
      title: '',
      text,
      showCancelButton: true,
      allowOutsideClick: false,
      confirmButtonText: 'Aceptar',
      cancelButtonText: 'Cancelar',
      icon: 'warning',
    });
  }

  function alertInput(title = '') {
    return Swal.fire({
      title,
      html: `<input type="text" id="razon" class="swal2-input" placeholder="Razon">`,
      confirmButtonText: 'Aceptar',
      focusConfirm: false,
      cancelButtonText: 'Cancelar',
      showCancelButton: true,
      allowOutsideClick: false,
      icon: 'warning',
      didOpen: () => {
        const popup = Swal.getPopup();
        razonInput = popup.querySelector('#razon');
        razonInput.onkeyup = (event) =>
          event.key === 'Enter' && Swal.clickConfirm();
      },
      preConfirm: () => {
        const razon = razonInput.value;
        if (!razon) {
          Swal.showValidationMessage(
            `Por favor ingrese una razon para cancelar`
          );
        }
        return { razon };
      },
    });
  }

  async function resetForm() {
    try {
      $('#form-polizas')[0].reset();
      $('#btnGuardar').show();
      $('#reset-btn').show();
      $('#form-polizas').removeClass('was-validated');
      $('#form-polizas select').prop('disabled', false);
      $('#poliza_id').val('New');
      $('#tipo').val('');
      $('#div_poliza_id').hide();
      $('#div_search_client').show();
      $('#title_poliza').text('Póliza');
      $('#prima_neta').prop('disabled', false);
      $('#prima_total').prop('disabled', false);
      $('#ramo').html('');
      $('#subramo').html('');
      $('#aseguradora').html('');
      $('#Pago').html('');
      $('#vendedor').html('');
      $('#agente').html('');
      $('#btnGuardar').html('Guardar');
      $('#div_poliza_anterior').hide();
      $('#nuevo_ramo_subramo_div').hide();
      $('#nuevo_aseguradora_div').hide();
      $('#nuevo_vendedor_div').hide();
      $('#nuevo_agente_div').hide();
      $('#only_show_poliza').hide();
      const data = await getFormData();
      for (const ramo of data.Ramo) {
        $('#ramo').append(`<option value='${ramo.id}'>
        ${ramo.ramo}
        </option>
        `);
      }
      $('#ramo').append(`<option value="New">Nuevo Ramo</option>`);
      for (const subramo of data.Subramo) {
        $('#subramo').append(`<option value='${subramo.id}'>
          ${subramo.subramo}
          </option>
          `);
      }
      $('#subramo').append(`<option value="New">Nuevo Subramo</option>`);
      for (const aseguradora of data.Aseguradora) {
        $('#aseguradora').append(`<option value='${aseguradora.id}'>
        ${aseguradora.aseguradora}
        </option>
        `);
      }
      $('#aseguradora').append(
        `<option value="New">Nueva Aseguradora</option>`
      );
      for (const pago of data.TipoPago) {
        $('#Pago').append(`<option value='${pago.id}'>
        ${pago.tipo_pago}
        </option>
        `);
      }
      for (const vendedor of data.Vendedor) {
        $('#vendedor').append(`<option value='${vendedor.id}'>
        ${vendedor.nombre}
        </option>
        `);
      }
      $('#vendedor').append(`<option value="New">Nuevo Vendedor</option>`);
      for (const agente of data.Agente) {
        $('#agente').append(`<option value='${agente.id}'>
        ${agente.nombre}
        </option>
        `);
      }
      $('#agente').append(`<option value="New">Nuevo Agente</option>`);
      return data;
    } catch (error) {
      console.log(error);
      return null;
    }
  }

  async function createEndozo(poliza_id, tipo) {
    const data = await resetForm();
    $('#endoso-type').modal('toggle');
    $('#tipo').val(tipo);
    $('#btnGuardar').html('Generar endoso');
    $('#poliza_id').val(poliza_id);
    // $('#div_search_client').hide();
    $('#title_poliza').text('Endoso');
    $('#div_poliza_id').show();
    $.ajax({
      ...ajaxConfig,
      url: '/polizas/get',
      data: $.param({ start: 0, length: 0, poliza_id }),
      success: function (resp) {
        $('#id_poliza').val(resp.data[0].poliza);
        $('#VigenciaF').val(resp.data[0].fecha_termino);
        if (tipo === 'B' || tipo === 'D') {
          $('#prima_neta').prop('disabled', false);
          $('#prima_total').prop('disabled', false);
          return;
        }
        $('#serie').val(resp.data[0].serie);
        $('#notas').val(resp.data[0].notas);
        $('#Moneda').val(resp.data[0].moneda);
        $('#prima_neta').val(
          parseFloat(resp.data[0].prima_neta.replace('$', '').replace(',', ''))
        );
        $('#prima_total').val(
          parseFloat(resp.data[0].prima_total.replace('$', '').replace(',', ''))
        );
        $('#prima_neta').prop('disabled', true);
        $('#prima_total').prop('disabled', true);
        $('#ramo').html(`<option value='${resp.data[0].ramo_id}'>
            ${resp.data[0].ramo}
            </option>
        `);
        $('#subramo').html(`<option value='${resp.data[0].subramo_id}'>
            ${resp.data[0].subramo}
            </option>
        `);
        $('#aseguradora').html(`<option value='${resp.data[0].aseguradora_id}'>
            ${resp.data[0].aseguradora}
            </option>
        `);
        $('#Pago').html(`<option value='${resp.data[0].tipo_pago_id}'>
            ${resp.data[0].tipoPago}
            </option>
        `);
        $('#vendedor').html(`<option value='${resp.data[0].vendedor_id}'>
            ${resp.data[0].vendedor}
            </option>
        `);
        $('#agente').html(`<option value='${resp.data[0].agente_id}'>
            ${resp.data[0].agente}
            </option>
        `);
        if (data) {
          for (const ramo of data.Ramo) {
            $('#ramo').append(`<option value='${ramo.id}'>
        ${ramo.ramo}
        </option>
        `);
          }
          $('#ramo').append(`<option value="New">Nuevo Ramo</option>`);
          for (const subramo of data.Subramo) {
            $('#subramo').append(`<option value='${subramo.id}'>
        ${subramo.subramo}
        </option>
        `);
          }
          $('#subramo').append(`<option value="New">Nuevo Subramo</option>`);
          for (const aseguradora of data.Aseguradora) {
            $('#aseguradora').append(`<option value='${aseguradora.id}'>
        ${aseguradora.aseguradora}
        </option>
        `);
          }
          $('#aseguradora').append(
            `<option value="New">Nueva Aseguradora</option>`
          );
          for (const pago of data.TipoPago) {
            $('#Pago').append(`<option value='${pago.id}'>
        ${pago.tipo_pago}
        </option>
        `);
          }
          for (const vendedor of data.Vendedor) {
            $('#vendedor').append(`<option value='${vendedor.id}'>
        ${vendedor.nombre}
        </option>
        `);
          }
          $('#vendedor').append(`<option value="New">Nuevo Vendedor</option>`);
          for (const agente of data.Agente) {
            $('#agente').append(`<option value='${agente.id}'>
        ${agente.nombre}
        </option>
        `);
          }
          $('#agente').append(`<option value="New">Nuevo Agente</option>`);
        }
      },
      error: (xhr, status, error) => console.error(error),
    });
  }

  async function showPoliza(poliza_id) {
    const data = await resetForm();
    $('#btnGuardar').hide();
    $('#poliza_id').val(poliza_id);
    $.ajax({
      ...ajaxConfig,
      url: '/polizas/get',
      data: $.param({ start: 0, length: 0, poliza_id }),
      success: function (resp) {
        resp.data[0].renovacion ||= resp.data[0].poliza;
        $('#only_show_poliza').show();
        $('#buscar-cliente').val(resp.data[0].cliente);
        $('#Poliza').val(resp.data[0].poliza);
        $('#poliza_anterior').val(resp.data[0].poliza_anterior);
        $('#renovacion').val(resp.data[0].renovacion);
        $('#selected-client-id').val(resp.data[0].cliente_id);
        $('#VigenciaI').val(resp.data[0].fecha_inicio);
        $('#VigenciaF').val(resp.data[0].fecha_termino);
        $('#serie').val(resp.data[0].serie);
        $('#notas').val(resp.data[0].notas);
        $('#Moneda').val(resp.data[0].moneda);
        $('#prima_neta').val(
          parseFloat(resp.data[0].prima_neta.replace('$', '').replace(',', ''))
        );
        $('#prima_total').val(
          parseFloat(resp.data[0].prima_total.replace('$', '').replace(',', ''))
        );
        $('#prima_neta').prop('disabled', true);
        $('#prima_total').prop('disabled', true);
        $('#ramo').html(`<option value='${resp.data[0].ramo_id}'>
            ${resp.data[0].ramo}
            </option>
        `);
        $('#subramo').html(`<option value='${resp.data[0].subramo_id}'>
            ${resp.data[0].subramo}
            </option>
        `);
        $('#aseguradora').html(`<option value='${resp.data[0].aseguradora_id}'>
            ${resp.data[0].aseguradora}
            </option>
        `);
        $('#Pago').html(`<option value='${resp.data[0].tipo_pago_id}'>
            ${resp.data[0].tipoPago}
            </option>
        `);
        $('#vendedor').html(`<option value='${resp.data[0].vendedor_id}'>
            ${resp.data[0].vendedor}
            </option>
        `);
        $('#agente').html(`<option value='${resp.data[0].agente_id}'>
            ${resp.data[0].agente}
            </option>
        `);
        if (data) {
          for (const ramo of data.Ramo) {
            $('#ramo').append(`<option value='${ramo.id}'>
        ${ramo.ramo}
        </option>
        `);
          }
          $('#ramo').append(`<option value="New">Nuevo Ramo</option>`);
          for (const subramo of data.Subramo) {
            $('#subramo').append(`<option value='${subramo.id}'>
        ${subramo.subramo}
        </option>
        `);
          }
          $('#subramo').append(`<option value="New">Nuevo Subramo</option>`);
          for (const aseguradora of data.Aseguradora) {
            $('#aseguradora').append(`<option value='${aseguradora.id}'>
        ${aseguradora.aseguradora}
        </option>
        `);
          }
          $('#aseguradora').append(
            `<option value="New">Nueva Aseguradora</option>`
          );
          for (const pago of data.TipoPago) {
            $('#Pago').append(`<option value='${pago.id}'>
        ${pago.tipo_pago}
        </option>
        `);
          }
          for (const vendedor of data.Vendedor) {
            $('#vendedor').append(`<option value='${vendedor.id}'>
        ${vendedor.nombre}
        </option>
        `);
          }
          $('#vendedor').append(`<option value="New">Nuevo Vendedor</option>`);
          for (const agente of data.Agente) {
            $('#agente').append(`<option value='${agente.id}'>
        ${agente.nombre}
        </option>
        `);
          }
          $('#agente').append(`<option value="New">Nuevo Agente</option>`);
        }
      },
      error: (xhr, status, error) => console.error(error),
    });
  }

  async function editPoliza(poliza_id) {
    const data = await resetForm();
    $('#poliza_id').val(poliza_id);
    $.ajax({
      ...ajaxConfig,
      url: '/polizas/get',
      data: $.param({ start: 0, length: 0, poliza_id }),
      success: function (resp) {
        $('#buscar-cliente').val(resp.data[0].cliente);
        $('#Poliza').val(resp.data[0].poliza);
        $('#selected-client-id').val(resp.data[0].cliente_id);
        $('#VigenciaI').val(resp.data[0].fecha_inicio);
        $('#VigenciaF').val(resp.data[0].fecha_termino);
        $('#prima_neta').prop('disabled', false);
        $('#prima_total').prop('disabled', false);
        $('#serie').val(resp.data[0].serie);
        $('#notas').val(resp.data[0].notas);
        $('#Moneda').val(resp.data[0].moneda);
        $('#prima_neta').val(
          parseFloat(resp.data[0].prima_neta.replace('$', '').replace(',', ''))
        );
        $('#prima_total').val(
          parseFloat(resp.data[0].prima_total.replace('$', '').replace(',', ''))
        );
        $('#old_prima_neta').val(
          parseFloat(resp.data[0].prima_neta.replace('$', '').replace(',', ''))
        );
        $('#old_prima_total').val(
          parseFloat(resp.data[0].prima_total.replace('$', '').replace(',', ''))
        );
        $('#old_tipo_pago').val(resp.data[0].tipo_pago_id);
        $('#ramo').html(`<option value='${resp.data[0].ramo_id}'>
            ${resp.data[0].ramo}
            </option>
        `);
        $('#subramo').html(`<option value='${resp.data[0].subramo_id}'>
            ${resp.data[0].subramo}
            </option>
        `);
        $('#aseguradora').html(`<option value='${resp.data[0].aseguradora_id}'>
            ${resp.data[0].aseguradora}
            </option>
        `);
        $('#Pago').html(`<option value='${resp.data[0].tipo_pago_id}'>
            ${resp.data[0].tipoPago}
            </option>
        `);
        $('#vendedor').html(`<option value='${resp.data[0].vendedor_id}'>
            ${resp.data[0].vendedor}
            </option>
        `);
        $('#agente').html(`<option value='${resp.data[0].agente_id}'>
            ${resp.data[0].agente}
            </option>
        `);
        if (data) {
          for (const ramo of data.Ramo) {
            $('#ramo').append(`<option value='${ramo.id}'>
        ${ramo.ramo}
        </option>
        `);
          }
          $('#ramo').append(`<option value="New">Nuevo Ramo</option>`);
          for (const subramo of data.Subramo) {
            $('#subramo').append(`<option value='${subramo.id}'>
        ${subramo.subramo}
        </option>
        `);
          }
          $('#subramo').append(`<option value="New">Nuevo Subramo</option>`);
          for (const aseguradora of data.Aseguradora) {
            $('#aseguradora').append(`<option value='${aseguradora.id}'>
        ${aseguradora.aseguradora}
        </option>
        `);
          }
          $('#aseguradora').append(
            `<option value="New">Nueva Aseguradora</option>`
          );
          for (const pago of data.TipoPago) {
            $('#Pago').append(`<option value='${pago.id}'>
        ${pago.tipo_pago}
        </option>
        `);
          }
          for (const vendedor of data.Vendedor) {
            $('#vendedor').append(`<option value='${vendedor.id}'>
        ${vendedor.nombre}
        </option>
        `);
          }
          $('#vendedor').append(`<option value="New">Nuevo Vendedor</option>`);
          for (const agente of data.Agente) {
            $('#agente').append(`<option value='${agente.id}'>
        ${agente.nombre}
        </option>
        `);
          }
          $('#agente').append(`<option value="New">Nuevo Agente</option>`);
        }
      },
      error: (xhr, status, error) => console.error(error),
    });
  }

  async function renewPoliza(poliza_id) {
    const data = await resetForm();
    $('#btnGuardar').html('Renovar póliza');
    $('#div_poliza_anterior').show();
    $('#title_poliza').text('Renovacion');
    $.ajax({
      ...ajaxConfig,
      url: '/polizas/get',
      data: $.param({ start: 0, length: 0, poliza_id }),
      success: function (resp) {
        const year =
          new Date(`${resp.data[0].fecha_termino}`).getFullYear() + 1;
        const month = new Date(`${resp.data[0].fecha_termino}`).getMonth() + 1;
        const dia = new Date(
          `${resp.data[0].fecha_termino} 23:00:00`
        ).getDate();
        $('#poliza_id').val(poliza_id);
        $('#id_poliza').val(resp.data[0].poliza);
        $('#polizaAnterior').val(resp.data[0].poliza);
        $('#poliza-anterior').val(resp.data[0].poliza).prop('disabled', true);
        $('#buscar-cliente').val(resp.data[0].cliente);
        $('#selected-client-id').val(resp.data[0].cliente_id);
        $('#serie').val(resp.data[0].serie);
        $('#VigenciaI').val(resp.data[0].fecha_termino);
        $('#VigenciaF').val(
          `${year}-${month < 10 ? '0' + String(month) : month}-${
            dia < 10 ? '0' + String(dia) : dia
          }`
        );
        $('#prima_neta').val('');
        $('#prima_total').val('');
        $('#Moneda').val(resp.data[0].moneda);
        $('#notas').val(resp.data[0].notas);
        $('#ramo').html(`<option value='${resp.data[0].ramo_id}'>
            ${resp.data[0].ramo}
            </option>
        `);
        $('#subramo').html(`<option value='${resp.data[0].subramo_id}'>
            ${resp.data[0].subramo}
            </option>
        `);
        $('#aseguradora').html(`<option value='${resp.data[0].aseguradora_id}'>
            ${resp.data[0].aseguradora}
            </option>
        `);
        $('#Pago').html(`<option value='${resp.data[0].tipo_pago_id}'>
            ${resp.data[0].tipoPago}
            </option>
        `);
        $('#vendedor').html(`<option value='${resp.data[0].vendedor_id}'>
            ${resp.data[0].vendedor}
            </option>
        `);
        $('#agente').html(`<option value='${resp.data[0].agente_id}'>
            ${resp.data[0].agente}
            </option>
        `);
        if (data) {
          for (const ramo of data.Ramo) {
            $('#ramo').append(`<option value='${ramo.id}'>
        ${ramo.ramo}
        </option>
        `);
          }
          $('#ramo').append(`<option value="New">Nuevo Ramo</option>`);
          for (const subramo of data.Subramo) {
            $('#subramo').append(`<option value='${subramo.id}'>
        ${subramo.subramo}
        </option>
        `);
          }
          $('#subramo').append(`<option value="New">Nuevo Subramo</option>`);
          for (const aseguradora of data.Aseguradora) {
            $('#aseguradora').append(`<option value='${aseguradora.id}'>
        ${aseguradora.aseguradora}
        </option>
        `);
          }
          $('#aseguradora').append(
            `<option value="New">Nueva Aseguradora</option>`
          );
          for (const pago of data.TipoPago) {
            $('#Pago').append(`<option value='${pago.id}'>
        ${pago.tipo_pago}
        </option>
        `);
          }
          for (const vendedor of data.Vendedor) {
            $('#vendedor').append(`<option value='${vendedor.id}'>
        ${vendedor.nombre}
        </option>
        `);
          }
          $('#vendedor').append(`<option value="New">Nuevo Vendedor</option>`);
          for (const agente of data.Agente) {
            $('#agente').append(`<option value='${agente.id}'>
        ${agente.nombre}
        </option>
        `);
          }
          $('#agente').append(`<option value="New">Nuevo Agente</option>`);
        }
      },
      error: (xhr, status, error) => console.error(error),
    });
  }

  async function cancelPoliza(poliza_id) {
    const { isConfirmed, value } = await alertInput(
      '¿Esta seguro de cancelar esta poliza?'
    );
    if (!isConfirmed) return;
    if (!value.razon)
      return alert('Debe agregar una razón para cancelar', 'error');
    $.ajax({
      ...ajaxConfig,
      url: '/polizas/delete',
      data: $.param({ poliza_id, razon: value.razon }),
      success: function (resp) {
        if (resp.error) {
          alert(resp.msg, 'error', resp.title);
        } else {
          alert(resp.msg, undefined, resp.title);
          getPolizas();
        }
      },
      error: function (xhr, status, error) {
        console.error(error);
        alert(
          'Lamentamos el inconveniente, por favor vuelve a intentarlo',
          'error'
        );
      },
    });
  }

  function changeReciboPagado(recibo_id, accion, poliza_id) {
    $.ajax({
      type: 'POST',
      url: '/polizas/process_receipt',
      data: $.param({ recibo_id, accion }),
      success: function (resp) {
        if (resp.error) {
          alert(resp.msg, 'error', resp.title);
        } else {
          alert(resp.msg, 'success');
          getRecibos(poliza_id);
        }
      },
      error: function (xhr, status, error) {
        console.error(error);
        alert(
          'Lamentamos el inconveniente, porfavor vuelve a intentarlo',
          'error'
        );
      },
    });
  }

  function getFormData() {
    return new Promise((resolve, reject) => {
      $.ajax({
        type: 'GET',
        url: '/polizas/get_form_data',
        data: {},
        success: function (resp) {
          resolve(resp);
          // console.log(resp);
        },
        error: function (xhr, status, error) {
          reject(error);
          console.error(error);
          alert(
            'Lamentamos el inconveniente, porfavor vuelve a intentarlo',
            'error'
          );
        },
      });
    });
  }

  function fillTablePolizas(resp, currentPage, itemsOnPage) {
    const { data, recordsTotal } = resp;
    totalPolizas = recordsTotal;
    const table = $('#polizas-table');
    table.html('');
    $.each(data, function (idx, poliza) {
      table.append(
        `<tr class="tableOption" style="background-color: ${getBackColor(
          poliza.status
        )}">
          <td>
            <p class="td-clickable" id="td-clickable_${
              poliza.id
            }" style="color: ${getTextColor(poliza.status)}">
                ${poliza.poliza}
            </p>
          </td>
          <td style="color: ${getTextColor(poliza.status)}">${
          poliza.cliente
        }</td>
          <td style="color: ${getTextColor(poliza.status)}">${
          poliza.fecha_inicio
        }</td>
          <td style="color: ${getTextColor(poliza.status)}">${
          poliza.fecha_termino
        }</td>
          <td style="color: ${getTextColor(poliza.status)}">${
          poliza.subramo
        }</td>
          <td style="color: ${getTextColor(poliza.status)}">${
          poliza.aseguradora
        }</td>
          <td style="color: ${getTextColor(poliza.status)}">${
          poliza.tipoPago
        }</td>
          <td>
            <ul class="btn_table_options">
              <li>
                <a class="btn__icon_delete pointer" id="btnDelete_${poliza.id}">
                  <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill=${getTextColor(
                    poliza.status
                  )}><path d="M480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q54 0 104-17.5t92-50.5L228-676q-33 42-50.5 92T160-480q0 134 93 227t227 93Zm252-124q33-42 50.5-92T800-480q0-134-93-227t-227-93q-54 0-104 17.5T284-732l448 448Z"/></svg>
                </a>
              </li>
              <li>
                <a class="btn__icon_delete pointer" id="btnAddEndoso_${
                  poliza.id
                }">
                  <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill=${getTextColor(
                    poliza.status
                  )}><path d="M120-320v-80h280v80H120Zm0-160v-80h440v80H120Zm0-160v-80h440v80H120Zm520 480v-160H480v-80h160v-160h80v160h160v80H720v160h-80Z"/></svg>
                </a>
              </li>
              <li>
                <a class="btn__icon_edit pointer" id="btnEdit_${poliza.id}">
                  <svg xmlns="http://www.w3.org/2000/svg" height="21" viewBox="0 -960 960 960" width="21" fill=${getTextColor(
                    poliza.status
                  )}><path d="M200-200h50.461l409.463-409.463-50.461-50.461L200-250.461V-200Zm-59.999 59.999v-135.383l527.616-527.384q9.073-8.241 20.036-12.736 10.963-4.495 22.993-4.495 12.029 0 23.307 4.27 11.277 4.269 19.969 13.576l48.846 49.461q9.308 8.692 13.269 20.004 3.962 11.311 3.962 22.622 0 12.065-4.121 23.028-4.12 10.964-13.11 20.037l-527.384 527H140.001Zm620.384-570.153-50.231-50.231 50.231 50.231Zm-126.134 75.903-24.788-25.673 50.461 50.461-25.673-24.788Z"/></svg>
                </a>
              </li>
              <li>
                <a class="btn__icon_show pointer" id="btnViewEndosos_${
                  poliza.id
                }">
                  <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill=${getTextColor(
                    poliza.status
                  )}><path d="M120-220v-80h80v80h-80Zm0-140v-80h80v80h-80Zm0-140v-80h80v80h-80ZM260-80v-80h80v80h-80Zm100-160q-33 0-56.5-23.5T280-320v-480q0-33 23.5-56.5T360-880h360q33 0 56.5 23.5T800-800v480q0 33-23.5 56.5T720-240H360Zm0-80h360v-480H360v480Zm40 240v-80h80v80h-80Zm-200 0q-33 0-56.5-23.5T120-160h80v80Zm340 0v-80h80q0 33-23.5 56.5T540-80ZM120-640q0-33 23.5-56.5T200-720v80h-80Zm420 80Z"/></svg>
                </a>
              </li>
              <li>
                <a class="btn__icon_show pointer" id="btnShow_${poliza.id}">
                  <svg xmlns="http://www.w3.org/2000/svg" height="21" viewBox="0 -960 960 960" width="21" fill=${getTextColor(
                    poliza.status
                  )}><path d="M480-320q75 0 127.5-52.5T660-500q0-75-52.5-127.5T480-680q-75 0-127.5 52.5T300-500q0 75 52.5 127.5T480-320Zm0-72q-45 0-76.5-31.5T372-500q0-45 31.5-76.5T480-608q45 0 76.5 31.5T588-500q0 45-31.5 76.5T480-392Zm0 192q-146 0-266-81.5T40-500q54-137 174-218.5T480-800q146 0 266 81.5T920-500q-54 137-174 218.5T480-200Zm0-300Zm0 220q113 0 207.5-59.5T832-500q-50-101-144.5-160.5T480-720q-113 0-207.5 59.5T128-500q50 101 144.5 160.5T480-280Z"/></svg>
                </a>
              </li>
              <li>
                <a class="btn__icon_renew pointer" id="btnRenew_${poliza.id}">
                  <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill=${getTextColor(
                    poliza.status
                  )}><path d="M200-80q-33 0-56.5-23.5T120-160v-560q0-33 23.5-56.5T200-800h40v-80h80v80h320v-80h80v80h40q33 0 56.5 23.5T840-720v240h-80v-80H200v400h280v80H200ZM760 0q-73 0-127.5-45.5T564-160h62q13 44 49.5 72T760-60q58 0 99-41t41-99q0-58-41-99t-99-41q-29 0-54 10.5T662-300h58v60H560v-160h60v57q27-26 63-41.5t77-15.5q83 0 141.5 58.5T960-200q0 83-58.5 141.5T760 0ZM200-640h560v-80H200v80Zm0 0v-80 80Z"/></svg>
                </a>
              </li>
            </ul>
          </td>
        </tr>`
      );
      $(`#td-clickable_${poliza.id}`).on('click', (e) => {
        $('#recib').modal();
        getRecibos(poliza.id);
      });
      $(`#btnAddEndoso_${poliza.id}`).on('click', (e) => {
        $('#poliza_id').val(poliza.id);
        $('#endoso-type').modal();
      });
      $(`#btnEdit_${poliza.id}`).on('click', (e) => {
        editPoliza(poliza.id);
        $('#btnGuardar').html('Actualizar póliza');
        $('#title_poliza').text('Editar póliza');
      });
      $(`#btnDelete_${poliza.id}`).on('click', (e) => cancelPoliza(poliza.id));
      $(`#btnRenew_${poliza.id}`).on('click', (e) => renewPoliza(poliza.id));
      $(`#btnViewEndosos_${poliza.id}`).on('click', (e) => {
        getEndosos(poliza.id);
        $('#endoso-list').modal();
      });
      $(`#btnShow_${poliza.id}`).on('click', (e) => showPoliza(poliza.id));
    });
    if (!data.length) return;
    $('#pagination').pagination({
      items: recordsTotal,
      itemsOnPage: itemsOnPage,
      prevText: 'Anterior',
      nextText: 'Siguiente',
      currentPage,
      onPageClick: (pageNumber, e) => {
        const start = (pageNumber - 1) * itemsOnPage;
        getPolizas(pageNumber, start);
      },
    });
  }

  function fillTableRecibos(resp, currentPage, itemsOnPage, poliza_id) {
    const { data, recordsTotal } = resp;

    const table = $('#receiptsTable');
    table.html('');
    $.each(data, function (idx, recibo) {
      table.append(
        `<tr class="tableOption-recibos">
            <td>${recibo.numero}</td>
            <td>${recibo.fecha_recibo}</td>
            <td>${recibo.vencimiento}</td>
            <td>$${formatNumber(Number(recibo.prima_neta || 0))}</td>
            <td>$${formatNumber(Number(recibo.prima_total || 0))}</td>
            <td>${recibo.moneda}</td>
            <td>
                <input type="checkbox" id="check_pagado${
                  recibo.id
                }" name="check_pagado${recibo.id}" />
            </td>
            <td>${recibo.fecha_pago} ${
          recibo.fecha_pago
            ? `<a class="btn__icon_edit pointer" id="btnEdit_${recibo.id}">
                  <svg xmlns="http://www.w3.org/2000/svg" height="21" viewBox="0 -960 960 960" width="21"><path d="M200-200h50.461l409.463-409.463-50.461-50.461L200-250.461V-200Zm-59.999 59.999v-135.383l527.616-527.384q9.073-8.241 20.036-12.736 10.963-4.495 22.993-4.495 12.029 0 23.307 4.27 11.277 4.269 19.969 13.576l48.846 49.461q9.308 8.692 13.269 20.004 3.962 11.311 3.962 22.622 0 12.065-4.121 23.028-4.12 10.964-13.11 20.037l-527.384 527H140.001Zm620.384-570.153-50.231-50.231 50.231 50.231Zm-126.134 75.903-24.788-25.673 50.461 50.461-25.673-24.788Z"/></svg>
                </a>`
            : null
        } </td>
            <td>${recibo.cancelado ? 'Cancelado' : ''}</td>
         </tr>`
      );
      if (recibo.pagado) $(`#check_pagado${recibo.id}`).prop('checked', true);
      $(`#check_pagado${recibo.id}`).on('click', function () {
        if ($(`#check_pagado${recibo.id}`).is(':checked') == true) {
          changeReciboPagado(recibo.id, 'Pagar', poliza_id);
        } else {
          changeReciboPagado(recibo.id, 'Cancelar Pago', poliza_id);
        }
      });
      $(`#btnEdit_${recibo.id}`).on('click', (e) => {
        $('#recibo_id').val(recibo.id);
        $('#poliza_id').val(poliza_id);
        $('#edit_recib_date').modal();
      });
    });
    if (!data.length) return $('#pagination-recibos').html('');
    $('#pagination-recibos').pagination({
      itemsOnPage,
      currentPage,
      items: recordsTotal,
      prevText: 'Anterior',
      nextText: 'Siguiente',
      onPageClick: (pageNumber, e) => {
        const start = (pageNumber - 1) * itemsOnPage;
        getRecibos(poliza_id, null, pageNumber, start);
      },
    });
  }

  function fillTableEndosos(resp, currentPage, itemsOnPage, poliza_id) {
    const { data, recordsTotal } = resp;
    const table = $('#endosos-table');
    table.html('');
    $.each(data, function (idx, endoso) {
      table.append(
        `<tr class="tableOption-endoso" style="background-color: ${getBackColor(
          endoso.status
        )}">
          <td>
            <p class="td-clickable" id="td-clickable-endoso_${
              endoso.id
            }" style="color: ${getTextColor(endoso.status)}">
                ${endoso.endoso}
            </p>
          </td>
          <td style="color: ${getTextColor(endoso.status)}">${
          endoso.tipo_endoso === 'D'
            ? endoso.tipo_endoso
            : endoso.tipo_endoso === 'A'
            ? 'B'
            : 'A'
        }
        </td>
          <td style="color: ${getTextColor(endoso.status)}">${
          endoso.cliente
        }</td>
          <td style="color: ${getTextColor(endoso.status)}">${
          endoso.subramo
        }</td>
          <td style="color: ${getTextColor(endoso.status)}">${
          endoso.aseguradora
        }</td>
          <td style="color: ${getTextColor(endoso.status)}">${
          endoso.tipoPago
        }</td>
          <td style="color: ${getTextColor(endoso.status)}">
            <ul class="btn_table_options">
            </ul>
          </td>
        </tr>`
      );
      $(`#td-clickable-endoso_${endoso.id}`).on('click', (e) => {
        getRecibos(null, endoso.id);
      });
    });
    $('#pagination-endosos').pagination({
      itemsOnPage,
      currentPage,
      items: recordsTotal,
      prevText: 'Anterior',
      nextText: 'Siguiente',
      onPageClick: (pageNumber, e) => {
        const start = (pageNumber - 1) * itemsOnPage;
        getEndosos(poliza_id, pageNumber, start);
      },
    });
  }

  function fillTableRecibosEndosos(resp, currentPage, itemsOnPage, endoso_id) {
    const { data, recordsTotal } = resp;

    const table = $('#receiptsEndosoTable');
    table.html('');
    $.each(data, function (idx, recibo) {
      table.append(
        `<tr class="tableOption-recibos-endosos">
            <td>${recibo.numero}</td>
            <td>${recibo.fecha_recibo}</td>
            <td>${recibo.vencimiento}</td>
            <td>${recibo.prima_neta}</td>
            <td>${recibo.prima_total}</td>
            <td>${recibo.moneda}</td>
            <td>
                <input type="checkbox" id="check_pagado${
                  recibo.id
                }" name="check_pagado${recibo.id}" />
            </td>
            <td>${recibo.fecha_pago}</td>
            <td>${recibo.cancelado ? 'Cancelado' : ''}</td>
         </tr>`
      );
      if (recibo.pagado) $(`#check_pagado${recibo.id}`).prop('checked', true);
      $(`#check_pagado${recibo.id}`).on('click', function () {
        if ($(`#check_pagado${recibo.id}`).is(':checked') == true) {
          changeReciboPagado(recibo.id, 'Pagar', endoso_id);
        } else {
          changeReciboPagado(recibo.id, 'Cancelar Pago', endoso_id);
        }
      });
    });
    if (!data.length) return $('#pagination-recibos-endosos').html('');
    $('#pagination-recibos-endosos').pagination({
      itemsOnPage,
      currentPage,
      items: recordsTotal,
      prevText: 'Anterior',
      nextText: 'Siguiente',
      onPageClick: (pageNumber, e) => {
        const start = (pageNumber - 1) * itemsOnPage;
        getRecibos(null, endoso_id, pageNumber, start);
      },
    });
  }

  function getPolizas(pageNumber = 1, start = 0) {
    const length = 10;
    const searchValue = $('#searchPoliza').val();
    $.ajax({
      ...ajaxConfig,
      url: '/polizas/get',
      data: $.param({ start, length, order: true, searchValue }),
      success: (resp) => fillTablePolizas(resp, pageNumber, length),
      error: (xhr, status, error) => console.error(error),
    });
  }

  function getEndosos(poliza_id, pageNumber = 1, start = 0) {
    const length = 10;
    $.ajax({
      ...ajaxConfig,
      url: '/polizas/get_endosos',
      data: $.param({ start, length, order: true, poliza_id }),
      success: (resp) => fillTableEndosos(resp, pageNumber, length, poliza_id),
      error: (xhr, status, error) => console.error(error),
    });
  }

  function getRecibos(poliza_id, endoso_id, pageNumber = 1, start = 0) {
    const length = 10;
    let sendObj;
    if (poliza_id && !endoso_id) {
      sendObj = { start, length, order: true, poliza_id };
    }
    if (endoso_id && !poliza_id) {
      sendObj = { start, length, order: true, endoso_id };
    }
    $.ajax({
      ...ajaxConfig,
      url: '/polizas/get_receipts',
      data: $.param(sendObj),
      success: (resp) =>
        endoso_id
          ? fillTableRecibosEndosos(resp, pageNumber, length, endoso_id)
          : fillTableRecibos(resp, pageNumber, length, poliza_id),
      error: (xhr, status, error) => console.error(error),
    });
  }

  function fetchClientOptions(query) {
    $.ajax({
      url: 'polizas/search_clients',
      method: 'POST',
      dataType: 'json',
      data: { query },
      success: function (response) {
        const options = response.options;
        const dropdownMenu = $('#client-options');
        dropdownMenu.empty();
        if (options.length === 0) {
          dropdownMenu.append(
            '<p class="dropdown-item no-results">No hay coincidencias</p>'
          );
        } else {
          $.each(options, function (i, option) {
            dropdownMenu.append(
              `<a class="dropdown-item" id="client__${option.id}">
                ${option.name}
              </a>`
            );
            $(`#client__${option.id}`).on('click', (e) => {
              $('#buscar-cliente').val(option.name);
              $('#selected-client-id').val(option.id);
              $('#client-options').hide();
              $('#buscar-cliente')[0].setCustomValidity('');
            });
          });
        }
        dropdownMenu.show();
      },
      error: function (xhr, textStatus, error) {
        console.error(error);
        alert(
          'Lamentamos el inconveniente, por favor vuelve a intentarlo',
          'error'
        );
      },
    });
  }

  function createReceipts(selectPoliza, endoso_id = '') {
    const netPremium = $('#prima-neta').val();
    const totalPremium = $('#prima-total').val();
    const iva = $('#iva').val();
    const insurance = $('#derecho_poliza').val();
    const commission = $('#comision').val();
    const receipts = $('#nopagos').val();
    const rec_pago = $('#rec_pago').val();
    const sendObj = {
      netPremium,
      totalPremium,
      iva,
      insurance,
      commission,
      receipts,
      selectPoliza,
      rec_pago,
    };
    if (endoso_id) sendObj.endoso_id = endoso_id;
    $.ajax({
      ...ajaxConfig,
      url: '/polizas/save_receipts',
      data: $.param(sendObj),
      success: function (resp) {
        if (resp.error) {
          // alert(resp.msg, "error", resp.title);
          console.log('Error crear recibos', resp.error, resp.msg);
        } else {
          // alert(resp.msg, "success", resp.title);
          console.log('Recibos creados exitosamente');
        }
      },
      error: function (xhr, status, error) {
        console.error('Error crear recibos', error);
        alert(
          `Ocurrio un error al crear los recibos ${error}`,
          'error',
          'Error al crear recibos'
        );
      },
    });
  }

  $('#form-polizas').submit(async function (e) {
    e.preventDefault();
    if (!this.checkValidity()) {
      $(this).addClass('was-validated');
      return;
    }
    const prima_neta = $('#prima_neta').val();
    const old_prima_neta = $('#old_prima_neta').val();
    const prima_total = $('#prima_total').val();
    const old_prima_total = $('#old_prima_total').val();
    const fecha_inicio = $('#VigenciaI').val();
    const fecha_termino = $('#VigenciaF').val();
    const tipo_pago_id = $('#Pago').val();
    const old_tipo_pago = $('#old_tipo_pago').val();
    let params = $.param({
      prima_neta,
      prima_total,
      fecha_inicio,
      fecha_termino,
      tipo_pago_id,
    });
    console.log($('#title_poliza')?.text());
    if ($('#title_poliza')?.text()?.includes('Editar')) {
      const poliza_id = $('#poliza_id').val();
      if (
        prima_neta !== old_prima_neta ||
        prima_total !== old_prima_total ||
        tipo_pago_id !== old_tipo_pago
      ) {
        const resp = await alertConfirm(
          '¿vamos a eliminar los recibos para generarlos nuevamente, estás seguro de continuar?'
        );
        if (!resp.isConfirmed) return;
        $.ajax({
          url: 'polizas/check_delete_receipts',
          method: 'POST',
          dataType: 'json',
          data: `poliza_id=${poliza_id}`,
          success: function (resp) {
            console.log(resp);
            if (resp.error) {
              alert(resp.msg, 'error', resp.title);
            } else {
              const new_params = `${params}&poliza_id=${poliza_id}`;
              $.ajax({
                url: 'polizas/get_policy_values',
                method: 'POST',
                dataType: 'json',
                data: new_params,
                success: function (resp) {
                  if (resp.error) {
                    alert(resp.msg, 'error', resp.title);
                    $('#create-recib').modal('hide');
                  } else {
                    if (resp.msg && resp.msg.includes('no coincidiran')) {
                      $('#alert_Modal').show();
                      $('#alert_Modal').text(resp.msg);
                    }
                    $('#prima-neta').val(resp.netPremium);
                    $('#prima-total').val(resp.totalPremium);
                    $('#nopagos').val(resp.numReceipts);
                    $('#iva').val(16);
                    $('#create-recib').modal({
                      backdrop: 'static',
                      keyboard: false,
                    });
                    $('#receipts_created').val('no');
                  }
                },
                error: function (xhr, textStatus, error) {
                  console.error(error);
                },
              });
            }
          },
          error: function (xhr, textStatus, error) {
            console.error(error);
          },
        });
      } else {
        let newParams = $('#form-polizas').serialize();
        newParams = `${newParams}&poliza_id=${poliza_id}`;
        $.ajax({
          url: 'polizas/edit',
          method: 'POST',
          dataType: 'json',
          data: newParams,
          success: function (resp) {
            console.log(resp);
            if (resp.error) {
              alert(resp.msg, 'error', resp.title);
            } else {
              alert(resp.msg);
            }
          },
          error: function (xhr, textStatus, error) {
            console.error(error);
          },
        });
      }
    } else {
      if ($('#title_poliza')?.text()?.includes('Endoso')) {
        const poliza_id = $('#poliza_id').val();
        params = `${params}&poliza_id=${poliza_id}&is_endoso=true`;
      }
      $.ajax({
        url: 'polizas/get_policy_values',
        method: 'POST',
        dataType: 'json',
        data: params,
        success: function (resp) {
          if (resp.error) {
            alert(resp.msg, 'error', resp.title);
            $('#create-recib').modal('hide');
          } else {
            if (resp.msg && resp.msg.includes('no coincidiran')) {
              $('#alert_Modal').show();
              $('#alert_Modal').text(resp.msg);
            }
            $('#prima-neta').val(resp.netPremium);
            $('#prima-total').val(resp.totalPremium);
            $('#nopagos').val(resp.numReceipts);
            $('#iva').val(16);
            $('#create-recib').modal({ backdrop: 'static', keyboard: false });
            $('#receipts_created').val('no');
          }
        },
        error: function (xhr, textStatus, error) {
          console.error(error);
        },
      });
    }
  });

  $('#form_date_recib').submit(function (e) {
    e.preventDefault();
    if (!this.checkValidity()) {
      $(this).addClass('was-validated');
      return;
    }
    const formDataRecib = $('#form_date_recib').serialize();
    $.ajax({
      type: 'POST',
      url: '/polizas/process_receipt',
      data:
        formDataRecib +
        '&accion=Modificar Fecha de Pago' +
        '&recibo_id=' +
        $('#recibo_id').val(),
      success: function (resp) {
        if (resp.error) {
          alert(resp.msg, 'error', resp.title);
        } else {
          $('#edit_recib_date').modal('toggle');
          alert(resp.msg, 'success');
          getRecibos($('#poliza_id').val());
          $('#recibo_id').val('');
          $('#poliza_id').val('');
        }
      },
      error: function (xhr, status, error) {
        console.error('Error en process_receipt', error);
      },
    });
  });

  $('#form-recibo').submit(function (e) {
    e.preventDefault();
    if (!this.checkValidity()) {
      $(this).addClass('was-validated');
      return;
    }
    const formDataPoliza = $('#form-polizas').serialize();
    if ($('#tipo').val()) {
      $.ajax({
        type: 'POST',
        url: '/polizas/create_endoso',
        data: formDataPoliza,
        success: function (resp) {
          if (resp.error) {
            alert(resp.msg, 'error', resp.title);
          } else {
            $('#create-recib').modal('toggle');
            $('#receipts_created').val('si');
            createReceipts(null, resp.endoso_id);
            alert(resp.msg, 'success');
            getPolizas();
            resetForm();
          }
        },
        error: function (xhr, status, error) {
          console.error('Error en create_endoso', error);
        },
      });
    } else if ($('#title_poliza')?.text()?.includes('Editar')) {
      let newParams = $('#form-polizas').serialize();
      newParams = `${newParams}&poliza_id=${poliza_id}`;
      $.ajax({
        url: 'polizas/edit',
        method: 'POST',
        dataType: 'json',
        data: newParams,
        success: function (resp) {
          if (resp.error) {
            alert(resp.msg, 'error', resp.title);
          } else {
            $('#create-recib').modal('toggle');
            $('#receipts_created').val('si');
            createReceipts(resp.poliza_id);
            alert(resp.msg, 'success');
            getPolizas();
            resetForm();
          }
        },
        error: function (xhr, textStatus, error) {
          console.error('Error al editar poliza /edit', error);
        },
      });
    } else {
      $('#poliza_id').val('New');
      const newParams = $('#form-polizas').serialize();
      $.ajax({
        type: 'POST',
        url: '/polizas/create',
        data: newParams,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        dataType: 'json',
        success: function (resp) {
          if (resp.error) {
            alert(resp.msg, 'error', resp.title);
          } else {
            $('#create-recib').modal('toggle');
            $('#receipts_created').val('si');
            createReceipts(resp.poliza_id);
            alert(resp.title, 'success');
            getPolizas();
            resetForm();
          }
        },
        error: function (xhr, status, error) {
          console.error('Error al crear poliza /create', error);
        },
      });
    }
  });

  $('#reset-btn').click((e) => {
    e.preventDefault();
    resetForm();
  });

  $('#closeModalCreateRecibos').click(async (e) => {
    e.preventDefault();
    try {
      const resp = await alertConfirm(
        '¿Esta seguro de que desea salir?, no se crearan la poliza y/o recibos'
      );
      if (!resp.isConfirmed) return;
      $('#create-recib').modal('toggle');
    } catch (error) {
      console.log(error);
    }
  });

  $('#btnCalcular').click((e) => {
    e.preventDefault();
    const netPremium = $('#prima-neta').val();
    const totalPremium = $('#prima-total').val();
    const iva = $('#iva').val();
    const insurance = $('#derecho_poliza').val();
    const commission = $('#comision').val();
    const receipts = $('#nopagos').val();
    const rec_pago = $('#rec_pago').val();
    if (!iva || !insurance || !commission)
      return alert(
        'debe llenar los campos, derecho de póliza, iva y comisión',
        'warning'
      );
    $.ajax({
      ...ajaxConfig,
      url: '/polizas/calculate_receipts',
      data: $.param({
        netPremium,
        totalPremium,
        iva,
        insurance,
        commission,
        receipts,
        rec_pago,
      }),
      success: function (resp) {
        $('#prima_neta_1er').val(resp.firstpay.netPremium);
        $('#prima_neta_subs').val(resp.subspay.netPremium);
        $('#prima_total_1er').val(resp.firstpay.totalPremium);
        $('#prima_total_subs').val(resp.subspay.totalPremium);
        $('#comision_1er').val(resp.firstpay.comision);
        $('#comision_subs').val(resp.subspay.comision);
      },
      error: (xhr, status, error) => console.error(error),
    });
  });

  $('#searchPoliza').on('keyup', function (e) {
    e.preventDefault();
    const searchValue = e.target.value;
    if (searchValue == '') return getPolizas();
    $.ajax({
      ...ajaxConfig,
      url: '/polizas/get',
      data: $.param({ start: 0, length: 10, searchValue, order: true }),
      success: (resp) => fillTablePolizas(resp, 1, 10),
      error: (xhr, status, error) => console.error(error),
    });
  });

  $('#buscar-cliente').on('keyup', function (e) {
    e.preventDefault();
    const inputValue = e.target.value;
    if (inputValue.length >= 3) {
      fetchClientOptions(inputValue);
    } else {
      $('#client-options').hide();
      $('#buscar-cliente')[0].setCustomValidity('');
    }
  });

  $('#ramo').on('change', function (e) {
    if (this.value === 'New') {
      $('#nuevo_ramo_subramo_div').show();
    }
  });

  $('#subramo').on('change', function (e) {
    if (this.value === 'New') {
      $('#nuevo_ramo_subramo_div').show();
    }
  });

  $('#aseguradora').on('change', function (e) {
    if (this.value === 'New') {
      $('#nuevo_aseguradora_div').show();
    }
  });

  $('#vendedor').on('change', function (e) {
    if (this.value === 'New') {
      $('#nuevo_vendedor_div').show();
    }
  });

  $('#agente').on('change', function (e) {
    if (this.value === 'New') {
      $('#nuevo_agente_div').show();
    }
  });

  $('#btnExportar').click((e) => {
    e.preventDefault();
    let params = $.param({
      start: 0,
      length: totalPolizas,
      export_csv: true,
      searchValue: $('#searchPoliza').val(),
    });
    $.ajax({
      type: 'POST',
      url: '/polizas/get',
      data: params,
      xhrFields: {
        responseType: 'blob',
      },
      success: function (blob, status, xhr) {
        let a = document.createElement('a');
        let url = window.URL.createObjectURL(blob);
        a.href = url;
        a.download = `polizas_${new Date().toLocaleDateString()}.csv`;
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
    let params = $.param({
      export_pdf: true,
      searchValue: $('#searchPoliza').val(),
      start: 0,
      length: totalPolizas,
    });
    const formMultiple = $('#form-multiple').serialize();
    params = `${params}&${formMultiple}`;
    $.ajax({
      type: 'POST',
      url: '/polizas/get',
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

  $('#endoso_tipo_a').click((e) => createEndozo($('#poliza_id').val(), 'B'));
  $('#endoso_tipo_b').click((e) => createEndozo($('#poliza_id').val(), 'A'));
  $('#endoso_tipo_d').click((e) => createEndozo($('#poliza_id').val(), 'D'));

  $('#div_poliza_id').hide();
  $('#only_show_poliza').hide();
  $('#div_poliza_anterior').hide();
  $('#nuevo_ramo_subramo_div').hide();
  $('#nuevo_aseguradora_div').hide();
  $('#nuevo_vendedor_div').hide();
  $('#nuevo_agente_div').hide();

  getPolizas();
});
