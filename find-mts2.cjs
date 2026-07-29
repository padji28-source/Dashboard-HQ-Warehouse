const https = require('https');

https.get('https://docs.google.com/spreadsheets/d/e/2PACX-1vSbvA_5FOxi2-nkfz8iJbptOhDfBCLM5LnTwrVLeJ4pf1hlGjSBywsTXQYYtEjuo0DY2M63wcJmc0tP/pub?html=true', (res) => {
  let data = '';
  res.on('data', chunk => { data += chunk; });
  res.on('end', () => {
    const matches = [...data.matchAll(/gid=([^&"']+)/g)];
    const uniqueGids = [...new Set(matches.map(m => m[1]))];
    console.log("Found GIDs:", uniqueGids);
    
    // Check if 'MTS2' text is in the HTML
    console.log("Contains 'MTS2':", data.includes('MTS2'));
  });
}).on('error', err => {
  console.log('Error: ' + err.message);
});
