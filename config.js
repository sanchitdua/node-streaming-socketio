exports.PORT = process.env.PORT || 3001; // use heroku's dynamic port or 3001 if localhost
exports.DEBUG = true; 
exports.ENVIRONMENT = 'production'; 
exports.CALLBACK_URL = 'http://localhost:3001'; 
exports.PUSH_TOPIC = '/topic/AllAccounts';

exports.CLIENT_ID = 'YOUR_CLIENT_ID';
exports.CLIENT_SECRET = 'YOUR_CLIENT_SECRET';
exports.USERNAME = 'username';
exports.PASSWORD = 'PASSWORD'+'SECURITY_TOKEN'; 