const http = require('http');

const options = {
    hostname: '127.0.0.1',
    port: 4040,
    path: '/api/tunnels',
    method: 'GET'
};

const req = http.request(options, (res) => {
    let data = '';

    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            if (json.tunnels && json.tunnels.length > 0) {
                const publicUrl = json.tunnels[0].public_url;
                console.log('\n==================================================');
                console.log('🔗  LINK GAME CUA BAN (Copy link nay):');
                console.log('\n    ' + publicUrl);
                console.log('\n==================================================\n');
            } else {
                console.log('⚠️  Chua tim thay tunnel nao. Ban da chay "ngrok http 80" chua?');
            }
        } catch (e) {
            console.log('⚠️  Loi doc du lieu tu Ngrok:', e.message);
        }
    });
});

req.on('error', (e) => {
    console.log('⚠️  Khong ket noi duoc voi Ngrok. Hay dam bao ban da chay "ngrok http 80".');
});

req.end();
