$(function () {
  const ajaxConfig = {
    url: '',
    type: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    dataType: 'json',
  };

  function getColor(status) {
    if (!status) return '';
    switch (status) {
      case 'Vigente':
        return 'rgb(0 255 0 / 50%)';
      case 'Cancelada':
        return 'rgb(255 0 0 / 80%)';
      case 'Por vencer':
        return 'rgb(255 255 0 / 80%)';
      case status.includes('Cancel'):
        return '#ff0000';
      case status.toLowerCase().includes('vencer'):
        return 'rgb(255 255 0 / 80%)';
      default:
        return '';
    }
  }

  function fillTableVencimientos(resp, currentPage, itemsOnPage) {
    const { data, recordsTotal } = resp;
    const table = $('#table-vencimientos');
    table.html('');
    $.each(data, function (idx, poliza) {
      table.append(
        `<tr class="tableOption" style="background-color: ${getColor(
          poliza.status
        )}">
          <td>
            <p class="td-clickable" id="td-clickable_${poliza.id}">
                ${poliza.poliza}
            </p>
          </td>
          <td>${poliza.fecha_termino}</td>
          <td>${poliza.cliente}</td>
          <td>${poliza.subramo}</td>
          <td>${poliza.aseguradora}</td>
          <td>${poliza.tipoPago}</td>
          <td>
            <ul class="btn_table_options">
              <li>
                <a class="btn__icon_delete pointer" id="btnDelete_${poliza.id}">
                  <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#000000"><path d="M480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q54 0 104-17.5t92-50.5L228-676q-33 42-50.5 92T160-480q0 134 93 227t227 93Zm252-124q33-42 50.5-92T800-480q0-134-93-227t-227-93q-54 0-104 17.5T284-732l448 448Z"/></svg>
                </a>
              </li>
              <li>
                <a class="btn__icon_edit pointer" id="btnEdit_${poliza.id}">
                  <svg xmlns="http://www.w3.org/2000/svg" height="21" viewBox="0 -960 960 960" width="21" class="btn_icon"><path d="M200-200h50.461l409.463-409.463-50.461-50.461L200-250.461V-200Zm-59.999 59.999v-135.383l527.616-527.384q9.073-8.241 20.036-12.736 10.963-4.495 22.993-4.495 12.029 0 23.307 4.27 11.277 4.269 19.969 13.576l48.846 49.461q9.308 8.692 13.269 20.004 3.962 11.311 3.962 22.622 0 12.065-4.121 23.028-4.12 10.964-13.11 20.037l-527.384 527H140.001Zm620.384-570.153-50.231-50.231 50.231 50.231Zm-126.134 75.903-24.788-25.673 50.461 50.461-25.673-24.788Z"/></svg>
                </a>
              </li>
              <li>
                <a class="btn__icon_show pointer" id="btnShow_${poliza.id}">
                  <svg xmlns="http://www.w3.org/2000/svg" height="21" viewBox="0 -960 960 960" width="21" class="btn_icon"><path d="M480-320q75 0 127.5-52.5T660-500q0-75-52.5-127.5T480-680q-75 0-127.5 52.5T300-500q0 75 52.5 127.5T480-320Zm0-72q-45 0-76.5-31.5T372-500q0-45 31.5-76.5T480-608q45 0 76.5 31.5T588-500q0 45-31.5 76.5T480-392Zm0 192q-146 0-266-81.5T40-500q54-137 174-218.5T480-800q146 0 266 81.5T920-500q-54 137-174 218.5T480-200Zm0-300Zm0 220q113 0 207.5-59.5T832-500q-50-101-144.5-160.5T480-720q-113 0-207.5 59.5T128-500q50 101 144.5 160.5T480-280Z"/></svg>
                </a>
              </li>
            </ul>
          </td>
        </tr>`
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
        getVencimientos(pageNumber, start);
      },
    });
  }

  function getVencimientos(pageNumber = 1, start = 0) {
    const length = 10;
    const searchValue = $('#searchVencimiento').val();
    $.ajax({
      ...ajaxConfig,
      url: '/vencimientos/get',
      data: $.param({ start, length, order: true, searchValue }),
      success: (resp) => fillTableVencimientos(resp, pageNumber, length),
      error: (xhr, status, error) => console.error(error),
    });
  }

  $('#searchVencimiento').on('keyup', function (e) {
    e.preventDefault();
    const searchValue = e.target.value;
    if (searchValue === '') return getVencimientos();
    $.ajax({
      ...ajaxConfig,
      url: '/vencimientos/get',
      data: $.param({ start: 0, length: 10, searchValue }),
      success: (resp) => fillTableVencimientos(resp, 1, 10),
      error: (xhr, status, error) => console.error(error),
    });
  });

  getVencimientos();
});
