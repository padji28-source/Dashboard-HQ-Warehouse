const https = require('https');

https.get('https://docs.google.com/spreadsheets/d/e/2PACX-1vSbvA_5FOxi2-nkfz8iJbptOhDfBCLM5LnTwrVLeJ4pf1hlGjSBywsTXQYYtEjuo0DY2M63wcJmc0tP/pub?html=true', (res) => {
  let data = '';
  res.on('data', chunk => { data += chunk; });
  res.on('end', () => {
    const regex = /{name:\s*'([^']+)',\s*gid:\s*'([^']+)'}/g;
    let match;
    while ((match = regex.exec(data)) !== null) {
      console.log(`Name: ${match[1]}, GID: ${match[2]}`);
    }
  });
}).on('error', err => {
  console.log('Error: ' + err.message);
});
