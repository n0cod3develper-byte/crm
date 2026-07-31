const id = 'd16f0b0e-e2cd-49fd-9547-acea5ff76265';
fetch(`http://localhost:3001/api/v1/mantenimiento/ot/${id}`)
  .then(r => r.json().then(data => ({status: r.status, data})))
  .then(r => {
    console.log(JSON.stringify(r, null, 2));
  })
  .catch(e => console.error(e));
