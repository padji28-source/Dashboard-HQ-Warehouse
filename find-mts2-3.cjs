const https = require('https');

https.get('https://docs.google.com/spreadsheets/d/e/2PACX-1vSbvA_5FOxi2-nkfz8iJbptOhDfBCLM5LnTwrVLeJ4pf1hlGjSBywsTXQYYtEjuo0DY2M63wcJmc0tP/pub?html=true', (res) => {
  let data = '';
  res.on('data', chunk => { data += chunk; });
  res.on('end', () => {
    const index = data.indexOf('MTS2');
    if (index !== -1) {
      console.log(data.substring(Math.max(0, index - 150), index + 150));
    }
  });
}).on('error', err => {
  console.log('Error: ' + err.message);
});
