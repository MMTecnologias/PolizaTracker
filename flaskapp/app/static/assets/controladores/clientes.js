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

  function resetForm() {
    $('#cliente-form')[0].reset();
    $('#sexo').html(`
      <option value="Mujer">Mujer</option>
      <option value="Hombre">Hombre</option>
      <option value="Empresa">Empresa</option>
    `);
    $('#cliente-form').removeClass('was-validated');
    $('#cliente-form input').prop('disabled', false);
    $('#cliente-form select').prop('disabled', false);
    $('#cliente_id').val('New');
    $('#nuevo_grupo_div').hide();
  }

  function editClient(id) {
    const clientsPerPage = 5;
    $.ajax({
      ...ajaxConfig,
      url: '/clientes/get',
      data: $.param({ start: 0, length: clientsPerPage, cliente_id: id }),
      success: function (resp) {
        $('#cliente_id').val(resp.data[0].id);
        $('#nombre').val(resp.data[0].nombre);
        $('#apellido').val(resp.data[0].apellido);
        $('#rfc').val(resp.data[0].rfc);
        $('#telefono_oficina').val(resp.data[0].tel_oficina);
        $('#telefono_movil').val(resp.data[0].tel_movil);
        $('#telefono_casa').val(resp.data[0].tel_casa);
        $('#correo').val(resp.data[0].correo);
        $('#direccion_fiscal').val(resp.data[0].direccion);
        $('#fecha_nacimiento').val(resp.data[0].fecha_nacimiento);
        $('#sexo').html(`
          <option value="Mujer" ${
            resp.data[0].sexo === 'Mujer' ? 'selected' : ''
          }>Mujer</option>
          <option value="Hombre" ${
            resp.data[0].sexo === 'Hombre' ? 'selected' : ''
          }>Hombre</option>
          <option value="Empresa" ${
            resp.data[0].sexo === 'Empresa' ? 'selected' : ''
          }>Empresa</option>
          <option value="Indefinido" ${
            resp.data[0].sexo === 'Indefinido' ? 'selected' : ''
          }>Indefinido</option>
        `);
        $('#ocupacion').val(resp.data[0].ocupacion);
        $('#giro_actividad').val(resp.data[0].actividad);
        $('#grupo').html(`<option value='${resp.data[0].grupo_id}'> ${
          resp.data[0].grupo
        }</option>
         ${fetch('/grupo')
           .then((response) => response.json())
           .then((data) => {
             data.forEach((grupo) => {
               document.querySelector('#grupo').innerHTML += `
               <option value='${grupo.id}'>${grupo.nombre}</option>
               `;
             });
           })}
         `);
        $('#cuenta').val(resp.data[0].cuenta);
      },
      error: (xhr, status, error) => console.error(error),
    });
  }

  async function deleteClient(client_id, nombre) {
    const { isConfirmed } = await alertConfirm(
      `¿Esta seguro de eliminar este cliente ${nombre}?`
    );
    if (!isConfirmed) return;
    $.ajax({
      ...ajaxConfig,
      url: '/clientes/delete',

      data: $.param({ client_id }),
      success: function (resp) {
        if (!resp.error) {
          alert(resp.msg, undefined, resp.title);
        } else {
          alert(resp.msg, 'error');
        }
      },
      error: function (xhr, status, error) {
        console.log(error);
        alert(
          'Lamentamos el inconveniente, por favor vuelve a intentarlo',
          'error'
        );
      },
    });
  }

  function fillTable(resp, currentPage, itemsOnPage) {
    const { data, recordsTotal } = resp;
    const table = $('#table-clientes');
    table.html('');
    $.each(data, function (idx, client) {
      table.append(
        `<tr class="tableOption">
            <td>${client.fullname}</td>
            <td>${client.correo}</td>
            <td>${client.tel_movil}</td>
            <td>
               <ul class="btn_table_options">
                  <li>
                     <a class="btn__icon_delete pointer" id="btnDelete_${client.id}">
                        <svg class="noClickable" xmlns="http://www.w3.org/2000/svg" height="21" viewBox="0 -960 960 960" width="21" class="btn_icon"><path d="M292.309-140.001q-29.923 0-51.115-21.193-21.193-21.192-21.193-51.115V-720h-40v-59.999H360v-35.384h240v35.384h179.999V-720h-40v507.691q0 30.308-21 51.308t-51.308 21H292.309ZM680-720H280v507.691q0 5.385 3.462 8.847 3.462 3.462 8.847 3.462h375.382q4.616 0 8.463-3.846 3.846-3.847 3.846-8.463V-720ZM376.155-280h59.999v-360h-59.999v360Zm147.691 0h59.999v-360h-59.999v360ZM280-720v520-520Z"/></svg>
                     </a>
                  </li>
                  <li>
                     <a class="btn__icon_edit pointer" id="btnEdit_${client.id}">
                        <svg class="noClickable" xmlns="http://www.w3.org/2000/svg" height="21" viewBox="0 -960 960 960" width="21" class="btn_icon"><path d="M200-200h50.461l409.463-409.463-50.461-50.461L200-250.461V-200Zm-59.999 59.999v-135.383l527.616-527.384q9.073-8.241 20.036-12.736 10.963-4.495 22.993-4.495 12.029 0 23.307 4.27 11.277 4.269 19.969 13.576l48.846 49.461q9.308 8.692 13.269 20.004 3.962 11.311 3.962 22.622 0 12.065-4.121 23.028-4.12 10.964-13.11 20.037l-527.384 527H140.001Zm620.384-570.153-50.231-50.231 50.231 50.231Zm-126.134 75.903-24.788-25.673 50.461 50.461-25.673-24.788Z"/></svg>
                     </a>
                  </li>
               </ul>
            </td>
         </tr>`
      );
      $(`#btnEdit_${client.id}`).on('click', (e) => editClient(client.id));
      $(`#btnDelete_${client.id}`).on('click', (e) =>
        deleteClient(client.id, client.fullname)
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
        getPolizas(pageNumber, start);
      },
    });
  }

  function getClients(pageNumber = 1, start = 0) {
    const length = 10;
    $.ajax({
      ...ajaxConfig,
      url: '/clientes/get',
      data: $.param({ start, length, order: true }),
      success: (resp) => fillTable(resp, pageNumber, length),
      error: (xhr, status, error) => console.error(error),
    });
  }

  $('#cliente-form').submit(function (e) {
    e.preventDefault();
    var formData = $(this).serialize();
    if (!this.checkValidity()) {
      $(this).addClass('was-validated');
      return;
    }
    $.ajax({
      type: 'POST',
      url: '/clientes/create',
      data: formData,
      success: function (resp) {
        if (resp.error) {
          alert(resp.msg, 'error', 'Cliente incorrecto');
        } else {
          alert(resp.msg, 'success', resp.title);
          if (resp.add_group_opt) {
            var option = $(
              '<option value="' +
                resp.new_group_id +
                '">' +
                resp.new_group_name +
                '</option>'
            );
            $('#grupo').find('option[value="New"]').before(option);
          }
          getClients();
        }
        resetForm();
      },
      error: function (xhr, status, error) {
        resetForm();
        alert(
          'Lamentamos el inconveniente, porfavor vuelve a intentarlo',
          'error',
          'Error inesperado'
        );
      },
    });
  });

  $('#grupo').change(function () {
    var selectedOption = $(this).val();
    if (selectedOption === 'New') {
      $('#nuevo_grupo_div').show();
      $('#nuevo_grupo').prop('required', true);
    } else {
      $('#nuevo_grupo_div').hide();
      $('#nuevo_grupo').prop('required', false);
    }
  });

  $('#searchClient').on('keyup', function (e) {
    e.preventDefault();
    const searchValue = e.target.value;
    if (searchValue == '') return getClients();
    if (searchValue.length >= 3)
      $.ajax({
        ...ajaxConfig,
        url: '/clientes/get',
        data: $.param({ start: 0, length: 0, searchValue }),
        success: (resp) => fillTable(resp, 1, 10),
        error: (xhr, status, error) => console.error(error),
      });
  });

  // $('#sortByName').click((e) => {
  //   e.preventDefault();
  //   ordered = !ordered;
  //   getClients(ordered);
  // });

  $('#Resetbtn').click(function () {
    resetForm();
  });

  getClients();
});
