
/**
 * Module dependencies.
 */
var config = require('./config.js');
var express = require('express')
  , faye    = require('faye')
  , nforce = require('nforce')
  , util = require('util');
  // , routes = require('./routes');

var app = module.exports = express.createServer();

// attach socket.io and listen 
var io = require('socket.io').listen(app);
// get a reference to the socket once a client connects
var socket = io.sockets.on('connection', function (socket) { }); 

// Bayeux server - mounted at /cometd
var fayeServer = new faye.NodeAdapter({mount: '/cometd', timeout: 60 });
fayeServer.attach(app);

var sfdc = nforce.createConnection({
  clientId: config.CLIENT_ID,
  clientSecret: config.CLIENT_SECRET,
  redirectUri: config.CALLBACK_URL + '/oauth/_callback',
  apiVersion: 'v24.0',  // optional, defaults to v24.0
  environment: config.ENVIRONMENT  // optional, sandbox or production, production default
});

// Configuration
app.configure(function(){
  app.set('views', __dirname + '/views');
  app.set('view engine', 'ejs');
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.static(__dirname + '/public')); 
});

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

app.configure('production', function(){
  app.use(express.errorHandler());
});

// Routes
// app.get('/', routes.index);


app.get('/', function(req, res) {

    res.render('index.ejs',{ title: 'Node.js Streaming Util' });
});


app.listen(config.PORT, function(){
  console.log("Express server listening on port %d in %s mode", app.address().port, app.settings.env);
});

// authenticates and returns OAuth -- used by faye
function getOAuthToken(callback) {

  if(config.DEBUG) console.log("Authenticating to get salesforce.com access token...");
  
  sfdc.authenticate({ username: config.USERNAME, password: config.PASSWORD }, function(err, resp){
    if(err) {
      console.log('Error authenticating to org: ' + err.message);
    } else {
      if(config.DEBUG) console.log('OAauth dance response: ' + util.inspect(resp));
      callback(resp);
    }
  });

}

// get the access token from salesforce.com to start the entire polling process
getOAuthToken(function(oauth) { 

  // cometd endpoint
  var salesforce_endpoint = oauth.instance_url +'/cometd/24.0';
  if(config.DEBUG) console.log("Creating a client for "+ salesforce_endpoint);

  // add the client listening to salesforce.com
  var client = new faye.Client(salesforce_endpoint);

  // set header with OAuth token
  client.setHeader('Authorization', 'OAuth '+ oauth.access_token);

  // monitor connection down and reset the header
  client.bind('transport:down', function(client) {
    // get an OAuth token again
    getOAuthToken(function(oauth) {
      // set header again
      // upstreamClient.setHeader('Authorization', 'OAuth '+ oauth.access_token);
    });
  });

  // subscribe to salesforce.com push topic
  if(config.DEBUG) console.log('Subscribing to '+ config.PUSH_TOPIC);
  var upstreamSub = client.subscribe(config.PUSH_TOPIC, function(message) {
    // new inserted/updated record receeived -- do something with it
    if(config.DEBUG) console.log("Received message: " + JSON.stringify(message)); 
    socket.emit('record-processed', JSON.stringify(message));
    /**
    * NOW WE HAVE A RECORD FROM SALESFORCE.COM! PROCESS IT ANYWAY YOU'D LIKE!!
    **/
  });

  // log that upstream subscription is active
  client.callback(function() {
    if(config.DEBUG) console.log('Upstream subscription is now active');    
  });

  // log that upstream subscription encounters error
  client.errback(function(error) {
    if(config.DEBUG) console.error("ERROR ON Upstream subscription Attempt: " + error.message);
  });

  // just for debugging I/O, an extension to client -- comment out if too chatty
  client.addExtension({
    outgoing: function(message, callback) {   
      if(config.DEBUG) console.log('OUT >>> '+ JSON.stringify(message));
      callback(message);            
    },
    incoming: function(message, callback) {   
      if(config.DEBUG) console.log('IN >>>> '+ JSON.stringify(message));
      callback(message);            
    }            
  });  
  
});
