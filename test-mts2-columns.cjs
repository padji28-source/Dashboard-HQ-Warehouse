const https = require('https');

https.get('https://docs.google.com/spreadsheets/d/e/2PACX-1vSbvA_5FOxi2-nkfz8iJbptOhDfBCLM5LnTwrVLeJ4pf1hlGjSBywsTXQYYtEjuo0DY2M63wcJmc0tP/pub?gid=263347272&single=true&output=csv', (res) => {
  let data = '';
  res.on('data', chunk => { data += chunk; });
  res.on('end', () => {
    const rows = data.split('\n');
    console.log("Headers:", rows[0]);
    console.log("Row 1:", rows[1]);
  });
}).on('error', err => {
  console.log('Error: ' + err.message);
});
