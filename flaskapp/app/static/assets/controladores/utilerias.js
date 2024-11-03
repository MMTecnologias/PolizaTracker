$(function () {
  let title = 'Nuevo(a) Aseguradora';

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
    $('#utileriasForm')[0].reset();
    $('#utileriasForm').removeClass('was-validated');
    $('#aseguradora_id').val('New');
  }

  function editAseguradora(aseguradora_id) {
    return alert('Aseguradora editada');
    $.ajax({
      ...ajaxConfig,
      url: '/get_data_multiple',
      data: $.param({ start: 0, length: 0, aseguradora_id }),
      success: function (resp) {
        $('#aseguradora_id').val(resp.data[0].id);
        $('#nombre').val(resp.data[0].nombre);
      },
      error: (xhr, status, error) => console.error(error),
    });
  }

  async function deleteAseguradora(aseguradora_id) {
    const { isConfirmed } = await alertConfirm(
      '¿Esta seguro de eliminar esta aseguradora?'
    );
    if (!isConfirmed) return;
    return alert('Aseguradora eliminada');
    $.ajax({
      ...ajaxConfig,
      url: '/usuarios/delete',
      data: $.param({ aseguradora_id }),
      success: function (resp) {
        if (!resp.error) {
          alert(resp.msg, undefined, resp.title);
          getAseguradoras();
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

  function fillTableAseguradoras(resp, currentPage, itemsOnPage) {
    const {
      Aseguradora: { data, recordsTotal },
    } = resp;
    const table = $('#table-aseguradoras');
    table.html('');
    $.each(data, function (idx, item) {
      table.append(
        `<tr class="tableOption">
          <td>${item.aseguradora}</td>
          <td></td>
          <td></td>
          <td>
            <ul class="btn_table_options">
              <li>
                <a class="btn__icon_delete pointer" id="btnDelete_${item.id}">
                  <svg xmlns="http://www.w3.org/2000/svg" height="21" viewBox="0 -960 960 960" width="21" class="btn_icon"><path d="M292.309-140.001q-29.923 0-51.115-21.193-21.193-21.192-21.193-51.115V-720h-40v-59.999H360v-35.384h240v35.384h179.999V-720h-40v507.691q0 30.308-21 51.308t-51.308 21H292.309ZM680-720H280v507.691q0 5.385 3.462 8.847 3.462 3.462 8.847 3.462h375.382q4.616 0 8.463-3.846 3.846-3.847 3.846-8.463V-720ZM376.155-280h59.999v-360h-59.999v360Zm147.691 0h59.999v-360h-59.999v360ZM280-720v520-520Z"/></svg>
                </a>
              </li>
              <li>
                <a class="btn__icon_edit pointer" id="btnEdit_${item.id}">
                  <svg xmlns="http://www.w3.org/2000/svg" height="21" viewBox="0 -960 960 960" width="21" class="btn_icon"><path d="M200-200h50.461l409.463-409.463-50.461-50.461L200-250.461V-200Zm-59.999 59.999v-135.383l527.616-527.384q9.073-8.241 20.036-12.736 10.963-4.495 22.993-4.495 12.029 0 23.307 4.27 11.277 4.269 19.969 13.576l48.846 49.461q9.308 8.692 13.269 20.004 3.962 11.311 3.962 22.622 0 12.065-4.121 23.028-4.12 10.964-13.11 20.037l-527.384 527H140.001Zm620.384-570.153-50.231-50.231 50.231 50.231Zm-126.134 75.903-24.788-25.673 50.461 50.461-25.673-24.788Z"/></svg>
                </a>
              </li>
            </ul>
          </td>
        </tr>`
      );
      $(`#btnEdit_${item.id}`).on('click', (e) => editAseguradora(item.id));
      $(`#btnDelete_${item.id}`).on('click', (e) => deleteAseguradora(item.id));
    });
    $('#pagination').pagination({
      items: recordsTotal,
      prevText: 'Anterior',
      nextText: 'Siguiente',
      itemsOnPage,
      currentPage,
      onPageClick: (pageNumber, e) => {
        const start = (pageNumber - 1) * itemsOnPage;
        getAseguradoras(pageNumber, start);
      },
    });
  }

  function fillTableAcciones(resp, currentPage, itemsOnPage) {
    const { data, recordsTotal } = resp;
    const table = $('#table-accciones');
    table.html('');
    $.each(data, function (idx, item) {
      table.append(
        `<tr class="tableOption">
          <td>${item.usuario}</td>
          <td>${item.reviso === 'None None' ? 'N/A' : item.reviso}</td>
          <td>${item.timestamp}</td>
          <td>${item.descripcion}</td>
          <td>${item.status}</td>
        </tr>`
      );
    });
    $('#pagination-acciones').pagination({
      items: recordsTotal,
      prevText: 'Anterior',
      nextText: 'Siguiente',
      itemsOnPage,
      currentPage,
      onPageClick: (pageNumber, e) => {
        const start = (pageNumber - 1) * itemsOnPage;
        getAcciones(pageNumber, start);
      },
    });
  }

  function getAseguradoras(pageNumber = 1, start = 0) {
    const length = 5;
    $.ajax({
      ...ajaxConfig,
      url: '/get_data_multiple',
      data: $.param({ start, length, order: true }),
      success: (resp) => fillTableAseguradoras(resp, pageNumber, length),
      error: (xhr, status, error) => console.error(error),
    });
  }

  function getAcciones(pageNumber = 1, start = 0) {
    const length = 10;
    $.ajax({
      ...ajaxConfig,
      url: '/solicitudes/get_all',
      data: $.param({ start, length }),
      success: (resp) => {
        console.log(resp);
        fillTableAcciones(resp, pageNumber, length);
      },
      error: (xhr, status, error) => console.error(error),
    });
  }

  $('#tipoTitle').text(title);

  $('#tipo').on('change', (e) =>
    $('#tipoTitle').text(`Nuevo(a) ${e.target.value}`)
  );

  $('#utileriasForm').submit(function (e) {
    e.preventDefault();
    const formData = $(this).serialize();
    if (!this.checkValidity()) {
      $(this).addClass('was-validated');
      return;
    }
    $.ajax({
      type: 'POST',
      url: '/create_multiple',
      data: formData,
      success: function (resp) {
        if (resp.error) {
          alert(resp.msg || 'Ocurrio un error, intente de nuevo', 'error');
        } else {
          alert(resp.msg, 'success');
          getAseguradoras();
          resetForm();
        }
      },
      error: function (xhr, status, error) {
        console.log(error);
        alert(
          'Lamentamos el inconveniente, porfavor vuelve a intentarlo',
          'error'
        );
      },
    });
  });

  $('#reset-btn').click((e) => {
    e.preventDefault();
    resetForm();
  });
  // $('#sortByName').click((e) => {
  //   e.preventDefault();
  //   ordered = !ordered;
  //   getAseguradoras(ordered);
  // });
  $('#searchAseguradora').on('keyup', function (e) {
    e.preventDefault();
    const searchValue = e.target.value;
    if (searchValue == '') return getAseguradoras();
    if (searchValue.length >= 3)
      $.ajax({
        ...ajaxConfig,
        url: '/get_data_multiple',
        data: $.param({ start: 0, length: 0, searchValue }),
        success: (resp) => fillTableAseguradoras(resp, 1, 5),
        error: (xhr, status, error) => console.error(error),
      });
  });

  getAseguradoras();
  getAcciones();
});
