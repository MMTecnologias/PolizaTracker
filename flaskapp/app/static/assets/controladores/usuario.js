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
    $('#userForm')[0].reset();
    $('#acceso').html(`
      <option></option>
      <option value="1">Administrador</option>
      <option value="2">Usuario</option>
      <option value="3">Desarrollador</option>
      <option value="4">Gerente</option>
    `);
    $('#userForm input').prop('disabled', false);
    $('#userForm').removeClass('was-validated');
    $('#usuario_id').val('New');
  }

  function editUser(usuario_id) {
    $.ajax({
      ...ajaxConfig,
      url: '/usuarios/get',
      data: $.param({ start: 0, length: 0, usuario_id }),
      success: function (resp) {
        $('#usuario_id').val(resp.data[0].id);
        $('#nombre').val(resp.data[0].nombre);
        $('#apellido').val(resp.data[0].apellido);
        $('#email').val(resp.data[0].correo);
        $('#cel').val(resp.data[0].telefono);
        $('#username').val(resp.data[0].username);
        $('#password').prop('disabled', true);
        $('#acceso').html(`<option value='${resp.data[0].nivel_id}'>
        ${resp.data[0].acceso}
        </option>
        ${
          resp.data[0].nivel_id !== 1 &&
          '<option value="1">Administrador</option>'
        }
        ${resp.data[0].nivel_id !== 2 && '<option value="2">Usuario</option>'}
        ${
          resp.data[0].nivel_id !== 3 &&
          '<option value="3">Desarrollador</option>'
        }
        ${resp.data[0].nivel_id !== 4 && '<option value="4">Gerente</option>'}
        `);
      },
      error: (xhr, status, error) => console.error(error),
    });
  }

  async function deleteUser(user_id, name) {
    const { isConfirmed } = await alertConfirm(
      `¿Esta seguro de eliminar al usuario ${name}?`
    );
    if (!isConfirmed) return;
    $.ajax({
      ...ajaxConfig,
      url: '/usuarios/delete',
      data: $.param({ user_id }),
      success: function (resp) {
        if (!resp.error) {
          alert(resp.msg, undefined, resp.title);
          getUsers();
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

  function fillTableUsers(resp, currentPage, itemsOnPage) {
    const { data, recordsTotal } = resp;
    const table = $('#table-users');
    table.html('');
    $.each(data, function (idx, usuario) {
      table.append(
        `<tr class="tableOption">
          <td>${usuario.fullname}</td>
          <td>${usuario.correo}</td>
          <td>${usuario.telefono}</td>
          <td>${usuario.acceso}</td>
          <td>
            <ul class="btn_table_options">
              <li>
                <a class="btn__icon_delete pointer" id="btnDelete_${usuario.id}">
                  <svg xmlns="http://www.w3.org/2000/svg" height="21" viewBox="0 -960 960 960" width="21" class="btn_icon"><path d="M292.309-140.001q-29.923 0-51.115-21.193-21.193-21.192-21.193-51.115V-720h-40v-59.999H360v-35.384h240v35.384h179.999V-720h-40v507.691q0 30.308-21 51.308t-51.308 21H292.309ZM680-720H280v507.691q0 5.385 3.462 8.847 3.462 3.462 8.847 3.462h375.382q4.616 0 8.463-3.846 3.846-3.847 3.846-8.463V-720ZM376.155-280h59.999v-360h-59.999v360Zm147.691 0h59.999v-360h-59.999v360ZM280-720v520-520Z"/></svg>
                </a>
              </li>
              <li>
                <a class="btn__icon_edit pointer" id="btnEdit_${usuario.id}">
                  <svg xmlns="http://www.w3.org/2000/svg" height="21" viewBox="0 -960 960 960" width="21" class="btn_icon"><path d="M200-200h50.461l409.463-409.463-50.461-50.461L200-250.461V-200Zm-59.999 59.999v-135.383l527.616-527.384q9.073-8.241 20.036-12.736 10.963-4.495 22.993-4.495 12.029 0 23.307 4.27 11.277 4.269 19.969 13.576l48.846 49.461q9.308 8.692 13.269 20.004 3.962 11.311 3.962 22.622 0 12.065-4.121 23.028-4.12 10.964-13.11 20.037l-527.384 527H140.001Zm620.384-570.153-50.231-50.231 50.231 50.231Zm-126.134 75.903-24.788-25.673 50.461 50.461-25.673-24.788Z"/></svg>
                </a>
              </li>
              <li>
                <a class="btn__icon_show pointer" id="btnShow_${usuario.id}">
                  <svg xmlns="http://www.w3.org/2000/svg" height="21" viewBox="0 -960 960 960" width="21" class="btn_icon"><path d="M480-320q75 0 127.5-52.5T660-500q0-75-52.5-127.5T480-680q-75 0-127.5 52.5T300-500q0 75 52.5 127.5T480-320Zm0-72q-45 0-76.5-31.5T372-500q0-45 31.5-76.5T480-608q45 0 76.5 31.5T588-500q0 45-31.5 76.5T480-392Zm0 192q-146 0-266-81.5T40-500q54-137 174-218.5T480-800q146 0 266 81.5T920-500q-54 137-174 218.5T480-200Zm0-300Zm0 220q113 0 207.5-59.5T832-500q-50-101-144.5-160.5T480-720q-113 0-207.5 59.5T128-500q50 101 144.5 160.5T480-280Z"/></svg>
                </a>
              </li>
            </ul>
          </td>
        </tr>`
      );
      $(`#btnEdit_${usuario.id}`).on('click', (e) => editUser(usuario.id));
      $(`#btnDelete_${usuario.id}`).on('click', (e) =>
        deleteUser(usuario.id, usuario.fullname)
      );
      $(`#btnShow_${usuario.id}`).on('click', (e) => {
        $('#hist').modal();
        getHistory(usuario.id);
      });
    });
    $('#pagination').pagination({
      items: recordsTotal,
      prevText: 'Anterior',
      nextText: 'Siguiente',
      itemsOnPage,
      currentPage,
      onPageClick: (pageNumber, e) => {
        const start = (pageNumber - 1) * itemsOnPage;
        getUsers(pageNumber, start);
      },
    });
  }

  function fillTablePassword(resp) {
    const itemsOnPage = 5;
    const { data, recordsTotal } = resp;
    const table = $('#table-password');
    table.html('');
    $.each(data, function (idx, contra) {
      table.append(
        `<tr  class="table-option">
          <td>${contra.usuario}</td>
          <td>${contra.correo}</td>
          <td>
            <a id="btnChange_${contra.usuario_id}" class="pointer">
              <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#000000"><path d="M280-400q-33 0-56.5-23.5T200-480q0-33 23.5-56.5T280-560q33 0 56.5 23.5T360-480q0 33-23.5 56.5T280-400Zm0 160q-100 0-170-70T40-480q0-100 70-170t170-70q67 0 121.5 33t86.5 87h352l120 120-180 180-80-60-80 60-85-60h-47q-32 54-86.5 87T280-240Zm0-80q56 0 98.5-34t56.5-86h125l58 41 82-61 71 55 75-75-40-40H435q-14-52-56.5-86T280-640q-66 0-113 47t-47 113q0 66 47 113t113 47Z"/></svg>
            </a>
          </td>
        </tr>`
      );

      $(`#btnChange_${contra.usuario_id}`).on('click', (e) => {
        $('#pass').modal();

        $('#user_id').val(contra.usuario_id);
      });
    });
    $('.table-option').slice(5).hide();
    $('#pagination-password').pagination({
      items: recordsTotal,
      itemsOnPage: itemsOnPage,
      onPageClick: (noofele) =>
        $('.table-option')
          .hide()
          .slice(
            itemsOnPage * (noofele - 1),
            itemsOnPage + itemsOnPage * (noofele - 1)
          )
          .show(),
    });
  }

  function fillTableHistory(resp) {
    const itemsOnPage = 15;
    const { data, recordsTotal } = resp;
    const table = $('#table-history');
    table.html('');
    $.each(data, function (idx, hist) {
      table.append(
        `<tr class="table-option-hist">
          <td>${hist.usuario}</td>
          <td>${hist.timestamp}</td>
          <td>${hist.descripcion}</td>
          <td>${hist.status}</td>
        </tr>`
      );
    });
    $('.table-option-hist').slice(15).hide();
    $('#pagination-history').pagination({
      items: recordsTotal,
      itemsOnPage: itemsOnPage,
      onPageClick: (noofele) =>
        $('.table-option-hist')
          .hide()
          .slice(
            itemsOnPage * (noofele - 1),
            itemsOnPage + itemsOnPage * (noofele - 1)
          )
          .show(),
    });
  }

  function getUsers(pageNumber = 1, start = 0) {
    const length = 8;
    const searchValue = $('#searchUser').val();
    $.ajax({
      ...ajaxConfig,
      url: '/usuarios/get',
      data: $.param({ start, length, order: true, searchValue }),
      success: (resp) => fillTableUsers(resp, pageNumber, length),
      error: (xhr, status, error) => console.error(error),
    });
  }

  function getHistory(user_id) {
    $.ajax({
      ...ajaxConfig,
      url: '/usuarios/get_requests',
      data: $.param({ user_id }),
      success: fillTableHistory,
      error: (xhr, status, error) => console.error(error),
    });
  }

  function getChangesPassword(start = 0, length = 0) {
    $.ajax({
      ...ajaxConfig,
      url: '/usuarios/get_solicitudes_contrasenas',
      data: $.param({ start, length }),
      success: fillTablePassword,
      error: (xhr, status, error) => console.error(error),
    });
  }
  $('#userForm').submit(function (e) {
    e.preventDefault();
    const formData = $(this).serialize();
    if (!this.checkValidity()) {
      $(this).addClass('was-validated');
      return;
    }
    $.ajax({
      type: 'POST',
      url: '/usuarios/create',
      data: formData,
      success: function (resp) {
        if (resp.error) {
          alert(resp.msg, 'error', resp.title);
        } else {
          alert(resp.msg, 'success', resp.title);
          getUsers();
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
  $('#visibility_newpass').click(function () {
    if ($('#newpass').attr('type') === 'password') {
      $('#newpass').attr('type', 'text');
    } else {
      $('#newpass').attr('type', 'password');
    }
  });
  $('#visibility_cnewpass').click(function () {
    if ($('#cnewpass').attr('type') === 'password') {
      $('#cnewpass').attr('type', 'text');
    } else {
      $('#cnewpass').attr('type', 'password');
    }
  });
  $('#passForm').submit(function (e) {
    e.preventDefault();
    const formData = $(this).serialize();
    if (!this.checkValidity()) {
      $(this).addClass('was-validated');
      return;
    }
    if ($('#newpass').val() !== $('#cnewpass').val())
      return alert('Las contraseñas deben ser iguales', 'error');
    $.ajax({
      type: 'POST',
      url: '/usuarios/change_pass',
      data: formData,
      success: function (resp) {
        if (resp.error) {
          alert(resp.msg, 'error', resp.title);
        } else {
          alert(resp.msg, 'success', resp.title);
          $('#passForm')[0].reset();
          $('#pass').modal('toggle');
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
  //   getUsers(ordered);
  // });
  $('#searchUser').on('keyup', function (e) {
    e.preventDefault();
    const searchValue = e.target.value;
    if (searchValue == '') return getUsers();
    $.ajax({
      ...ajaxConfig,
      url: '/usuarios/get',
      data: $.param({ start: 0, length: 0, searchValue }),
      success: (resp) => fillTableUsers(resp, 1, 5),
      error: (xhr, status, error) => console.error(error),
    });
  });

  getUsers();
  getChangesPassword();
});
