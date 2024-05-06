const data = async () => {
   const response = await fetch('/get_requests_data');
   const data = await response.json();
   console.log(data.data);
   const container = document.querySelector('.containerCards');
   container.innerHTML = '';
   data.data.map(async (item) => {
      console.log(item);
      container.innerHTML += `<div class="card">
      <h5 class="card-title">${item.descripcion}</h5>
      <div class="buttons">
            <ul class="btn_table_options">
                <li>
                    <a href="#" class="btn__icon_delete" id="btnDelete_${item.id}">
                    <span class="material-symbols-outlined">check_circle</span>
                    </a>
                </li>
                <li>
                    <a href="#" class="btn__icon_edit" id="btnEdit_${item.id}">
                    <span class="material-symbols-outlined">cancel</span> 
                    </a>
                </li> 
            </ul>
      </div>
      </div>`;
   });
   await addBtnDelete();
};

data();

const addBtnDelete = async () => {
   const btnDelete = document.querySelectorAll('.btn__icon_delete');
   console.log(btnDelete);

   btnDelete.forEach((btn) => {
      btn.addEventListener('click', async (e) => {
         //función eliminar
         console.log(e.target.id.split('_')[1]);
         await deleteClient(e.target.id.split('_')[1]);
         await data();
      });
   });
};

const deleteClient = async (id) => {
   const response = await fetch('/process-request', {
      method: 'POST',
      headers: {
         'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
         request_id: id,
         action: 'Aceptada'
      })
   });

   const responseData = await response.json();
   console.log(responseData);
};
