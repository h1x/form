const http = require('http');
const url = require('url');
const fs = require('fs');
const querystring = require('querystring');
const { Pool } = require("pg");
const { parse } = require('cookie');


const sessions = {};
function generateSessionId() {
  return 'session_' + Math.random().toString(36).substr(2, 9);
}



const credentials = {
    user: "postgres",
    host: "localhost",
    database: "form",
    password: "123",
    port: 5432,
};

const pool = new Pool(credentials);
pool.connect((err, client, done) => {
    if (err) {
        console.error('Error connecting to PostgreSQL database:', err);
    } else {
        console.log('Connected to PostgreSQL database');
        done();
    }
 });



function validationEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}
  
function validationName(name) {
    return name.length >= 2;
}
  
function validationPassword(password) {
    const lengthCheck = password.length >= 8;
    const lowercaseCheck = /[a-z]/.test(password);
    const uppercaseCheck = /[A-Z]/.test(password);
    const digitCheck = /\d/.test(password);
  
    return lengthCheck && lowercaseCheck && uppercaseCheck && digitCheck;
}



function loadView(view, res) {
    fs.readFile('views/' + view + '.html', (err, data) => {
        if (err) {
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Internal Server Error');
        } else {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(data);
        }
    });
    return;
}
  


const server = http.createServer((req, res) => {
const parsedUrl = url.parse(req.url, true);

if (parsedUrl.pathname === '/register' && req.method === 'GET') {
    loadView('register', res);
} else if (parsedUrl.pathname === '/login' && req.method === 'GET') {
    loadView('login', res)
} else if (parsedUrl.pathname === '/main' && req.method === 'GET') {
    const cookies = parse(req.headers.cookie || '');
    if(cookies.sessionId && sessions[cookies.sessionId]) {
        loadView('main', res)
    } else {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('Please login first.');
    }
}



else if (parsedUrl.pathname === '/register' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => {
        body += chunk;
    });

    req.on('end', () => {
        const formData = querystring.parse(body);
        const { name, email, password, passwordRepeat } = formData;

        if (!validationEmail(email) || !validationName(name) || !validationPassword(password) || password != passwordRepeat) {
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end('Registration unsuccessful.');
            return;
        } else {
            pool.query('INSERT INTO users (name, email, password) VALUES ($1, $2, $3)', [name, email, password], (err, result) => {
                if (err) {
                    console.error('Error inserting data:', err);
                    res.writeHead(500, { 'Content-Type': 'text/plain' });
                    res.end('Internal Server Error');
                } else {
                    console.log('User data inserted successfully');
                    res.writeHead(200, { 'Content-Type': 'text/html' });
                }
              });

           // send email

            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end('Registration successful. Check your email for verification.');
        }
    });
}



else if (parsedUrl.pathname === '/login' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => {
        body += chunk;
    });

    req.on('end', () => {
        const formData = querystring.parse(body);
        const { email, password } = formData;

        if (!validationEmail(email)) {
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end('Not an email.');
            return;
        } else {
            pool.query('SELECT * FROM users WHERE email = $1', [email], (err, result) => {
                if (err) {
                    console.error('Error querying data:', err);
                    res.writeHead(500, { 'Content-Type': 'text/plain' });
                    res.end('Internal Server Error');
                } else {
                    if (result.rows.length === 1) {
                        const user = result.rows[0];
                        if(password == user.password && user.is_verified == true) {
                            const sessionId = generateSessionId();
                            sessions[sessionId] = { userId: user.id };
                            
                            const sessionCookie = `sessionId=${sessionId}; HttpOnly; Path=/`;
                            res.setHeader('Set-Cookie', [sessionCookie]);

                            loadView('main', res);
                            return;
                        } else {
                            res.writeHead(200, { 'Content-Type': 'text/plain' });
                            res.end('Login unsuccessful. ');
                            return;
                        }

                    } else {
                        res.writeHead(200, { 'Content-Type': 'text/plain' });
                        res.end('Login unsuccessful. ');
                        return;
                    }
                }
            });
        }     
    });
}

  else if (parsedUrl.pathname === '/changeEmail' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => {
        body += chunk;
    });

    req.on('end', () => {
        const formData = querystring.parse(body);
        const { email } = formData;

        const cookies = parse(req.headers.cookie || '');

        if (!validationEmail(email)) {
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end('Not an email.');
            return;
        } else {
            pool.query('UPDATE users SET email = $1 WHERE id = $2', [email, sessions[cookies.sessionId].userId], (err, result) => {
                if (err) {
                    console.error('Error querying data:', err);
                    res.writeHead(500, { 'Content-Type': 'text/plain' });
                    res.end('Internal Server Error');
                } else {
                    res.writeHead(200, { 'Content-Type': 'text/plain' });
                    res.end('Change successful. ');
                    return;
                }
            });
        } 
    });
  }

  else if (parsedUrl.pathname === '/changeName' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => {
        body += chunk;
    });

    req.on('end', () => {
        const formData = querystring.parse(body);
        const { name } = formData;

        const cookies = parse(req.headers.cookie || '');

        if (!validationName(name)) {
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end('Not a name.');
            return;
        } else {
            pool.query('UPDATE users SET name = $1 WHERE id = $2', [name, sessions[cookies.sessionId].userId], (err, result) => {
                if (err) {
                    console.error('Error querying data:', err);
                    res.writeHead(500, { 'Content-Type': 'text/plain' });
                    res.end('Internal Server Error');
                } else {
                    res.writeHead(200, { 'Content-Type': 'text/plain' });
                    res.end('Change successful. ');
                    return;
                }
            });
        }
    });
  }

  else if (parsedUrl.pathname === '/changePassword' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => {
        body += chunk;
    });

    req.on('end', () => {
        const formData = querystring.parse(body);
        const { password, passwordRepeat } = formData;

        const cookies = parse(req.headers.cookie || '');

        if (!validationPassword(password) || password != passwordRepeat) {
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end('Not a valid password.');
            return;
        } else {
            pool.query('UPDATE users SET password = $1 WHERE id = $2', [password, sessions[cookies.sessionId].userId], (err, result) => {
                if (err) {
                    console.error('Error querying data:', err);
                    res.writeHead(500, { 'Content-Type': 'text/plain' });
                    res.end('Internal Server Error');
                } else {
                    res.writeHead(200, { 'Content-Type': 'text/plain' });
                    res.end('Change successful. ');
                    return;
                }
            });
        }
    });
  }

  else if (parsedUrl.pathname === '/logout' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => {
        body += chunk;
    });

    req.on('end', () => {
        const cookies = parse(req.headers.cookie || '');
        delete sessions[cookies.sessionId];
        res.setHeader('Set-Cookie', [`sessionId=; HttpOnly; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT`]);
        loadView('login', res);
    });
  }



  else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

const port = 3000;
server.listen(port, () => {
    console.log(`Server is listening on port ${port}`);
});
